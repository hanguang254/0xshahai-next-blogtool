import type { NextApiRequest, NextApiResponse } from "next";

type DexBoostItem = {
  chainId?: string;
  tokenAddress?: string;
  [key: string]: unknown;
};

type PairInfo = Record<string, unknown>;

const DEX_BASE = "https://api.dexscreener.com";
const TOKEN_PROFILES_URL = `${DEX_BASE}/token-profiles/latest/v1`;
const ADS_LATEST_URL = `${DEX_BASE}/ads/latest/v1`;
const BOOSTS_LATEST_URL = `${DEX_BASE}/token-boosts/latest/v1`;
const BOOSTS_TOP_URL = `${DEX_BASE}/token-boosts/top/v1`;

function clampLimit(value: string | string[] | undefined, max: number) {
  const n = Number(Array.isArray(value) ? value[0] : value);
  if (!Number.isFinite(n) || n <= 0) return Math.min(10, max);
  return Math.min(Math.floor(n), max);
}

function extractChainId(item: DexBoostItem) {
  return typeof item.chainId === "string" ? item.chainId : undefined;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    throw new Error(`request_failed:${res.status}`);
  }
  return res.json() as Promise<T>;
}

function extractMarketCap(pair: PairInfo | undefined) {
  if (!pair) return undefined;
  const direct = pair.marketCap;
  if (typeof direct === "number") return direct;
  return undefined;
}

function extractPriceChange(pair: PairInfo | undefined) {
  if (!pair) return undefined;
  const priceChange = pair.priceChange as Record<string, unknown> | undefined;
  if (!priceChange) return undefined;
  
  const m5 = typeof priceChange.m5 === "number" ? priceChange.m5 : undefined;
  const h1 = typeof priceChange.h1 === "number" ? priceChange.h1 : undefined;
  
  if (m5 !== undefined || h1 !== undefined) {
    return { m5, h1 };
  }
  return undefined;
}

function formatIconUrl(icon?: unknown) {
  if (typeof icon !== "string") return undefined;
  const CDN_BASE = "https://cdn.dexscreener.com/cms/images";
  return `${CDN_BASE}/${icon}?width=800&height=800&quality=90`;
}

function formatHeaderUrl(header?: unknown) {
  if (typeof header !== "string") return undefined;
  return header.includes("?") ? header : header;
}

async function fetchPairByToken(chainId: string, tokenAddress: string) {
  const url = `${DEX_BASE}/token-pairs/v1/${chainId}/${tokenAddress}`;
  const pairs = await fetchJson<PairInfo[]>(url);
  return pairs?.[0];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const limit = clampLimit(req.query.limit, 100);
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

  try {
    // 同时获取四个接口的数据
    const [profiles, ads, boostsLatest, boostsTop] = await Promise.all([
      fetchJson<DexBoostItem[]>(TOKEN_PROFILES_URL).catch(() => []),
      fetchJson<DexBoostItem[]>(ADS_LATEST_URL).catch(() => []),
      fetchJson<DexBoostItem[]>(BOOSTS_LATEST_URL).catch(() => []),
      fetchJson<DexBoostItem[]>(BOOSTS_TOP_URL).catch(() => []),
    ]);

    // 合并所有数据并去重（根据 chainId + tokenAddress）
    const allTokens = [...profiles, ...ads, ...boostsLatest, ...boostsTop];
    const uniqueMap = new Map<string, DexBoostItem>();
    for (const token of allTokens) {
      const chainId = extractChainId(token);
      const tokenAddress = token.tokenAddress;
      if (chainId && tokenAddress) {
        const key = `${chainId}:${tokenAddress}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, token);
        }
      }
    }

    const uniqueTokens = Array.from(uniqueMap.values());
    const itemsWithDetails: Array<{
      chainId: string;
      tokenAddress: string;
      label?: string;
      symbol?: string;
      name?: string;
      marketCap?: number;
      pairAddress?: string;
      priceChange?: { m5?: number; h1?: number };
      score?: number;
      url?: string;
      headerImageUrl?: string;
      iconUrl?: string;
      claimDate?: string;
      links?: Array<{ url: string; type?: string; label?: string }>;
      error?: string;
    }> = [];

    for (const token of uniqueTokens) {
      const chainId = extractChainId(token);
      let marketCap: number | undefined;
      let pairAddress: string | undefined;
      let priceChange: { m5?: number; h1?: number } | undefined;
      let label: string | undefined;
      let symbol: string | undefined;
      let name: string | undefined;
      let error: string | undefined;

      try {
        if (chainId && typeof token.tokenAddress === "string") {
          const pair = await fetchPairByToken(chainId, token.tokenAddress);
          if (pair) {
            marketCap = extractMarketCap(pair);
            priceChange = extractPriceChange(pair);
            pairAddress =
              typeof pair.pairAddress === "string"
                ? pair.pairAddress
                : undefined;
            const baseToken = pair.baseToken as
              | Record<string, unknown>
              | undefined;
            label =
              baseToken && typeof baseToken.name === "string"
                ? baseToken.name
                : undefined;
            symbol =
              baseToken && typeof baseToken.symbol === "string"
                ? baseToken.symbol
                : undefined;
            name = label;
          } else {
            error = "pair_not_found";
          }
        } else {
          error = "missing_chain_or_token";
        }
      } catch (err) {
        error = err instanceof Error ? err.message : "pair_fetch_failed";
      }

      const url = typeof token.url === "string" ? token.url : undefined;
      const score =
        typeof token.totalAmount === "number" ? token.totalAmount : undefined;
      const claimDate =
        typeof token.claimDate === "string" ? token.claimDate : undefined;

      itemsWithDetails.push({
        chainId: chainId!,
        tokenAddress: token.tokenAddress!,
        label,
        symbol,
        name,
        marketCap,
        pairAddress,
        priceChange,
        score,
        url,
        headerImageUrl: formatHeaderUrl(token.header),
        iconUrl: formatIconUrl(token.icon),
        claimDate,
        links: Array.isArray(token.links) ? token.links : undefined,
        error,
      });
    }

    // 按市值排序（从大到小）并添加 rank
    const sorted = itemsWithDetails
      .filter((item) => typeof item.marketCap === "number")
      .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));

    const withoutMarketCap = itemsWithDetails.filter(
      (item) => typeof item.marketCap !== "number"
    );

    const rankedItems = sorted.slice(0, limit).map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

    return res.status(200).json({
      total: rankedItems.length,
      limit,
      items: rankedItems,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "fetch_failed";
    return res.status(502).json({ error: message });
  }
}
