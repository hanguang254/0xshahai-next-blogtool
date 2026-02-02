import type { NextApiRequest, NextApiResponse } from "next";

type DexBoostItem = {
  chainId?: string;
  tokenAddress?: string;
  source?: string;
  sources?: string[];
  [key: string]: unknown;
};

type PairInfo = Record<string, unknown>;

const DEX_BASE = "https://api.dexscreener.com";
const TOKEN_PROFILES_URL = `${DEX_BASE}/token-profiles/latest/v1`;
const ADS_LATEST_URL = `${DEX_BASE}/ads/latest/v1`;
const BOOSTS_LATEST_URL = `${DEX_BASE}/token-boosts/latest/v1`;
const BOOSTS_TOP_URL = `${DEX_BASE}/token-boosts/top/v1`;
const AVE_BASE = "https://prod.ave-api.com";
const TRENDING_URL = `${AVE_BASE}/v2/tokens/trending`;
const AVE_API_KEY =
  process.env.AVE_API_KEY ||
  "uHxe2IxOYEx3vHNpUpPtVDJVd2UTPycHLimZkAIpyMxkGS9GE84tf05VU96Uwgdm";

function clampLimit(value: string | string[] | undefined, max: number) {
  const n = Number(Array.isArray(value) ? value[0] : value);
  if (!Number.isFinite(n) || n <= 0) return Math.min(10, max);
  return Math.min(Math.floor(n), max);
}

function extractChainId(item: DexBoostItem) {
  return typeof item.chainId === "string" ? item.chainId : undefined;
}

function withSource(items: DexBoostItem[], source: string) {
  return items.map((item) => ({
    ...item,
    source,
    sources: item.sources ?? [source],
  }));
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    throw new Error(`request_failed:${res.status}`);
  }
  return res.json() as Promise<T>;
}

function normalizeTrendingItem(item: Record<string, unknown>): DexBoostItem {
  const chainId =
    (typeof item.chainId === "string" && item.chainId) ||
    (typeof item.chain === "string" && item.chain) ||
    (typeof item.chain_id === "string" && item.chain_id) ||
    undefined;
  const tokenAddress =
    (typeof item.tokenAddress === "string" && item.tokenAddress) ||
    (typeof item.address === "string" && item.address) ||
    (typeof item.token_address === "string" && item.token_address) ||
    (typeof item.token === "string" && item.token) ||
    undefined;
  return { ...item, chainId, tokenAddress };
}

function extractTrendingItems(payload: unknown): DexBoostItem[] {
  if (Array.isArray(payload)) {
    return payload.map((item) =>
      normalizeTrendingItem(item as Record<string, unknown>)
    );
  }
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    const keys = ["data", "items", "tokens", "result"];
    for (const key of keys) {
      const value = obj[key];
      if (Array.isArray(value)) {
        return value.map((item) =>
          normalizeTrendingItem(item as Record<string, unknown>)
        );
      }
      if (value && typeof value === "object") {
        const nested = value as Record<string, unknown>;
        const nestedKeys = ["tokens", "items", "data", "result"];
        for (const nestedKey of nestedKeys) {
          const nestedValue = nested[nestedKey];
          if (Array.isArray(nestedValue)) {
            return nestedValue.map((item) =>
              normalizeTrendingItem(item as Record<string, unknown>)
            );
          }
        }
      }
    }
  }
  return [];
}

async function fetchTrendingTokens(
  chainId: string,
  page = 0,
  pageSize = 100
) {
  const url = new URL(TRENDING_URL);
  url.searchParams.set("chain", chainId);
  url.searchParams.set("current_page", String(page));
  url.searchParams.set("page_size", String(pageSize));
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { "X-API-KEY": AVE_API_KEY },
  });
  if (!res.ok) {
    throw new Error(`request_failed:${res.status}`);
  }
  const payload = (await res.json()) as unknown;
  return extractTrendingItems(payload);
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
  const h24 = typeof priceChange.h24 === "number" ? priceChange.h24 : undefined;
  
  if (m5 !== undefined || h1 !== undefined || h24 !== undefined) {
    return { m5, h1, h24 };
  }
  return undefined;
}

function extractAvePriceChange(token: DexBoostItem) {
  const m5Raw = token.token_price_change_5m;
  const h1Raw = token.token_price_change_1h;
  const h24Raw = token.token_price_change_24h;
  const m5 = typeof m5Raw === "number" ? m5Raw : Number(m5Raw);
  const h1 = typeof h1Raw === "number" ? h1Raw : Number(h1Raw);
  const h24 = typeof h24Raw === "number" ? h24Raw : Number(h24Raw);
  if (
    Number.isFinite(m5) ||
    Number.isFinite(h1) ||
    Number.isFinite(h24)
  ) {
    return {
      m5: Number.isFinite(m5) ? m5 : undefined,
      h1: Number.isFinite(h1) ? h1 : undefined,
      h24: Number.isFinite(h24) ? h24 : undefined,
    };
  }
  return undefined;
}

function formatIconUrl(icon?: unknown) {
  if (typeof icon !== "string" || icon.trim() === "") return undefined;
  const CDN_BASE = "https://cdn.dexscreener.com/cms/images";
  // 如果icon已经是完整URL，直接返回
  if (icon.startsWith('http://') || icon.startsWith('https://')) {
    return icon;
  }
  return `${CDN_BASE}/${icon}?width=800&height=800&quality=90`;
}

function formatHeaderUrl(header?: unknown) {
  if (typeof header !== "string") return undefined;
  return header.includes("?") ? header : header;
}

function extractAveLinks(appendix: unknown) {
  if (typeof appendix !== "string" || appendix.trim() === "") return undefined;
  try {
    const parsed = JSON.parse(appendix) as Record<string, unknown>;
    const links: Array<{ url: string; type?: string; label?: string }> = [];
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value.trim() !== "") {
        links.push({ url: value, type: key, label: key });
      }
    }
    return links.length > 0 ? links : undefined;
  } catch {
    return undefined;
  }
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

  const limit = clampLimit(req.query.limit, 150);
  const filterChainId = 
    typeof req.query.chainId === "string" ? req.query.chainId.toLowerCase() : undefined;
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

  try {
    // 同时获取四个接口的数据
    const [profiles, ads, boostsLatest, boostsTop, trendingTokens] =
      await Promise.all([
      fetchJson<DexBoostItem[]>(TOKEN_PROFILES_URL).catch(() => []),
      fetchJson<DexBoostItem[]>(ADS_LATEST_URL).catch(() => []),
      fetchJson<DexBoostItem[]>(BOOSTS_LATEST_URL).catch(() => []),
      fetchJson<DexBoostItem[]>(BOOSTS_TOP_URL).catch(() => []),
      filterChainId
        ? fetchTrendingTokens(filterChainId, 0, Math.min(limit, 100)).catch(
            () => []
          )
        : Promise.resolve([]),
    ]);

    // 合并所有数据并去重（根据 chainId + tokenAddress）
  const allTokens = [
      ...withSource(profiles, "dexscreener_profiles"),
      ...withSource(ads, "dexscreener_ads"),
      ...withSource(boostsLatest, "dexscreener_boosts_latest"),
      ...withSource(boostsTop, "dexscreener_boosts_top"),
      ...withSource(trendingTokens, "ave_trending"),
    ];
    const uniqueMap = new Map<string, DexBoostItem>();
    for (const token of allTokens) {
      const chainId = extractChainId(token);
      const tokenAddress = token.tokenAddress;
      if (chainId && tokenAddress) {
        // 如果指定了 chainId 筛选，则只保留匹配的
        if (filterChainId && chainId.toLowerCase() !== filterChainId) {
          continue;
        }
        const key = `${chainId}:${tokenAddress}`;
        const existing = uniqueMap.get(key);
        if (!existing) {
          uniqueMap.set(key, token);
        } else {
          const sources = new Set<string>();
          if (Array.isArray(existing.sources)) {
            existing.sources.forEach((s) => sources.add(s));
          } else if (typeof existing.source === "string") {
            sources.add(existing.source);
          }
          if (Array.isArray(token.sources)) {
            token.sources.forEach((s) => sources.add(s));
          } else if (typeof token.source === "string") {
            sources.add(token.source);
          }
          existing.sources = Array.from(sources);
          existing.source = existing.sources[0];
        }
      }
    }

    const uniqueTokens = Array.from(uniqueMap.values());
    
    // 调试：检查原始数据中有多少包含icon字段
    const tokensWithIcon = uniqueTokens.filter(t => t.icon && typeof t.icon === 'string').length;
    console.log(`[API] 📷 原始数据: 总数=${uniqueTokens.length}, 包含icon字段=${tokensWithIcon}`);
    
    const itemsWithDetails: Array<{
      chainId: string;
      tokenAddress: string;
      label?: string;
      symbol?: string;
      name?: string;
      marketCap?: number;
      pairAddress?: string;
      pairCreatedAt?: number;
      priceChange?: { m5?: number; h1?: number; h24?: number };
      score?: number;
      url?: string;
      headerImageUrl?: string;
      iconUrl?: string;
      claimDate?: string;
      links?: Array<{ url: string; type?: string; label?: string }>;
      error?: string;
      source?: string;
      sources?: string[];
    }> = [];

    for (const token of uniqueTokens) {
      const chainId = extractChainId(token);
      let marketCap: number | undefined;
      let pairAddress: string | undefined;
      let pairCreatedAt: number | undefined;
      let priceChange: { m5?: number; h1?: number; h24?: number } | undefined;
      let label: string | undefined;
      let symbol: string | undefined;
      let name: string | undefined;
      let error: string | undefined;
      let iconFromPair: string | undefined;

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
            pairCreatedAt =
              typeof pair.pairCreatedAt === "number"
                ? pair.pairCreatedAt
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
            
            // 尝试从多个地方获取图片
            // 1. 从pair的info中获取
            const info = pair.info as Record<string, unknown> | undefined;
            if (info && typeof info.imageUrl === "string") {
              iconFromPair = info.imageUrl;
            }
            
            // 2. 从pair的profile中获取
            if (!iconFromPair) {
              const profile = pair.profile as Record<string, unknown> | undefined;
              if (profile && typeof profile.icon === "string") {
                iconFromPair = formatIconUrl(profile.icon);
              }
            }
            
            // 3. 从baseToken中获取
            if (!iconFromPair && baseToken) {
              if (typeof baseToken.logo === "string") {
                iconFromPair = baseToken.logo;
              } else if (typeof baseToken.image === "string") {
                iconFromPair = baseToken.image;
              }
            }
          } else {
            error = "pair_not_found";
          }
        } else {
          error = "missing_chain_or_token";
        }
      } catch (err) {
        error = err instanceof Error ? err.message : "pair_fetch_failed";
      }

      if (Array.isArray(token.sources) && token.sources.includes("ave_trending")) {
        const avePriceChange = extractAvePriceChange(token);
        if (avePriceChange) {
          priceChange = avePriceChange;
        }
      }

      const url = typeof token.url === "string" ? token.url : undefined;
      const score =
        typeof token.totalAmount === "number" ? token.totalAmount : undefined;
      const claimDate =
        typeof token.claimDate === "string" ? token.claimDate : undefined;

      // 图片优先级：token.icon > pair的imageUrl
      const isAveOnly =
        Array.isArray(token.sources) &&
        token.sources.length === 1 &&
        token.sources[0] === "ave_trending";
      const aveLogo =
        isAveOnly && typeof token.logo_url === "string"
          ? token.logo_url
          : undefined;
      const finalIcon = aveLogo || formatIconUrl(token.icon) || iconFromPair;
      const aveLinks = isAveOnly ? extractAveLinks(token.appendix) : undefined;

      itemsWithDetails.push({
        chainId: chainId!,
        tokenAddress: token.tokenAddress!,
        label,
        symbol,
        name,
        marketCap,
        pairAddress,
        pairCreatedAt,
        priceChange,
        score,
        url,
        headerImageUrl: formatHeaderUrl(token.header),
        iconUrl: finalIcon,
        claimDate,
        links: aveLinks ?? (Array.isArray(token.links) ? token.links : undefined),
        source: typeof token.source === "string" ? token.source : undefined,
        sources: Array.isArray(token.sources) ? token.sources : undefined,
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

    // 调试信息：统计图片情况
    const withIcon = rankedItems.filter(item => item.iconUrl && item.iconUrl.trim() !== '').length;
    const withoutIcon = rankedItems.length - withIcon;
    console.log(`[API] 📊 返回数据: 总数=${rankedItems.length}, 有图片=${withIcon}, 无图片=${withoutIcon}`);
    
    // 打印前3个无图片的代币信息供调试
    const noIconItems = rankedItems.filter(item => !item.iconUrl || item.iconUrl.trim() === '').slice(0, 3);
    if (noIconItems.length > 0) {
      console.log('[API] 🔍 无图片的代币示例:');
      noIconItems.forEach(item => {
        console.log(`  - ${item.symbol} (${item.chainId}): ${item.tokenAddress}`);
      });
    }

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
