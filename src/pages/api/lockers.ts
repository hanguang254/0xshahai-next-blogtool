import type { NextApiRequest, NextApiResponse } from "next";

// TokenDepositLocked(address indexed user, address indexed token, uint256 amount, uint256 unlockTime)
const TOPIC_TOKEN_DEPOSIT_LOCKED =
  '0x948e91fbf5fd635cd335616dba98fe16315097ff4b4935f2473bfba33f462725';

const CHAINBASE_API_KEY = '38HqF3yzT2k3GPnGF5tBCoDmnRQ';
const CHAINBASE_ENDPOINT = 'https://api.chainbase.online/v1';

// 两条链使用相同的合约地址
const WALLET_CONTRACT = '0x344f1c033Ee37860eEe2CA2873320e08c3fc21c9';

// 单次 eth_getLogs 允许的最大区块跨度（BSC 公共节点普遍限制 10000）
const MAX_BLOCK_SPAN = 9000;

type NetworkConfig = {
  chainId: number;
  rpcUrl: string;
  // 该链的 RPC 是否支持 fromBlock=0 的全量日志查询
  supportsFullRangeLogs: boolean;
};

const NETWORKS: Record<string, NetworkConfig> = {
  bsc: {
    chainId: 56,
    rpcUrl: 'https://api.zan.top/node/v1/bsc/mainnet/e7f93263291b4a79a83a9b5c0fe72048',
    supportsFullRangeLogs: false,
  },
  robinhood: {
    chainId: 4663,
    rpcUrl: 'https://rpc.mainnet.chain.robinhood.com',
    supportsFullRangeLogs: true,
  },
};

// 带超时的 JSON-RPC 调用
async function rpcCall(rpcUrl: string, method: string, params: any[], timeoutMs = 15000): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    });

    const json = await response.json();
    if (json.error) {
      throw new Error(json.error.message || 'rpc_error');
    }
    return json.result;
  } finally {
    clearTimeout(timeoutId);
  }
}

// 从 32 字节 topic 中取出地址
function topicToAddress(topic: string): string {
  return `0x${topic.slice(-40)}`;
}

function toHexBlock(value: number | 'latest'): string {
  return value === 'latest' ? 'latest' : `0x${value.toString(16)}`;
}

// 拉取合约在该链上的全部交易，得到「有活动的区块号」集合。
// 锁仓事件只可能出现在这些区块里，用它把日志扫描范围压到极小。
async function fetchContractActivityBlocks(chainId: number, contract: string): Promise<number[]> {
  const blocks = new Set<number>();
  let page = 1;
  const MAX_PAGES = 20; // 最多 2000 条交易，防止无限翻页

  while (page <= MAX_PAGES) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let json: any;
    try {
      const response = await fetch(
        `${CHAINBASE_ENDPOINT}/account/txs?chain_id=${chainId}&address=${contract}&limit=100&page=${page}`,
        {
          headers: { 'x-api-key': CHAINBASE_API_KEY, accept: 'application/json' },
          signal: controller.signal,
        }
      );
      json = await response.json();
    } finally {
      clearTimeout(timeoutId);
    }

    if (json?.code !== 0) {
      throw new Error(json?.message || 'chainbase_error');
    }

    const txs: any[] = json.data || [];
    for (const tx of txs) {
      if (typeof tx.block_number === 'number') blocks.add(tx.block_number);
    }

    if (!json.next_page || txs.length === 0) break;
    page = json.next_page;

    // Chainbase 有每秒信用额度限制，翻页之间稍作等待
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return Array.from(blocks).sort((a, b) => a - b);
}

// 把区块号合并成尽可能少的查询区间
function mergeIntoRanges(blocks: number[]): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (const block of blocks) {
    const last = ranges[ranges.length - 1];
    if (last && block - last[0] <= MAX_BLOCK_SPAN) {
      last[1] = block;
    } else {
      ranges.push([block, block]);
    }
  }
  return ranges;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { network = 'bsc', token } = req.query;

  if (!token || typeof token !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(token)) {
    return res.status(400).json({ error: 'invalid_token_address' });
  }

  const config = NETWORKS[network as string];
  if (!config) {
    return res.status(400).json({ error: 'invalid_network' });
  }

  // 事件第二个 indexed 参数是 token，按它过滤
  const tokenTopic = `0x${'0'.repeat(24)}${token.slice(2).toLowerCase()}`;

  res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=60');

  try {
    let logs: any[] = [];
    let source: string;

    if (config.supportsFullRangeLogs) {
      // RPC 支持全量查询，一次搞定
      logs = await rpcCall(config.rpcUrl, 'eth_getLogs', [
        {
          address: WALLET_CONTRACT,
          topics: [TOPIC_TOKEN_DEPOSIT_LOCKED, null, tokenTopic],
          fromBlock: toHexBlock(0),
          toBlock: toHexBlock('latest'),
        },
      ]);
      source = 'rpc-full-range';
    } else {
      // RPC 限制区块跨度：先用交易历史定位有活动的区块，再按区间查日志
      const activityBlocks = await fetchContractActivityBlocks(config.chainId, WALLET_CONTRACT);

      if (activityBlocks.length === 0) {
        return res.status(200).json({ network, token, users: [], source: 'rpc-ranged', ranges: 0 });
      }

      const ranges = mergeIntoRanges(activityBlocks);

      for (const [fromBlock, toBlock] of ranges) {
        const rangeLogs = await rpcCall(config.rpcUrl, 'eth_getLogs', [
          {
            address: WALLET_CONTRACT,
            topics: [TOPIC_TOKEN_DEPOSIT_LOCKED, null, tokenTopic],
            fromBlock: toHexBlock(fromBlock),
            toBlock: toHexBlock(toBlock),
          },
        ]);
        logs = logs.concat(rangeLogs || []);
      }
      source = 'rpc-ranged';
    }

    // topics[1] 是 user，按小写去重
    const seen = new Set<string>();
    const users: string[] = [];
    for (const log of logs) {
      const userTopic = log?.topics?.[1];
      if (!userTopic) continue;
      const user = topicToAddress(userTopic).toLowerCase();
      if (seen.has(user)) continue;
      seen.add(user);
      users.push(user);
    }

    return res.status(200).json({
      network,
      token,
      users,
      count: users.length,
      source,
    });
  } catch (err) {
    console.error('扫描锁仓用户失败:', err);
    const message = err instanceof Error ? err.message : 'scan_failed';
    return res.status(502).json({ error: message });
  }
}
