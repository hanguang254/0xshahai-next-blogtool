import type { NextApiRequest, NextApiResponse } from "next";

type TokenBalance = {
  contractAddress: string;
  symbol: string;
  decimals: number;
  balance: string;
  amount: string;
  balanceValue: string;
  marketCap: string;
  priceChange24h: string;
};

const CHAINBASE_API_KEY = '38HqF3yzT2k3GPnGF5tBCoDmnRQ';
const CHAINBASE_ENDPOINT = 'https://api.chainbase.online/v1';
const CHAIN_ID = '56'; // BSC
const REQUEST_INTERVAL = 200; // 200ms 间隔

// 格式化十六进制余额为十进制字符串
function formatHexBalance(hexBalance: string, decimals: number): string {
  try {
    if (!hexBalance || hexBalance === '0x0' || hexBalance === '0x') return '0';
    const balanceBigInt = BigInt(hexBalance);
    const divisor = BigInt(10 ** decimals);
    const wholePart = balanceBigInt / divisor;
    const fractionalPart = balanceBigInt % divisor;
    
    if (fractionalPart === BigInt(0)) {
      return wholePart.toString();
    }
    
    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    const trimmedFractional = fractionalStr.replace(/0+$/, '');
    const num = Number(wholePart) + Number('0.' + trimmedFractional);
    
    const abs = Math.abs(num);
    const maxFraction = abs > 1 ? 4 : 8;
    return num.toLocaleString(undefined, { maximumFractionDigits: maxFraction });
  } catch (err) {
    console.error('格式化余额失败:', err);
    return '0';
  }
}

// 市值格式化（使用 K、M、B、T 单位）
function formatMarketCap(value: number): string {
  try {
    if (value == null || isNaN(value)) return 'N/A';
    
    const abs = Math.abs(value);
    
    if (abs >= 1e12) {
      return `$${(value / 1e12).toFixed(2)}T`;
    }
    if (abs >= 1e9) {
      return `$${(value / 1e9).toFixed(2)}B`;
    }
    if (abs >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`;
    }
    if (abs >= 1e3) {
      return `$${(value / 1e3).toFixed(2)}K`;
    }
    return `$${value.toFixed(2)}`;
  } catch (err) {
    return 'N/A';
  }
}

// 获取代币市值、价格和涨跌幅
async function fetchTokenMarketData(
  contractAddress: string,
  delay: number = 0
): Promise<{ priceUsd: number | null; marketCap: number | null; priceChange24h: number | null }> {
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`,
      {
        method: 'GET',
        headers: {
          'accept': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      return { priceUsd: null, marketCap: null, priceChange24h: null };
    }
    
    const json = await response.json();
    const pairs = json.pairs || [];
    const bscPair = pairs.find((pair: any) => pair.chainId === 'bsc') || pairs[0];
    
    if (!bscPair) {
      return { priceUsd: null, marketCap: null, priceChange24h: null };
    }
    
    const priceUsd = bscPair.priceUsd ? parseFloat(bscPair.priceUsd) : null;
    const marketCap = bscPair.marketCap || bscPair.fdv || null;
    const priceChange24h = bscPair.priceChange?.h24 || null;
    
    return { priceUsd, marketCap, priceChange24h };
  } catch (err) {
    console.error(`获取市场数据错误 ${contractAddress}:`, err);
    return { priceUsd: null, marketCap: null, priceChange24h: null };
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { address } = req.query;

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'address_required' });
  }

  // 验证地址格式
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return res.status(400).json({ error: 'invalid_address' });
  }

  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  try {
    // 第一步：获取代币列表
    const tokensResponse = await fetch(
      `${CHAINBASE_ENDPOINT}/account/tokens?chain_id=${CHAIN_ID}&address=${address}&limit=100&page=1`,
      {
        method: 'GET',
        headers: {
          'x-api-key': CHAINBASE_API_KEY,
          'accept': 'application/json'
        }
      }
    );

    if (!tokensResponse.ok) {
      throw new Error(`Chainbase API 返回错误: ${tokensResponse.statusText}`);
    }

    const tokensJson = await tokensResponse.json();
    const tokensData = tokensJson.data || [];

    if (!Array.isArray(tokensData) || tokensData.length === 0) {
      return res.status(200).json({
        address,
        count: 0,
        tokens: []
      });
    }

    // 第二步：为每个代币获取市值和涨跌幅数据
    const tokens: TokenBalance[] = [];
    
    for (let i = 0; i < tokensData.length; i++) {
      const token = tokensData[i];
      const contractAddress = token.contract_address || '';
      const balance = token.balance || '0x0';
      const decimals = token.decimals || 18;
      const symbol = token.symbol || token.name || 'N/A';
      
      // 格式化余额
      const amount = formatHexBalance(balance, decimals);
      
      // 获取价格、市值和涨跌幅数据（带延迟以控制 API 频率）
      const delay = i * REQUEST_INTERVAL;
      const { priceUsd, marketCap, priceChange24h } = await fetchTokenMarketData(contractAddress, delay);
      
      // 计算余额价值（代币数量 × 单价）
      const amountNum = parseFloat((amount || '0').replace(/,/g, ''));
      const balanceValueUsd = priceUsd && amountNum > 0 ? amountNum * priceUsd : 0;
      const balanceValueFormatted = balanceValueUsd > 0
        ? formatMarketCap(balanceValueUsd)
        : '$0.00';
      
      // 格式化市值
      const marketCapFormatted = marketCap && marketCap > 0
        ? formatMarketCap(marketCap)
        : 'N/A';
      
      // 格式化涨跌幅
      const priceChange24hFormatted = priceChange24h != null
        ? `${priceChange24h >= 0 ? '+' : ''}${priceChange24h.toFixed(2)}%`
        : 'N/A';

      tokens.push({
        contractAddress,
        symbol,
        decimals,
        balance,
        amount: amount || '0',
        balanceValue: balanceValueFormatted,
        marketCap: marketCapFormatted,
        priceChange24h: priceChange24hFormatted,
      });
    }

    return res.status(200).json({
      address,
      count: tokens.length,
      tokens
    });
  } catch (err) {
    console.error('获取余额数据失败:', err);
    const message = err instanceof Error ? err.message : 'fetch_failed';
    return res.status(502).json({ error: message });
  }
}
