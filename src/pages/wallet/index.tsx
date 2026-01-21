import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import styles from './index.module.css'
import { Card, CardHeader, CardBody, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Button, Chip, Tooltip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Alert } from "@heroui/react";
import { Input } from "@heroui/input";
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { useWriteContract, useWaitForTransactionReceipt,useReadContract} from 'wagmi'
import { bsc } from 'wagmi/chains';
import {wallet_abi} from '../../ABI/transferwallet';
import {ERC_abi} from '../../ABI/IERC20';

import { parseUnits, formatUnits, encodeFunctionData } from 'viem'

// 复制图标 SVG
const CopyIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M13.3333 6H7.33333C6.59695 6 6 6.59695 6 7.33333V13.3333C6 14.0697 6.59695 14.6667 7.33333 14.6667H13.3333C14.0697 14.6667 14.6667 14.0697 14.6667 13.3333V7.33333C14.6667 6.59695 14.0697 6 13.3333 6Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3.33333 10H2.66667C2.31305 10 1.97391 9.85952 1.72386 9.60947C1.47381 9.35942 1.33333 9.02028 1.33333 8.66667V2.66667C1.33333 2.31305 1.47381 1.97391 1.72386 1.72386C1.97391 1.47381 2.31305 1.33333 2.66667 1.33333H8.66667C9.02028 1.33333 9.35942 1.47381 9.60947 1.72386C9.85952 1.97391 10 2.31305 10 2.66667V3.33333"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

interface Token {
  contractAddress: string;
  amount: string;
  balanceValue: string;
  marketCap: string;
  priceChange24h: string;
  canTransfer: boolean;
  symbol?: string;
  decimals?: number;
}

export default function Wallet() {
  // 客户端检查，避免 SSR hydration 错误
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { address, isConnected } = useAccount();
  const [copied, setCopied] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const { isOpen: isWithdrawOpen, onOpen: onWithdrawOpen, onOpenChange: onWithdrawOpenChange } = useDisclosure();
  const { isOpen: isLockOpen, onOpen: onLockOpen, onOpenChange: onLockOpenChange } = useDisclosure();
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [lockTokenAddress, setLockTokenAddress] = useState<string>('');
  const [lockTokenDecimals, setLockTokenDecimals] = useState<string>('18');
  const [countdown, setCountdown] = useState<number>(0); // 倒计时状态

  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  // Alert 状态
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [alertVariant, setAlertVariant] = useState<'primary' | 'success' | 'danger' | 'warning'>('primary');
  
  // 锁仓天数
  const [lockDays, setLockDays] = useState<string>('7');

  // 静态显示的合约钱包地址
  const CONTRACT_ADDRESS = '0x344f1c033Ee37860eEe2CA2873320e08c3fc21c9';
  const {
    data: ownerAddress, isPending: isOwnerPending, error: ownerError
  } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: wallet_abi,
    functionName: 'owner',
  })
  const OWNER_ADDRESS = ownerAddress;
  // const MAX_UINT256 = (1n << 256n) - 1n;
  const MAX_UINT256 = parseUnits('115792089237316195423570985008687907853269984665640564039457584007913129639935', 0);

  // Chainbase API 配置
  const CHAINBASE_API_KEY = '38HqF3yzT2k3GPnGF5tBCoDmnRQ';
  const CHAINBASE_ENDPOINT = 'https://api.chainbase.online/v1';
  // BSC 链 ID (根据 Chainbase 文档，BSC 的 chain_id 是 56)
  const CHAIN_ID = '56';
  // DexScreener API 请求频率限制：每分钟300次 = 每秒5次 = 每200ms一次
  // 设置为 250ms 以保留安全边际
  const REQUEST_INTERVAL = 250;

  // 代币列表（由 Chainbase 接口获取）
  const [tokens, setTokens] = useState<Token[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState<boolean>(false);
  const [tokensError, setTokensError] = useState<string | null>(null);
  const isFirstLoadRef = useRef<boolean>(true); // 使用 ref 标记是否首次加载，避免闭包问题

  // 通用数量格式化（处理小数、科学计数法等）
  const formatAmount = (raw: any) => {
    try {
      if (raw == null) return '0';
      const num = Number(raw);
      if (Number.isNaN(num)) return String(raw);
      const abs = Math.abs(num);
      const maxFraction = abs > 1 ? 4 : 8;
      const formatted = num.toLocaleString(undefined, { maximumFractionDigits: maxFraction });
      return formatted;
    } catch (err) {
      return String(raw);
    }
  };

  // 市值格式化（使用 K、M、B、T 单位）
  const formatMarketCap = (value: number): string => {
    try {
      if (value == null || isNaN(value)) return 'N/A';
      
      const abs = Math.abs(value);
      
      // 万亿 (Trillion)
      if (abs >= 1e12) {
        return `$${(value / 1e12).toFixed(2)}T`;
      }
      // 十亿 (Billion)
      if (abs >= 1e9) {
        return `$${(value / 1e9).toFixed(2)}B`;
      }
      // 百万 (Million)
      if (abs >= 1e6) {
        return `$${(value / 1e6).toFixed(2)}M`;
      }
      // 千 (Thousand)
      if (abs >= 1e3) {
        return `$${(value / 1e3).toFixed(2)}K`;
      }
      // 小于 1000，直接显示
      return `$${value.toFixed(2)}`;
    } catch (err) {
      return 'N/A';
    }
  };

  // 将十六进制余额转换为格式化的十进制字符串
  const formatHexBalance = (hexBalance: string, decimals: number): string => {
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
  };

  // 获取代币市值、价格和涨跌幅（使用 DexScreener API）
  const fetchTokenMarketData = async (contractAddress: string, delay: number = 0): Promise<{ priceUsd: number | null; marketCap: number | null; priceChange24h: number | null }> => {
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    try {
      // DexScreener API: bsc 链的 chainId 是 'bsc'
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
        console.error(`获取市场数据失败 ${contractAddress}:`, response.statusText);
        return { priceUsd: null, marketCap: null, priceChange24h: null };
      }
      
      const json = await response.json();
      
      // DexScreener 返回的是交易对列表，我们取第一个 BSC 链上的交易对
      const pairs = json.pairs || [];
      const bscPair = pairs.find((pair: any) => pair.chainId === 'bsc') || pairs[0];
      
      if (!bscPair) {
        console.warn(`未找到交易对数据 ${contractAddress}`);
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
  };

  // 从 Chainbase 拉取指定钱包的 ERC20 代币余额和价格
  useEffect(() => {
    // 确保只在客户端执行
    if (typeof window === 'undefined') return;
    
    let mounted = true;

    const fetchBalances = async () => {
      if (!CONTRACT_ADDRESS) return;
      try {
        if (mounted) {
          // 只在首次加载时显示加载状态
          if (isFirstLoadRef.current) {
            setIsLoadingTokens(true);
          }
          setTokensError(null);
        }

        // 第一步：获取代币列表
        const tokensResponse = await fetch(
          `${CHAINBASE_ENDPOINT}/account/tokens?chain_id=${CHAIN_ID}&address=${CONTRACT_ADDRESS}&limit=100&page=1`,
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
          if (mounted) {
            setTokens([]);
            setIsLoadingTokens(false);
            // 首次加载完成后，标记为非首次加载
            isFirstLoadRef.current = false;
          }
          return;
        }

        // 第二步：为每个代币获取市值和涨跌幅数据
        // DexScreener API 限制：每分钟 300 次请求，设置为每 250ms 一次（每秒 4 次）
        const mapped: Token[] = [];
        for (let i = 0; i < tokensData.length; i++) {
          const token = tokensData[i];
          const contractAddress = token.contract_address || '';
          const balance = token.balance || '0x0';
          const decimals = token.decimals || 18;
          const symbol = token.symbol || token.name || 'N/A';
          
          // 格式化余额
          const amount = formatHexBalance(balance, decimals);
          
          // 获取价格、市值和涨跌幅数据（带延迟以控制 API 频率）
          const delay = i * REQUEST_INTERVAL; // 第一个请求立即执行，后续逐步延迟
          const { priceUsd, marketCap, priceChange24h } = await fetchTokenMarketData(contractAddress, delay);
          
          // 计算余额价值（代币数量 × 单价）
          const amountNum = parseFloat((amount || '0').replace(/,/g, '')); // 去掉格式化的逗号
          const balanceValueUsd = priceUsd && amountNum > 0 ? amountNum * priceUsd : 0;
          const balanceValueFormatted = balanceValueUsd > 0
            ? formatMarketCap(balanceValueUsd)
            : '$0.00';
          
          // 格式化市值（使用 K、M、B、T 单位）
          const marketCapFormatted = marketCap && marketCap > 0
            ? formatMarketCap(marketCap)
            : 'N/A';
          
          // 格式化涨跌幅
          const priceChange24hFormatted = priceChange24h != null
            ? `${priceChange24h >= 0 ? '+' : ''}${priceChange24h.toFixed(2)}%`
            : 'N/A';

          mapped.push({
            contractAddress,
            amount: amount || '0',
            balanceValue: balanceValueFormatted,
            marketCap: marketCapFormatted,
            priceChange24h: priceChange24hFormatted,
            canTransfer: true, // 默认可转出，后续会根据unlockTime更新
            symbol,
            decimals
          });
        }

        if (mounted) {
          setTokens(mapped);
        }
      } catch (err) {
        if ((err as any)?.name === 'AbortError') return;
        console.error('Fetch Chainbase error:', err);
        if (mounted) {
          setTokensError('无法从 Chainbase 获取代币数据');
          setTokens([]);
        }
      } finally {
        if (mounted) {
          setIsLoadingTokens(false);
          // 首次加载完成后，标记为非首次加载
          isFirstLoadRef.current = false;
        }
      }
    };

    // 首次立即拉取，然后每60秒轮询一次
    fetchBalances();
    const intervalId = setInterval(fetchBalances, 60000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [CONTRACT_ADDRESS]);

  // 存储每个代币的锁定状态（true=已锁定，false=未锁定）
  const [tokenLockStatus, setTokenLockStatus] = useState<Record<string, boolean>>({});

  // 使用自定义的高速 RPC 节点
  const BSC_RPC_URL = 'https://bnb-mainnet.g.alchemy.com/v2/cx_UaSly_yEW7f3t3jAEy';

  // 查询每个代币的锁定状态
  useEffect(() => {
    if (!address || tokens.length === 0) return;

    const fetchLockStatus = async () => {
      const statusMap: Record<string, boolean> = {};

      // console.log('🔍 开始查询代币锁定状态...');
      // console.log('📍 合约地址:', CONTRACT_ADDRESS);
      // console.log('👤 用户地址:', address);
      // console.log('🪙 代币数量:', tokens.length);
      // console.log('🚀 使用 RPC:', BSC_RPC_URL);

      // 使用并发查询提高速度，每批处理 5 个
      const batchSize = 5;
      const batches: Token[][] = [];
      
      for (let i = 0; i < tokens.length; i += batchSize) {
        batches.push(tokens.slice(i, i + batchSize));
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        // 并发查询当前批次的所有代币
        await Promise.all(batch.map(async (token, tokenIndex) => {
          const globalIndex = batchIndex * batchSize + tokenIndex;
          
          try {
            // 使用 viem 编码调用数据，确保正确性
            const callData = encodeFunctionData({
              abi: wallet_abi,
              functionName: 'getTokenLockInfo',
              args: [address as `0x${string}`, token.contractAddress as `0x${string}`]
            });

            // console.log(`\n📝 查询代币 ${globalIndex + 1}/${tokens.length}: ${token.symbol || 'Unknown'}`);
            // console.log('   代币地址:', token.contractAddress);
            
            // 使用自定义的高速 RPC
            const response = await fetch(BSC_RPC_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: globalIndex + 1,
                method: 'eth_call',
                params: [
                  {
                    to: CONTRACT_ADDRESS,
                    data: callData,
                  },
                  'latest',
                ],
              }),
            });

            const result = await response.json();
            
            // 检查是否有错误
            if (result.error) {
              console.error('   ❌ RPC 错误:', result.error);
              statusMap[token.contractAddress.toLowerCase()] = false;
              return;
            }
            
            if (result.result && result.result !== '0x') {
              console.log('   ✅ 返回数据长度:', result.result.length);
              
              if (result.result.length >= 258) {
                // 解析返回值
                // 返回值格式: (uint256 unlockTimestamp, bool isLocked, uint256 remainingTime, uint256 lockedAmount)
                const data = result.result.slice(2); // 去掉 0x
                
                // 解析 isLocked 字段（第二个 32 字节）
                const isLockedHex = data.slice(64, 128);
                const isLocked = parseInt(isLockedHex, 16) === 1;
                
                // 存储锁定状态：true=已锁定，false=未锁定
                statusMap[token.contractAddress.toLowerCase()] = isLocked;
                
                console.log(`   🎯 状态: ${isLocked ? '🔒 已锁定' : '✅ 未锁定'}`);
              } else {
                console.log('   ⚠️ 返回数据长度不足:', result.result.length);
                statusMap[token.contractAddress.toLowerCase()] = false;
              }
            } else {
              console.log('   ⚠️ 返回结果为空');
              statusMap[token.contractAddress.toLowerCase()] = false;
            }
          } catch (err) {
            console.error(`   ❌ 查询异常:`, err);
            statusMap[token.contractAddress.toLowerCase()] = false;
          }
        }));

        // 批次之间稍微延迟，避免过快
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      console.log('\n✅ 查询完成，状态汇总:');
      console.log(statusMap);
      setTokenLockStatus(statusMap);
    };

    fetchLockStatus();
  }, [tokens, address]);

  // 更新代币列表，根据锁定状态设置 canTransfer
  // tokenLockStatus: true=已锁定，false=未锁定
  // canTransfer: true=可转出，false=不可转出
  const tokensWithTransferStatus = useMemo(() => {
    return tokens.map(token => {
      const isLocked = tokenLockStatus[token.contractAddress.toLowerCase()];
      // 如果没有查询到锁定状态，默认为未锁定（可转出）
      const canTransfer = isLocked === undefined ? true : !isLocked;
      return {
        ...token,
        canTransfer
      };
    });
  }, [tokens, tokenLockStatus]);

  // 搜索过滤代币列表
  const filteredTokens = useMemo(() => {
    try {
      // 如果没有搜索查询，返回所有代币
      if (!searchQuery || !searchQuery.trim()) {
        return tokensWithTransferStatus;
      }
      
      const trimmedQuery = searchQuery.trim();
      if (!trimmedQuery) {
        return tokensWithTransferStatus;
      }
      
      const query = trimmedQuery.toLowerCase();
      
      // 安全地过滤代币
      return tokensWithTransferStatus.filter(token => {
        try {
          // 搜索合约地址
          if (token.contractAddress) {
            const address = String(token.contractAddress).toLowerCase();
            if (address.includes(query)) {
              return true;
            }
          }
          
          // 搜索代币符号
          if (token.symbol) {
            const symbol = String(token.symbol).toLowerCase().trim();
            if (symbol && symbol.includes(query)) {
              return true;
            }
          }
          
          return false;
        } catch (error) {
          console.error('搜索代币时出错:', error, token);
          return false;
        }
      });
    } catch (error) {
      console.error('搜索过滤出错:', error);
      // 如果搜索出错，返回所有代币
      return tokensWithTransferStatus;
    }
  }, [tokensWithTransferStatus, searchQuery]);

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  // 从剪贴板粘贴地址
  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && isValidAddress(text.trim())) {
        setLockTokenAddress(text.trim());
        setAlertVariant('success');
        setAlertMsg('已粘贴合约地址');
        setTimeout(() => setAlertMsg(null), 2000);
      } else {
        setAlertVariant('warning');
        setAlertMsg('剪贴板中没有有效的合约地址');
        setTimeout(() => setAlertMsg(null), 2000);
      }
    } catch (err) {
      console.error('粘贴失败:', err);
      setAlertVariant('danger');
      setAlertMsg('读取剪贴板失败，请手动粘贴');
      setTimeout(() => setAlertMsg(null), 2000);
    }
  };

  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // 验证以太坊地址格式
  const isValidAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  // 格式化倒计时时间（秒数转换为 天时分秒）
  const formatCountdown = (seconds: number): string => {
    if (seconds <= 0) return '已解锁';
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    const parts = [];
    if (days > 0) parts.push(`${days}天`);
    if (hours > 0) parts.push(`${hours}小时`);
    if (minutes > 0) parts.push(`${minutes}分钟`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}秒`);
    
    return parts.join(' ');
  };

const [lockAmount, setLockAmount] = useState<string>('')

// ERC20 approve 状态
const {
  writeContract: writeApprove,
  data: approveHash,
  isPending: isApprovePending,
  reset: resetApprove,
} = useWriteContract()

// 锁仓 tx
const {
  writeContract: writeLock,
  data: lockHash,
  isPending: isLockPending,
  reset: resetLock,
} = useWriteContract()

const { isSuccess: approveSuccess } =
  useWaitForTransactionReceipt({ hash: approveHash })

const { isSuccess: lockSuccess } =
  useWaitForTransactionReceipt({ hash: lockHash })

// 查询用户输入代币的授权额度
const {data: allowance, refetch: refetchAllowance} = useReadContract({
  address: (isValidAddress(lockTokenAddress) ? lockTokenAddress : undefined) as `0x${string}` | undefined,
  abi: ERC_abi,
  functionName: 'allowance',
  args: [address, CONTRACT_ADDRESS],
  query: {
    enabled: Boolean(address && isValidAddress(lockTokenAddress)),
    staleTime: 0,
    gcTime: 5000,
    refetchOnWindowFocus: false,
    retry: 2,
  },
})

const amountBigInt = () => {
  if (!lockAmount) return parseUnits('0', 18);
  const decimals = parseInt(lockTokenDecimals) || 18;
  return parseUnits(lockAmount, decimals);
}

  // 打开锁仓弹窗
  const handleLockDeposit = async () => {
    // 重置锁仓相关状态
    resetLock();
    resetApprove();
    hasShownLockSuccessRef.current = false;
    setAlertMsg(null);
    setLockAmount('');
    setLockDays('7');
    setLockTokenAddress('');
    setLockTokenDecimals('18');
    onLockOpen();
  };

  // 确认锁仓
  const handleLock = async () => {
    if (!lockAmount || Number(lockAmount) <= 0) {
      setAlertVariant('danger');
      setAlertMsg('请输入正确的数量');
      return;
    }
    if (!lockDays || Number(lockDays) <= 0) {
      setAlertVariant('danger');
      setAlertMsg('请输入正确的锁定天数');
      return;
    }
    if (!isValidAddress(lockTokenAddress)) {
      setAlertVariant('danger');
      setAlertMsg('请输入有效的代币地址');
      return;
    }

    // 检查网络
    if (chainId !== bsc.id) {
      try {
        switchChain({ chainId: bsc.id });
        setAlertVariant('primary');
        setAlertMsg('正在切换到 BSC 网络，请确认...');
      } catch (err) {
        console.error('切换网络失败:', err);
        setAlertVariant('danger');
        setAlertMsg('切换网络失败，请手动切换到 BSC 网络');
      }
      return;
    }

    try {
      const amount = amountBigInt();
      await writeLock({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: wallet_abi,
        functionName: 'depositlockToken',
        args: [lockTokenAddress, amount, BigInt(lockDays)],
        account: address,
      } as any);
      setAlertVariant('primary');
      setAlertMsg('锁仓交易已发送，等待确认...');
    } catch (err: any) {
      console.error(err);

      if (err?.cause?.code === 4001) {
        setAlertVariant('warning');
        setAlertMsg('用户取消了交易');
      } else {
        setAlertVariant('danger');
        setAlertMsg('锁仓交易发送失败');
      }

      resetLock();
    }
  };

// 授权逻辑
const handleApprove = async () => {
  if (!isValidAddress(lockTokenAddress)) {
    setAlertVariant('danger');
    setAlertMsg('请输入有效的代币地址');
    return;
  }

  // 检查网络
  if (chainId !== bsc.id) {
    try {
      switchChain({ chainId: bsc.id });
      setAlertVariant('primary');
      setAlertMsg('正在切换到 BSC 网络，请确认...');
    } catch (err) {
      console.error('切换网络失败:', err);
      setAlertVariant('danger');
      setAlertMsg('切换网络失败，请手动切换到 BSC 网络');
    }
    return;
  }

  try {
    await writeApprove({
      address: lockTokenAddress as `0x${string}`,
      abi: ERC_abi,
      functionName: 'approve',
      args: [CONTRACT_ADDRESS, MAX_UINT256],
    } as any);

    setAlertVariant('primary');
    setAlertMsg('已发送授权请求，请等待链上确认');
  } catch (err: any) {
    console.error(err);

    if (err?.cause?.code === 4001) {
      setAlertVariant('warning');
      setAlertMsg('用户取消了授权交易');
    } else {
      setAlertVariant('danger');
      setAlertMsg('授权交易发送失败');
    }

    resetApprove();
  }
};

// 判断是否需要授权
const needsApproval = useMemo(() => {
  if (!allowance) return true;
  const currentAllowance = BigInt(allowance as any);
  return currentAllowance <= BigInt(0);
}, [allowance]);

// 合并的授权/锁仓处理函数
const handleApproveOrLock = async () => {
  if (needsApproval) {
    // 执行授权逻辑
    await handleApprove();
  } else {
    // 执行锁仓逻辑
    await handleLock();
  }
};

useEffect(() => {
  if (approveSuccess) {
    setAlertVariant('success');
    setAlertMsg('授权交易已确认');
    // 授权成功后刷新 allowance 查询，获取最新额度
    setTimeout(() => {
      refetchAllowance();
    }, 1000); // 延迟1秒后刷新，确保链上状态已更新
  }
}, [approveSuccess, refetchAllowance]);


// 使用 ref 防止重复显示成功消息
const hasShownLockSuccessRef = useRef(false);

// 锁仓交易成功后关闭弹窗
useEffect(() => {
  if (lockSuccess && isLockOpen) {
    setLockAmount('');
    onLockOpenChange();  // 关闭弹窗
    hasShownLockSuccessRef.current = false; // 重置标记，准备显示成功消息
  }
}, [lockSuccess, isLockOpen, onLockOpenChange]);

// 当弹窗关闭后显示成功消息（使用 ref 防止重复显示）
// 只有当 lockHash 存在且弹窗已关闭时才显示成功消息
useEffect(() => {
  if (lockSuccess && !isLockOpen && !hasShownLockSuccessRef.current && lockHash) {
    setAlertVariant('success'); 
    setAlertMsg('锁仓转入交易已确认');
    hasShownLockSuccessRef.current = true;
  }
}, [lockSuccess, isLockOpen, lockHash]);





  // 查询选中代币的锁定信息
  const { data: selectedTokenLockInfo } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: wallet_abi,
    functionName: 'getTokenLockInfo',
    args: [address as `0x${string}`, selectedToken?.contractAddress as `0x${string}`],
    query: {
      enabled: Boolean(address && selectedToken?.contractAddress),
      staleTime: 0,
      gcTime: 5000,
      refetchOnWindowFocus: false,
    },
  });

  // 倒计时逻辑：每秒更新一次
  useEffect(() => {
    if (!isWithdrawOpen || !selectedTokenLockInfo) return;
    
    const [unlockTimestamp, isLocked, remainingTime, lockedAmount] = selectedTokenLockInfo as [bigint, boolean, bigint, bigint];
    
    // 只有在已锁定的情况下才需要倒计时
    if (!isLocked) return;
    
    // 初始化倒计时
    const currentTime = Math.floor(Date.now() / 1000);
    const unlockTime = Number(unlockTimestamp);
    const initialRemaining = Math.max(0, unlockTime - currentTime);
    setCountdown(initialRemaining);
    
    // 启动倒计时定时器
    const timer = setInterval(() => {
      setCountdown(prev => {
        const newValue = prev - 1;
        if (newValue <= 0) {
          clearInterval(timer);
          return 0;
        }
        return newValue;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isWithdrawOpen, selectedTokenLockInfo]);

  // 判断选中的代币是否可以提取
  const canWithdrawSelectedToken = useMemo(() => {
    if (!selectedTokenLockInfo) return false; // 没有锁定信息，不允许提取
    
    // selectedTokenLockInfo 返回: [unlockTimestamp, isLocked, remainingTime, lockedAmount]
    const [unlockTimestamp, isLocked, remainingTime, lockedAmount] = selectedTokenLockInfo as [bigint, boolean, bigint, bigint];
    
    // 关键检查：必须有锁定记录（lockedAmount > 0）
    // 合约要求：只能提取通过 depositlockToken 锁仓的代币
    if (lockedAmount === BigInt(0)) {
      return false; // 没有锁定记录，无法提取
    }
    
    // 如果未锁定（已经完全解锁），可以提取
    if (!isLocked) return true;
    
    // 如果已锁定，检查是否已到解锁时间
    const currentTime = Math.floor(Date.now() / 1000);
    const unlockTime = Number(unlockTimestamp);
    
    return currentTime >= unlockTime;
  }, [selectedTokenLockInfo]);
  
  // 获取不能提取的原因
  const withdrawDisabledReason = useMemo(() => {
    if (!selectedToken) return null;
    if (!selectedTokenLockInfo) return '正在查询锁定信息...';
    
    const [unlockTimestamp, isLocked, remainingTime, lockedAmount] = selectedTokenLockInfo as [bigint, boolean, bigint, bigint];
    
    // 没有锁定记录
    if (lockedAmount === BigInt(0)) {
      return '该代币没有通过锁仓功能存入，无法提取。只能提取通过"锁仓转入"功能存入的代币。';
    }
    
    // 仍在锁定期内
    if (isLocked) {
      const currentTime = Math.floor(Date.now() / 1000);
      const unlockTime = Number(unlockTimestamp);
      if (currentTime < unlockTime) {
        return '该代币仍在锁定期内，未到解锁时间。';
      }
    }
    
    return null; // 可以提取
  }, [selectedToken, selectedTokenLockInfo]);

  // 发起提取
  const handleWithdraw = () => {
    if (tokens.length === 0) {
      setAlertVariant('warning');
      setAlertMsg('暂无可用代币');
      return;
    }
    // 重置提取相关状态
    resetWithdraw();
    setAlertMsg(null);
    hasShownWithdrawSuccessRef.current = false;
    setSelectedToken(tokens[0]); // 默认选择第一个代币
    setWithdrawAmount('');
    onWithdrawOpen();
  };

  // 提取相关状态
  const {
    writeContract: writeWithdraw,
    data: withdrawHash,
    isPending: isWithdrawPending,
    reset: resetWithdraw,
  } = useWriteContract();

  const { isSuccess: withdrawSuccess, isLoading: isWithdrawConfirming } =
    useWaitForTransactionReceipt({ hash: withdrawHash });

  const isWithdrawLoading = Boolean(isWithdrawPending || isWithdrawConfirming);

  // 确认提取
  const handleConfirmWithdraw = async () => {
    if (!withdrawAmount) {
      setAlertVariant('danger');
      setAlertMsg('请输入提取金额');
      return;
    }
    if (!selectedToken) {
      setAlertVariant('danger');
      setAlertMsg('请选择要提取的代币');
      return;
    }
    
    // 检查是否可以提取
    if (!canWithdrawSelectedToken) {
      setAlertVariant('danger');
      setAlertMsg(withdrawDisabledReason || '该代币暂时无法提取');
      return;
    }

    // 检查网络
    if (chainId !== bsc.id) {
      try {
        switchChain({ chainId: bsc.id });
        setAlertVariant('primary');
        setAlertMsg('正在切换到 BSC 网络，请确认...');
      } catch (err) {
        console.error('切换网络失败:', err);
        setAlertVariant('danger');
        setAlertMsg('切换网络失败，请手动切换到 BSC 网络');
      }
      return;
    }

    try {
      const decimals = selectedToken.decimals || 18;
      const amountBigInt = parseUnits(withdrawAmount, decimals);

      // 调用合约的 withdrawLockedToken 方法
      await writeWithdraw({
        address: CONTRACT_ADDRESS,
        abi: wallet_abi,
        functionName: 'withdrawLockedToken',
        args: [selectedToken.contractAddress, amountBigInt],
      } as any);

      setAlertVariant('primary');
      setAlertMsg('提取交易已发送，等待确认...');
    } catch (err: any) {
      console.error('提取失败:', err);

      // 详细的错误处理
      if (err?.cause?.code === 4001) {
        setAlertVariant('warning');
        setAlertMsg('用户取消了提取交易');
      } else if (err?.message?.includes('You have no locked tokens')) {
        setAlertVariant('danger');
        setAlertMsg('该代币没有锁定记录，无法提取。只能提取通过"锁仓转入"功能存入的代币。');
      } else if (err?.message?.includes('Tokens still locked')) {
        setAlertVariant('danger');
        setAlertMsg('代币仍在锁定期内，未到解锁时间');
      } else if (err?.message?.includes('Insufficient locked amount')) {
        setAlertVariant('danger');
        setAlertMsg('提取数量超过锁定数量');
      } else {
        setAlertVariant('danger');
        setAlertMsg('提取交易失败: ' + (err?.shortMessage || err?.message || '未知错误'));
      }

      // 重要：重置状态，恢复按钮
      resetWithdraw();
    }
  };

  // 提取成功后关闭弹窗
  useEffect(() => {
    if (withdrawSuccess && isWithdrawOpen) {
      setWithdrawAmount('');
      setSelectedToken(null);
      onWithdrawOpenChange();
      hasShownWithdrawSuccessRef.current = false;
    }
  }, [withdrawSuccess, isWithdrawOpen, onWithdrawOpenChange]);

  // 当弹窗关闭后显示成功消息
  const hasShownWithdrawSuccessRef = useRef(false);
  
  useEffect(() => {
    if (withdrawSuccess && !isWithdrawOpen && !hasShownWithdrawSuccessRef.current && withdrawHash) {
      setAlertVariant('success');
      setAlertMsg('提取交易已确认');
      hasShownWithdrawSuccessRef.current = true;
    }
  }, [withdrawSuccess, isWithdrawOpen, withdrawHash]);

  // 当开始新的提取时，重置成功消息标记
  useEffect(() => {
    if (isWithdrawOpen) {
      hasShownWithdrawSuccessRef.current = false;
    }
  }, [isWithdrawOpen]);

// 通知关闭自动
useEffect(() => {
  if (!alertMsg) return;

  const timer = setTimeout(() => {
    setAlertMsg(null);
  }, 5000); // 5秒后自动关闭

  return () => clearTimeout(timer);
}, [alertMsg]);

  return (
    <div className={styles.container}>
      {/* 只在没有弹窗打开时显示外层 Alert */}
      {alertMsg && !isLockOpen && !isWithdrawOpen && (
        <Alert
          key={alertVariant}
          color={alertVariant}
          title={alertMsg}
          variant="flat"
          onClose={() => setAlertMsg(null)}
        />
      )}
      <div className={styles.header}>
        <h1 className={styles.title}>合约钱包</h1>
      </div>

      <Card className={styles.walletCard}>
        <CardHeader className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>钱包信息</h2>
        </CardHeader>
        <CardBody>
          {isConnected && address ? (
            <div className={styles.addressContainer}>
              <div className={styles.addressRow}>
                <div className={styles.addressItem}>
                  <code className={styles.address}>链接地址：{address}</code>
                  <Tooltip content={copied === 'wallet' ? '已复制!' : '点击复制'}>
                    <Button
                      isIconOnly
                      variant="light"
                      size="sm"
                      onPress={() => copyToClipboard(address, 'wallet')}
                      className={styles.copyButton}
                    >
                      <CopyIcon />
                    </Button>
                  </Tooltip>
                </div>
              </div>

              <div className={styles.addressRow}>
                <div className={styles.addressItem}>
                  <code className={styles.address}>合约地址：{CONTRACT_ADDRESS}</code>
                  <Tooltip content={copied === 'contract' ? '已复制!' : '点击复制'}>
                    <Button
                      isIconOnly
                      variant="light"
                      size="sm"
                      onPress={() => copyToClipboard(CONTRACT_ADDRESS, 'contract')}
                      className={styles.copyButton}
                    >
                      <CopyIcon />
                    </Button>
                  </Tooltip>
                </div>
              </div>

              <div className={styles.addressRow}>
                <div className={styles.addressItem}>
                  <code className={styles.address}>owner地址：{OWNER_ADDRESS as any}</code>
                  <Tooltip content={copied === 'owner' ? '已复制!' : '点击复制'}>
                    <Button
                      isIconOnly
                      variant="light"
                      size="sm"
                      onPress={() => copyToClipboard(OWNER_ADDRESS as any, 'owner')}
                      className={styles.copyButton}
                    >
                      <CopyIcon />
                    </Button>
                  </Tooltip>
                </div>
              </div>
            </div>
          ) : (
            <p className={styles.notConnected}>请先连接钱包</p>
          )}
        </CardBody>
      </Card>

      <Card className={styles.tokensCard}>
        <CardHeader className={styles.cardHeader}>
          <div className={styles.cardHeaderContent}>
            <h2 className={styles.cardTitle}>代币列表</h2>
            <div className={styles.buttonGroup}>
              <Button 
                color="primary" 
                size="sm"
                className={styles.actionButton}
                isDisabled={!isConnected}
                onPress={handleLockDeposit}
              >
                锁仓转入
              </Button>
              <Button 
                color="secondary" 
                size="sm" 
                onPress={handleWithdraw}
                className={styles.actionButton}
                isDisabled={!isConnected}
              >
                提取代币
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          {isConnected && address ? (
            <>
              {isLoadingTokens && (
                <p className="text-center text-default-500 py-4">加载代币中...</p>
              )}
              {tokensError && (
                <p className="text-center text-danger py-4">{tokensError}</p>
              )}
              {!isLoadingTokens && !tokensError && (
                <>
                  <div className={styles.searchContainer}>
                    <Input
                      placeholder="搜索合约地址或代币符号（如：USDT、ETH、USDC）..."
                      value={searchQuery}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setSearchQuery(e.target.value);
                      }}
                      className={styles.searchInput}
                      size="sm"
                      startContent={
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M14 14L11.1 11.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      }
                    />
                  </div>
                  <Table aria-label="代币列表" className={styles.table}>
                    <TableHeader>
                      <TableColumn>代币合约地址</TableColumn>
                      <TableColumn>代币符号</TableColumn>
                      <TableColumn>代币数量</TableColumn>
                      <TableColumn>余额价值</TableColumn>
                      <TableColumn>市值</TableColumn>
                      <TableColumn>24小时涨跌幅</TableColumn>
                      <TableColumn>是否可转出</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {filteredTokens && filteredTokens.length > 0 ? (
                        filteredTokens
                          .filter(token => token != null)
                          .map((token, index) => {
                            // 判断涨跌幅是正还是负，用于颜色显示
                            const priceChangeValue = parseFloat(token.priceChange24h);
                            const isPositive = !isNaN(priceChangeValue) && priceChangeValue >= 0;
                            const isNegative = !isNaN(priceChangeValue) && priceChangeValue < 0;
                            
                            return (
                              <TableRow key={`${token.symbol || token.contractAddress}-${index}`}>
                                <TableCell>
                                  <div className={styles.addressCell}>
                                    <code className={styles.contractAddress}>
                                      {formatAddress(String(token.contractAddress || token.symbol || ''))}
                                    </code>
                                    <Tooltip content={copied === `token-${index}` ? '已复制!' : '点击复制完整地址'}>
                                      <Button
                                        isIconOnly
                                        variant="light"
                                        size="sm"
                                        onPress={() => copyToClipboard(String(token.contractAddress || token.symbol || ''), `token-${index}`)}
                                        className={styles.copyButton}
                                      >
                                        <CopyIcon />
                                      </Button>
                                    </Tooltip>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Chip size="sm" variant="flat" color="primary">
                                    {token.symbol || 'N/A'}
                                  </Chip>
                                </TableCell>
                                <TableCell>{token.amount || '0.00'}</TableCell>
                                <TableCell className={styles.priceCell}>{token.balanceValue || '$0.00'}</TableCell>
                                <TableCell className={styles.priceCell}>{token.marketCap || 'N/A'}</TableCell>
                                <TableCell>
                                  <span style={{ 
                                    color: isPositive ? '#17c964' : isNegative ? '#f31260' : 'inherit',
                                    fontWeight: '500'
                                  }}>
                                    {token.priceChange24h || 'N/A'}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <Chip 
                                    size="sm" 
                                    variant="flat" 
                                    color={token.canTransfer ? "success" : "warning"}
                                  >
                                    {token.canTransfer ? '可转出' : '已锁定'}
                                  </Chip>
                                </TableCell>
                              </TableRow>
                            );
                          })
                      ) : (
                        <TableRow>
                          <TableCell>
                            <div className={styles.noResults}>
                              {searchQuery && searchQuery.trim() ? '未找到匹配的代币' : '暂无代币数据'}
                            </div>
                          </TableCell>
                          <TableCell>{null}</TableCell>
                          <TableCell>{null}</TableCell>
                          <TableCell>{null}</TableCell>
                          <TableCell>{null}</TableCell>
                          <TableCell>{null}</TableCell>
                          <TableCell>{null}</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </>
              )}
            </>
          ) : (
            <p className={styles.notConnected}>请先连接钱包以查看代币列表</p>
          )}
        </CardBody>
      </Card>

      {/* 锁仓转入 Modal */}
        <Modal isOpen={isLockOpen} onOpenChange={onLockOpenChange} isDismissable={false} placement="center" size="lg">
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader className="flex flex-col gap-1">锁仓转入</ModalHeader>
                <ModalBody>
                  <Input
                    label="代币合约地址"
                    placeholder="0x..."
                    value={lockTokenAddress}
                    onChange={(e) => setLockTokenAddress(e.target.value)}
                    description="请输入要锁仓的代币合约地址"
                    isInvalid={lockTokenAddress !== '' && !isValidAddress(lockTokenAddress)}
                    errorMessage={lockTokenAddress !== '' && !isValidAddress(lockTokenAddress) ? '无效的地址格式' : ''}
                    endContent={
                      <Button
                        size="sm"
                        variant="flat"
                        color="primary"
                        onPress={pasteFromClipboard}
                        className="min-w-unit-16"
                      >
                        粘贴
                      </Button>
                    }
                  />

                  <Input
                    label="代币精度 (Decimals)"
                    placeholder="18"
                    value={lockTokenDecimals}
                    onChange={(e) => setLockTokenDecimals(e.target.value)}
                    description="代币的小数位数，通常为 18"
                    type="number"
                    isInvalid={lockTokenDecimals !== '' && (Number(lockTokenDecimals) < 0 || Number(lockTokenDecimals) > 18)}
                    errorMessage={lockTokenDecimals !== '' && (Number(lockTokenDecimals) < 0 || Number(lockTokenDecimals) > 18) ? '请输入0-18之间的数字' : ''}
                  />

                  <Input
                    label="转入数量"
                    placeholder="0.00"
                    value={lockAmount}
                    onChange={(e) => setLockAmount(e.target.value)}
                    description="请输入要锁仓的代币数量"
                    type="number"
                    isInvalid={lockAmount !== '' && Number(lockAmount) <= 0}
                    errorMessage={lockAmount !== '' && Number(lockAmount) <= 0 ? '请输入大于0的数量' : ''}
                  />
                  
                  <Input
                    label="锁定天数"
                    placeholder="7"
                    value={lockDays}
                    onChange={(e) => setLockDays(e.target.value)}
                    description="代币将被锁定的天数"
                    type="number"
                    isInvalid={lockDays !== '' && Number(lockDays) <= 0}
                    errorMessage={lockDays !== '' && Number(lockDays) <= 0 ? '请输入大于0的天数' : ''}
                  />

                  {isValidAddress(lockTokenAddress) && (
                    <div className="text-sm text-default-600">
                      <div>当前授权: {allowance 
                        ? (BigInt(allowance as any) === MAX_UINT256 ? '无限制' : formatUnits(allowance as any, parseInt(lockTokenDecimals) || 18))
                        : '0'}
                      </div>
                      <div>预计解锁时间: {lockDays && Number(lockDays) > 0
                        ? new Date(Date.now() + Number(lockDays) * 24 * 60 * 60 * 1000).toLocaleString('zh-CN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })
                        : '请输入锁定天数'}
                      </div>
                    </div>
                  )}
                </ModalBody>
                <ModalFooter>
                  <Button color="danger" variant="light" onPress={onClose}>
                    取消
                  </Button>
                  <Button
                    color="primary"
                    onPress={handleApproveOrLock}
                    isLoading={
                      needsApproval
                        ? (isApprovePending || (approveHash && !approveSuccess))
                        : (isLockPending || (lockHash && !lockSuccess))
                    }
                    isDisabled={
                      !isValidAddress(lockTokenAddress) ||
                      !lockAmount ||
                      Number(lockAmount) <= 0 ||
                      !lockDays ||
                      Number(lockDays) <= 0 ||
                      !lockTokenDecimals ||
                      Number(lockTokenDecimals) < 0 ||
                      Number(lockTokenDecimals) > 18 ||
                      (needsApproval
                        ? (isApprovePending && !approveSuccess)
                        : (isLockPending || (lockHash && !lockSuccess)))
                    }
                  >
                    {needsApproval
                      ? (approveSuccess ? '授权成功' : '授权合约')
                      : '确认锁仓'}
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>

      {/* 提取代币 Modal */}
      <Modal isOpen={isWithdrawOpen} onOpenChange={onWithdrawOpenChange} isDismissable={false} placement="center" size="lg">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                提取已解锁代币
              </ModalHeader>
              <ModalBody>
                <div>
                  <label className="text-sm text-default-600 mb-2 block">选择代币</label>
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                    {tokens.map((token, index) => (
                      <Button
                        key={index}
                        variant={selectedToken?.contractAddress === token.contractAddress ? "solid" : "bordered"}
                        color={selectedToken?.contractAddress === token.contractAddress ? "primary" : "default"}
                        onPress={() => setSelectedToken(token)}
                        className="justify-start"
                      >
                        <div className="flex items-center gap-2 w-full">
                          <Chip size="sm" variant="flat" color="primary">
                            {token.symbol || 'N/A'}
                          </Chip>
                          <span className="text-xs text-default-500">
                            {formatAddress(token.contractAddress)}
                          </span>
                          <span className="text-xs text-default-400 ml-auto">
                            余额: {token.amount}
                          </span>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
                
                {selectedToken && (
                  <>
                    <Input
                      label="提取数量"
                      placeholder="0.00"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      description={selectedTokenLockInfo && Number((selectedTokenLockInfo as any)[3]) > 0
                        ? `可提取数量: ${formatAmount(Number(formatUnits((selectedTokenLockInfo as any)[3], selectedToken.decimals || 18)))}`
                        : `合约余额: ${selectedToken.amount}`}
                      type="number"
                    />
                    
                    {/* 显示锁定信息 */}
                    {selectedTokenLockInfo && (() => {
                      const [unlockTimestamp, isLocked, remainingTime, lockedAmount] = selectedTokenLockInfo as [bigint, boolean, bigint, bigint];
                      const unlockTime = Number(unlockTimestamp);
                      const locked = Number(lockedAmount);
                      const decimals = selectedToken.decimals || 18;
                      
                      // 没有锁定记录
                      if (locked === 0) {
                        return null;
                      }
                      
                      const lockedAmountFormatted = formatAmount(Number(formatUnits(BigInt(locked), decimals)));
                      
                      // 已锁定且未解锁
                      if (isLocked) {
                        const unlockDate = new Date(unlockTime * 1000).toLocaleString('zh-CN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        });
                        
                        return (
                          <div className="text-sm text-default-600 space-y-1 p-3 bg-default-100 rounded-lg">
                            <div>🔒 锁定状态: <span className="text-warning font-semibold">已锁定</span></div>
                            <div>📦 可提取数量: {lockedAmountFormatted}</div>
                            <div>⏰ 解锁时间: {unlockDate}</div>
                            <div>⏳ 剩余时间: <span className="text-warning font-semibold">{formatCountdown(countdown)}</span></div>
                          </div>
                        );
                      }
                      
                      // 已解锁，可以提取
                      return (
                        <div className="text-sm text-success-600 space-y-1 p-3 bg-success-50 rounded-lg">
                          <div>✅ 锁定状态: <span className="font-semibold">已解锁</span></div>
                          <div>📦 可提取数量: {lockedAmountFormatted}</div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </ModalBody>
              <ModalFooter>
                <Button 
                  color="danger" 
                  variant="light" 
                  onPress={onClose}
                  isDisabled={isWithdrawLoading}
                >
                  取消
                </Button>
                <Button 
                  color="primary" 
                  onPress={handleConfirmWithdraw}
                  isLoading={isWithdrawLoading}
                  isDisabled={
                    !selectedToken ||
                    !withdrawAmount ||
                    isWithdrawLoading ||
                    !canWithdrawSelectedToken // 添加锁定状态检查
                  }
                >
                  {isWithdrawLoading ? '处理中...' : 
                   !canWithdrawSelectedToken ? (withdrawDisabledReason?.includes('没有锁定记录') || withdrawDisabledReason?.includes('没有通过锁仓功能') ? '无锁定记录' : '代币已锁定') : 
                   '确认提取'}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
}

