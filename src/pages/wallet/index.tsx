import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import styles from './index.module.css'
import { Card, CardHeader, CardBody, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Button, Chip, Tooltip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Alert } from "@heroui/react";
import { Input } from "@heroui/input";
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { useWriteContract, useWaitForTransactionReceipt,useReadContract} from 'wagmi'
import { bsc } from 'wagmi/chains';
import {wallet_abi} from '../../ABI/transferwallet';
import {ERC_abi} from '../../ABI/IERC20';

import { parseUnits, formatUnits } from 'viem'

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
  const { isOpen: isAddTokenOpen, onOpen: onAddTokenOpen, onOpenChange: onAddTokenOpenChange } = useDisclosure();
  const { isOpen: isTransferOpen, onOpen: onTransferOpen, onOpenChange: onTransferOpenChange } = useDisclosure();
  const { isOpen: isLockOpen, onOpen: onLockOpen, onOpenChange: onLockOpenChange } = useDisclosure();
  const [newTokenAddress, setNewTokenAddress] = useState<string>('');
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [transferTo, setTransferTo] = useState<string>('');

  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  // 标记是否正在等待网络切换后发送交易
  const [pendingAddToken, setPendingAddToken] = useState<boolean>(false);

  // Alert 状态
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [alertVariant, setAlertVariant] = useState<'primary' | 'success' | 'danger' | 'warning'>('primary');

  // 静态显示的合约钱包地址
  const CONTRACT_ADDRESS = '0x7961d02eD51bDD9a76E83C99a4F359a512A087bC';
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
          setIsLoadingTokens(true);
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

        if (mounted) setTokens(mapped);
      } catch (err) {
        if ((err as any)?.name === 'AbortError') return;
        console.error('Fetch Chainbase error:', err);
        if (mounted) {
          setTokensError('无法从 Chainbase 获取代币数据');
          setTokens([]);
        }
      } finally {
        if (mounted) setIsLoadingTokens(false);
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

  // 查询锁仓时间（查询owner地址的锁定时间）
  const { data: unlockTime } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: wallet_abi,
    functionName: 'unlockTime',
    args: [OWNER_ADDRESS!],
    query: {
      enabled: Boolean(OWNER_ADDRESS),
    },
  })

  // 判断是否可以转出（当前时间 >= 锁定时间）
  const canTransferTokens = useMemo(() => {
    if (!unlockTime) return true; // 如果没有锁定时间，默认可以转出
    const currentTime = Math.floor(Date.now() / 1000); // 当前时间戳（秒）
    const unlockTimeNum = Number(unlockTime);
    return currentTime >= unlockTimeNum;
  }, [unlockTime]);

  // 更新代币列表的可转出状态
  const tokensWithTransferStatus = useMemo(() => {
    return tokens.map(token => ({
      ...token,
      canTransfer: canTransferTokens
    }));
  }, [tokens, canTransferTokens]);

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

  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // 验证以太坊地址格式
  const isValidAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };
  const {writeContract,data: hash,isPending,error,reset} = useWriteContract()
  const { isLoading: isConfirming, isSuccess } =useWaitForTransactionReceipt({hash,})
  const isTxLoading = Boolean(isPending || isConfirming)
  
  // 发送交易函数的 ref（将在 tokenAddress 定义后赋值）
  const sendAddTokenTransactionRef = useRef<(() => Promise<void>) | null>(null);
  
  // 使用 ref 防止重复显示成功消息
  const hasShownAddTokenSuccessRef = useRef(false);


  // 添加代币地址
  const handleAddToken = async () => {
    // 检查当前网络是否是 BSC，如果不是则切换
    if (chainId !== bsc.id) {
      try {
        setPendingAddToken(true);
        switchChain({ chainId: bsc.id });
        setAlertVariant('primary');
        setAlertMsg('正在切换到 BSC 网络，请确认...');
      } catch (err) {
        console.error('切换网络失败:', err);
        setAlertVariant('danger');
        setAlertMsg('切换网络失败，请手动切换到 BSC 网络');
        setPendingAddToken(false);
      }
      return;
    }

    // 如果已经是 BSC 网络，直接发送交易
    // sendAddTokenTransaction 在 tokenAddress 定义后创建
    if (sendAddTokenTransactionRef.current) {
      await sendAddTokenTransactionRef.current();
    }
  };

  // 监听网络切换，当切换到 BSC 后自动发送交易
  useEffect(() => {
    if (chainId === bsc.id && pendingAddToken && sendAddTokenTransactionRef.current) {
      sendAddTokenTransactionRef.current();
    }
  }, [chainId, pendingAddToken]);
// 锁仓转入逻辑
// 查询以添加的代币地址

const {
  data: tokenAddress,
  isPending: isTokenAddressPending,
  error: tokenAddressError,
  refetch: refetchTokenAddress,
} = useReadContract({
  address: CONTRACT_ADDRESS,
  abi: wallet_abi,
  functionName: 'TokenAddress',
  query: {
    // 优化查询配置，加快刷新速度
    staleTime: 0, // 不使用缓存，总是获取最新数据
    gcTime: 5000, // 5秒后清除缓存
    refetchOnWindowFocus: true, // 窗口聚焦时自动刷新
    refetchInterval: 3000, // 每3秒自动刷新一次
  },
})
console.log('tokenAddress', tokenAddress);

// 设置代币地址成功后关闭弹窗
useEffect(() => {
  if (isSuccess && isAddTokenOpen) {
    setNewTokenAddress('');
    onAddTokenOpenChange(); // 关闭弹窗
    // 立即刷新 tokenAddress 查询，获取最新的链上数据
    refetchTokenAddress();
    hasShownAddTokenSuccessRef.current = false; // 重置标记，准备显示成功消息
  }
}, [isSuccess, isAddTokenOpen, refetchTokenAddress, onAddTokenOpenChange]);

// 当弹窗关闭后显示成功消息（使用 ref 防止重复显示）
// 只有当 hash 存在且弹窗已关闭时才显示成功消息
useEffect(() => {
  if (isSuccess && !isAddTokenOpen && !hasShownAddTokenSuccessRef.current && hash) {
    setAlertVariant('success');
    setAlertMsg('代币地址设置成功');
    hasShownAddTokenSuccessRef.current = true;
  }
}, [isSuccess, isAddTokenOpen, hash]);

// 当开始新的设置代币地址时，重置成功消息标记
useEffect(() => {
  if (isAddTokenOpen) {
    hasShownAddTokenSuccessRef.current = false;
  }
}, [isAddTokenOpen]);

// 零地址（未设置代币地址时的默认值）
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

  // 发送交易的实际函数（在 tokenAddress 定义后创建）
  const sendAddTokenTransaction = useCallback(async () => {
    if (!isValidAddress(newTokenAddress)) {
      setAlertVariant('danger');
      setAlertMsg('请输入有效的以太坊地址');
      setPendingAddToken(false);
      return;
    }
    
    // 检查是否与当前合约中设置的代币地址相同
    if (tokenAddress && String(tokenAddress).toLowerCase() === newTokenAddress.toLowerCase()) {
      setAlertVariant('warning');
      setAlertMsg('该代币地址已设置为当前代币地址');
      setPendingAddToken(false);
      return;
    }

    try {
      await writeContract({
        address: CONTRACT_ADDRESS,
        abi: wallet_abi,
        functionName: 'setTokenAddress',
        args: [newTokenAddress],
      } as any);
      setPendingAddToken(false);
    } catch (err) {
      console.error(err);
      setAlertVariant('danger');
      setAlertMsg('交易发起失败');
      setPendingAddToken(false);
    }
  }, [newTokenAddress, tokenAddress, writeContract]);
  
  // 更新 ref
  useEffect(() => {
    sendAddTokenTransactionRef.current = sendAddTokenTransaction;
  }, [sendAddTokenTransaction]);

// 检查代币地址是否有效（不是零地址且不为空）
const isValidTokenAddress = useMemo(() => {
  if (!tokenAddress) return false;
  const addr = String(tokenAddress).toLowerCase();
  return addr !== ZERO_ADDRESS.toLowerCase() && addr !== '0x0';
}, [tokenAddress]);

// 过滤出与合约设置的代币地址匹配的代币（用于转账）
const transferableTokens = useMemo(() => {
  if (!tokenAddress || !isValidTokenAddress) return [];
  const tokenAddr = String(tokenAddress).toLowerCase();
  return tokens.filter(token => 
    String(token.contractAddress).toLowerCase() === tokenAddr
  );
}, [tokens, tokenAddress, isValidTokenAddress]);

// 查询部分合约信息（基于合约返回的 tokenAddress）
const {data: allowance,isPending: isReadPending,error: readError,refetch: refetchAllowance,} = useReadContract({
  address: (tokenAddress as `0x${string}`) || undefined,
  abi: ERC_abi,
  functionName: 'allowance',
  args: [address, CONTRACT_ADDRESS],
  query: {
    enabled: Boolean(address && tokenAddress),
    // 优化查询配置
    staleTime: 0, // 不使用缓存，总是获取最新数据
    gcTime: 10000, // 10秒后清除缓存
    refetchOnWindowFocus: false, // 窗口聚焦时不自动重新查询
    retry: 2, // 失败时重试2次
  },
})
console.log('allowance', allowance);

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
  isSuccess: isLockSuccess,
  reset: resetLock,
} = useWriteContract()

const { isSuccess: approveSuccess } =
  useWaitForTransactionReceipt({ hash: approveHash })

const { isSuccess: lockSuccess } =
  useWaitForTransactionReceipt({ hash: lockHash })


const amountBigInt = () => {
  if (!lockAmount) return parseUnits('0', 18); // 0 ERC20 token
  return parseUnits(lockAmount, 18); // 默认 ERC20 18 位
}

  // 打开锁仓弹窗（用户输入数量后再提交）
  const handleLockDeposit = async () => {
    if (!tokenAddress || !isValidAddress(String(tokenAddress))) {
      setAlertVariant('danger'); setAlertMsg('请先设置有效的代币地址'); return;
    }
    // 重置锁仓相关状态
    resetLock();
    // 重置成功消息标记和清空之前的消息
    hasShownLockSuccessRef.current = false;
    setAlertMsg(null);
    setLockAmount('');
    onLockOpen();
  };

  // 确认锁仓：根据 allowance 决定先 approve 还是直接 deposit
  const handleLock = async () => {
  if (!lockAmount || Number(lockAmount) <= 0) {
    setAlertVariant('danger');
    setAlertMsg('请输入正确的数量');
    return;
  }
  if (!tokenAddress) {
    setAlertVariant('danger');
    setAlertMsg('请先设置代币地址');
    return;
  }

  try {
    const amount = amountBigInt();
    await writeLock({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: wallet_abi,
      functionName: 'depositlockToken',
      args: [amount],
      account: address,
    } as any);
    setAlertVariant('primary');
    setAlertMsg('锁仓交易已发送，等待确认...');
  } catch (err: any) {
    console.error(err);

    // 如果用户取消交易
    if (err?.cause?.code === 4001) { // MetaMask 用户拒绝
      setAlertVariant('warning');
      setAlertMsg('用户取消了交易');
    } else {
      setAlertVariant('danger');
      setAlertMsg('锁仓交易发送失败');
    }

    // 重要：手动重置 writeContract 状态，恢复按钮
    reset();
  }
};

// 单独授权按钮逻辑
const handleApprove = async () => {
  if (!tokenAddress) {
    setAlertVariant('danger');
    setAlertMsg('请先设置代币地址');
    return;
  }

  try {
    await writeApprove({
      address: tokenAddress as `0x${string}`,
      abi: ERC_abi,
      functionName: 'approve',
      args: [CONTRACT_ADDRESS, MAX_UINT256],
    } as any);

    setAlertVariant('primary');
    setAlertMsg('已发送授权请求，请等待链上确认');
  } catch (err: any) {
    console.error(err);

    // 用户取消交易（MetaMask error code 4001）
    if (err?.cause?.code === 4001) {
      setAlertVariant('warning');
      setAlertMsg('用户取消了授权交易');
    } else {
      setAlertVariant('danger');
      setAlertMsg('授权交易发送失败');
    }

    // 重置状态，允许再次点击
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





  // 发起转账
  const handleTransfer = () => {
    // 如果没有已设置的代币地址，不打开
    if (!tokenAddress) {
      return;
    }
    // 重置转账相关状态，避免上次交易的状态影响
    resetTransfer();
    setAlertMsg(null);
    // 默认选择第一个匹配的代币
    if (transferableTokens.length > 0) {
      setSelectedToken(transferableTokens[0]);
    } else {
      setSelectedToken(null);
    }
    setTransferAmount('');
    setTransferTo('');
    onTransferOpen();
  };

  // 转账相关状态
  const {
    writeContract: writeTransfer,
    data: transferHash,
    isPending: isTransferPending,
    error: transferError,
    reset: resetTransfer,
  } = useWriteContract();

  const { isSuccess: transferSuccess, isLoading: isTransferConfirming } =
    useWaitForTransactionReceipt({ hash: transferHash });

  const isTransferLoading = Boolean(isTransferPending || isTransferConfirming);

  // 确认转账
  const handleConfirmTransfer = async () => {
    if (!transferTo || !transferAmount) {
      setAlertVariant('danger');
      setAlertMsg('请填写完整信息');
      return;
    }
    if (!isValidAddress(transferTo)) {
      setAlertVariant('danger');
      setAlertMsg('请输入有效的接收地址');
      return;
    }
    if (!selectedToken) {
      setAlertVariant('danger');
      setAlertMsg('请选择要转账的代币');
      return;
    }
    if (!tokenAddress) {
      setAlertVariant('danger');
      setAlertMsg('代币地址未设置');
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
      // 获取代币的 decimals，默认 18
      const decimals = selectedToken.decimals || 18;
      
      // 验证余额 - 需要先去掉格式化字符串中的逗号
      // selectedToken.amount 可能是 "35,645.5789" 这样的格式化字符串
      const amountStr = (selectedToken.amount || '0').replace(/,/g, ''); // 去掉所有逗号
      const availableBalance = parseFloat(amountStr);
      const transferAmountNum = parseFloat(transferAmount);
      
      if (isNaN(availableBalance) || isNaN(transferAmountNum)) {
        setAlertVariant('danger');
        setAlertMsg('请输入有效的转账金额');
        return;
      }
      
      if (transferAmountNum > availableBalance) {
        setAlertVariant('danger');
        setAlertMsg(`转账金额超过可用余额 ${selectedToken.amount}`);
        return;
      }
      
      // 将用户输入的金额转换为 BigInt（考虑 decimals）
      const amountBigInt = parseUnits(transferAmount, decimals);

      // 调用合约的 transferToken 方法
      await writeTransfer({
        address: CONTRACT_ADDRESS,
        abi: wallet_abi,
        functionName: 'transferToken',
        args: [[transferTo], [amountBigInt]],
      } as any);

      setAlertVariant('primary');
      setAlertMsg('转账交易已发送，等待确认...');
    } catch (err: any) {
      console.error('转账失败:', err);

      // 如果用户取消交易
      if (err?.cause?.code === 4001) {
        setAlertVariant('warning');
        setAlertMsg('用户取消了转账交易');
      } else {
        setAlertVariant('danger');
        setAlertMsg('转账交易发送失败');
      }

      // 重置状态
      resetTransfer();
    }
  };

  // 转账成功后关闭弹窗
  useEffect(() => {
    if (transferSuccess && isTransferOpen) {
      setTransferAmount('');
      setTransferTo('');
      setSelectedToken(null);
      // 关闭弹窗
      onTransferOpenChange();
    }
  }, [transferSuccess, isTransferOpen, onTransferOpenChange]);

  // 当弹窗关闭后显示成功消息（使用 ref 防止重复显示）
  const hasShownSuccessRef = useRef(false);
  
  useEffect(() => {
    if (transferSuccess && !isTransferOpen && !hasShownSuccessRef.current) {
      // 弹窗已关闭，显示成功消息
      setAlertVariant('success');
      setAlertMsg('转账交易已确认');
      hasShownSuccessRef.current = true;
      // 可以在这里触发代币列表刷新
    }
  }, [transferSuccess, isTransferOpen]);

  // 当开始新的转账时，重置成功消息标记
  useEffect(() => {
    if (isTransferOpen && transferHash) {
      hasShownSuccessRef.current = false;
    }
  }, [isTransferOpen, transferHash]);

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
      {alertMsg && !isAddTokenOpen && !isLockOpen && !isTransferOpen && (
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
                  onPress={() => {
                    // 重置状态
                    reset();
                    hasShownAddTokenSuccessRef.current = false;
                    setAlertMsg(null);
                    setNewTokenAddress('');
                    // 打开弹窗
                    onAddTokenOpen();
                  }}
                  className={styles.actionButton}
                  isDisabled={!isConnected}
                >
                  设置代币地址
                </Button>
              <Button 
                color="primary" 
                size="sm"
                className={styles.actionButton}
                isDisabled={!isConnected || !tokenAddress}
                onPress={handleLockDeposit}
              >
                锁仓转入
              </Button>
                <Button 
                  color="secondary" 
                  size="sm" 
                  onPress={handleTransfer}
                  className={styles.actionButton}
                  isDisabled={!isConnected || !tokenAddress}
                >
                  发起转账
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

      {/* 添加代币地址 Modal */}
      <Modal isOpen={isAddTokenOpen} onOpenChange={onAddTokenOpenChange} isDismissable={false} placement="center">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">设置代币地址</ModalHeader>
              <ModalBody>
                {/* 在弹窗内显示错误消息，优先级最高（但不显示成功消息，成功消息在弹窗关闭后显示） */}
                {alertMsg && alertVariant !== 'success' && (
                  <Alert
                    key={alertVariant}
                    color={alertVariant}
                    title={alertMsg}
                    variant="flat"
                    onClose={() => setAlertMsg(null)}
                    className="mb-4 z-50"
                    classNames={{
                      base: "z-50"
                    }}
                  />
                )}
                <Input
                  label="代币合约地址"
                  placeholder="0x..."
                  value={newTokenAddress}
                  onChange={(e) => setNewTokenAddress(e.target.value)}
                  description="请输入有效的以太坊代币合约地址"
                  isInvalid={newTokenAddress !== '' && !isValidAddress(newTokenAddress)}
                  errorMessage={newTokenAddress !== '' && !isValidAddress(newTokenAddress) ? '无效的地址格式' : ''}
                />
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="light" onPress={onClose}>
                  取消
                </Button>
                <Button
                  color="primary"
                  onPress={handleAddToken}
                  isLoading={isTxLoading}
                  isDisabled={!isValidAddress(newTokenAddress) || isTxLoading}
                >
                  添加
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

        {/* 锁仓转入 Modal */}
        <Modal isOpen={isLockOpen} onOpenChange={onLockOpenChange} isDismissable={false} placement="center">
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader className="flex flex-col gap-1">锁仓转入</ModalHeader>
                <ModalBody>
                  {/* 在弹窗内显示错误消息，优先级最高（但不显示成功消息，成功消息在弹窗关闭后显示） */}
                  {alertMsg && alertVariant !== 'success' && (
                    <Alert
                      key={alertVariant}
                      color={alertVariant}
                      title={alertMsg}
                      variant="flat"
                      onClose={() => setAlertMsg(null)}
                      className="mb-4 z-50"
                      classNames={{
                        base: "z-50"
                      }}
                    />
                  )}
                  <div className="mb-4">
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
                  </div>

                  <div className="text-sm text-default-600">
                    <div>当前代币地址: {tokenAddress && isValidTokenAddress 
                      ? String(tokenAddress) 
                      : (tokenAddress ? ZERO_ADDRESS : '未设置')}</div>
                    <div>当前授权: {allowance 
                      ? (BigInt(allowance as any) === MAX_UINT256 ? '无限制' : formatUnits(allowance as any, 18))
                      : '0'}
                    </div>
                    <div>解锁时间: {unlockTime
                      ? new Date(Number(unlockTime) * 1000).toLocaleString('zh-CN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })
                      : '未设置'}
                      </div>
                  </div>
                  
                  {/* 如果代币地址无效，显示提示 */}
                  {!isValidTokenAddress && (
                    <Alert
                      color="warning"
                      variant="flat"
                      title="请先设置代币地址"
                      description="代币地址为默认值（零地址），请先在代币列表页面设置有效的代币地址"
                      className="mt-4"
                    />
                  )}
                </ModalBody>
                <ModalFooter>
                  <Button color="danger" variant="light" onPress={onClose}>
                    取消
                  </Button>
                  <Tooltip
                    content={!isValidTokenAddress ? '请先设置代币地址' : ''}
                    isDisabled={isValidTokenAddress}
                    delay={0}
                    closeDelay={0}
                  >
                    <div>
                      <Button
                        color="primary"
                        onPress={handleApproveOrLock}
                        isLoading={
                          needsApproval
                            ? (isApprovePending || (approveHash && !approveSuccess))
                            : (isLockPending || (lockHash && !lockSuccess))
                        }
                        isDisabled={
                          !isValidTokenAddress ||
                          (needsApproval
                            ? (isApprovePending && !approveSuccess)
                            : (!lockAmount || Number(lockAmount) <= 0 || (lockHash && !lockSuccess)))
                        }
                      >
                        {needsApproval
                          ? (approveSuccess ? '授权成功' : '授权合约')
                          : '确认锁仓'}
                      </Button>
                    </div>
                  </Tooltip>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>

      {/* 发起转账 Modal */}
      <Modal isOpen={isTransferOpen} onOpenChange={onTransferOpenChange} isDismissable={false} placement="center" size="lg">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                发起转账
              </ModalHeader>
              <ModalBody>
                {/* 在弹窗内显示错误消息，优先级最高（但不显示成功消息，成功消息在弹窗关闭后显示） */}
                {alertMsg && alertVariant !== 'success' && (
                  <Alert
                    key={alertVariant}
                    color={alertVariant}
                    title={alertMsg}
                    variant="flat"
                    onClose={() => setAlertMsg(null)}
                    className="mb-4 z-50"
                    classNames={{
                      base: "z-50"
                    }}
                  />
                )}
                {!tokenAddress ? (
                  <Card className="w-full">
                    <CardBody className="flex flex-col items-center justify-center py-8">
                      <Alert
                        color="warning"
                        variant="flat"
                        title="未设置代币地址"
                        description="请先在代币列表页面设置代币地址，然后才能进行转账操作。"
                        className="w-full"
                      />
                    </CardBody>
                  </Card>
                ) : transferableTokens.length > 0 ? (
                  <>
                    <div>
                      <label className="text-sm text-default-600 mb-2 block">选择代币</label>
                      <div className="flex flex-col gap-2">
                        {transferableTokens.map((token, index) => (
                          <Button
                            key={index}
                            variant={selectedToken?.contractAddress === token.contractAddress ? "solid" : "bordered"}
                            color={selectedToken?.contractAddress === token.contractAddress ? "primary" : "default"}
                            onPress={() => setSelectedToken(token)}
                            className="justify-start"
                          >
                            <div className="flex items-center gap-2">
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
                          label="接收地址"
                          placeholder="0x..."
                          value={transferTo}
                          onChange={(e) => setTransferTo(e.target.value)}
                          description="请输入接收方的以太坊地址"
                          isInvalid={transferTo !== '' && !isValidAddress(transferTo)}
                          errorMessage={transferTo !== '' && !isValidAddress(transferTo) ? '无效的地址格式' : ''}
                        />
                        <Input
                          label="转账数量"
                          placeholder="0.00"
                          value={transferAmount}
                          onChange={(e) => setTransferAmount(e.target.value)}
                          description={`可用余额: ${selectedToken.amount}`}
                          type="number"
                          isInvalid={transferAmount !== '' && parseFloat(transferAmount) <= 0}
                          errorMessage={transferAmount !== '' && parseFloat(transferAmount) <= 0 ? '请输入大于0的数量' : ''}
                        />
                      </>
                    )}
                  </>
                ) : (
                  <Card className="w-full">
                    <CardBody className="flex flex-col items-center justify-center py-8">
                      <Alert
                        color="default"
                        variant="flat"
                        title="暂无匹配的代币"
                        description={`已设置的代币地址为 ${formatAddress(String(tokenAddress))}，但在代币列表中未找到匹配的代币。请确保该代币地址有余额。`}
                        className="w-full"
                      />
                    </CardBody>
                  </Card>
                )}
              </ModalBody>
              <ModalFooter>
                <Button 
                  color="danger" 
                  variant="light" 
                  onPress={onClose}
                  isDisabled={isTransferLoading}
                >
                  取消
                </Button>
                <Button 
                  color="primary" 
                  onPress={handleConfirmTransfer}
                  isLoading={isTransferLoading}
                  isDisabled={
                    !selectedToken ||
                    !isValidAddress(transferTo) || 
                    !transferAmount || 
                    parseFloat(transferAmount) <= 0 ||
                    isTransferLoading
                  }
                >
                  {isTransferLoading ? '处理中...' : '确认转账'}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
}

