import React, { useState, useMemo, useEffect } from 'react'
import styles from './index.module.css'
import { Card, CardHeader, CardBody, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Button, Chip, Tooltip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/react";
import { Input } from "@heroui/input";
import { useAccount } from 'wagmi';
import { useWriteContract, useWaitForTransactionReceipt} from 'wagmi'
import {wallet_abi} from '../../ABI/transferwallet';


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
  balancePrice: string;
  symbol?: string;
}

export default function Wallet() {
  const { address, isConnected } = useAccount();
  const [copied, setCopied] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const { isOpen: isAddTokenOpen, onOpen: onAddTokenOpen, onOpenChange: onAddTokenOpenChange } = useDisclosure();
  const { isOpen: isTransferOpen, onOpen: onTransferOpen, onOpenChange: onTransferOpenChange } = useDisclosure();
  const [newTokenAddress, setNewTokenAddress] = useState<string>('');
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [transferTo, setTransferTo] = useState<string>('');

  // 静态显示的合约与 owner 地址
  const CONTRACT_ADDRESS = '0xB0a4E8983cAa0218985adF6F6FaaFb6C233604C5';
  const OWNER_ADDRESS = '0x8d1d6e78e0ff311cbf527f2c5981814899999999';

  // De.Fi API 配置（使用用户提供的 API key）
  const DEFI_API_KEY = '563844c7f0bc40e2872be9ea5479ce49';
  const DEFI_ENDPOINT = 'https://public-api.de.fi/graphql';

  // 代币列表（由 De.Fi 接口获取）
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

  // 从 De.Fi 拉取指定钱包的 ERC20 代币余额（使用用户提供的 AssetBalancesAdvanced 查询）
  useEffect(() => {
    const fetchBalances = async () => {
      if (!CONTRACT_ADDRESS) return;
      setIsLoadingTokens(true);
      setTokensError(null);
      const query = `query AssetBalancesAdvanced($wallets: [String!]!) {\n  assetBalancesAdvanced(\n    chainIds: [2]\n    walletAddresses: $wallets\n  ) {\n    wallet\n    chains {\n      chain {\n        id\n      }\n      assets {\n        balance\n        price\n        asset {\n          symbol\n          name\n          address\n        }\n      }\n    }\n  }\n}`;

      const variables = { wallets: [CONTRACT_ADDRESS] };

      try {
        const resp = await fetch(DEFI_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': DEFI_API_KEY
          },
          body: JSON.stringify({ query, variables })
        });

        const json = await resp.json();
        if (json.errors) {
          console.error('De.Fi GraphQL errors:', json.errors);
          setTokensError('De.Fi API 返回错误');
          setTokens([]);
          setIsLoadingTokens(false);
          return;
        }

        const data = json.data?.assetBalancesAdvanced;
        if (!data || !Array.isArray(data)) {
          setTokens([]);
          setIsLoadingTokens(false);
          return;
        }

        const mapped: Token[] = [];
        for (const walletEntry of data) {
          if (!walletEntry || !walletEntry.chains) continue;
          for (const chainEntry of walletEntry.chains) {
            const assets = chainEntry?.assets || [];
            for (const a of assets) {
              const asset = a.asset || {};
              const rawBalance = a.balance ?? 0;
              const price = a.price ?? null;
              const amount = formatAmount(rawBalance);
              const balancePrice = Number(amount) * Number(price) != null
                ? `$${(Number(amount) * Number(price)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                : '$0.00';

              const contractAddress = asset.address || `${asset.symbol || asset.name || 'unknown'}-${chainEntry?.chain?.id || '0'}`;

              mapped.push({
                contractAddress,
                amount: amount || '0',
                balancePrice,
                symbol: asset.symbol || asset.name || 'N/A'
              });
            }
          }
        }

        setTokens(mapped);
      } catch (err) {
        console.error('Fetch De.Fi error:', err);
        setTokensError('无法从 De.Fi 获取代币数据');
        setTokens([]);
      } finally {
        setIsLoadingTokens(false);
      }
    };

    fetchBalances();
  }, [CONTRACT_ADDRESS]);

  // 搜索过滤代币列表
  const filteredTokens = useMemo(() => {
    try {
      // 如果没有搜索查询，返回所有代币
      if (!searchQuery || !searchQuery.trim()) {
        return tokens;
      }
      
      const trimmedQuery = searchQuery.trim();
      if (!trimmedQuery) {
        return tokens;
      }
      
      const query = trimmedQuery.toLowerCase();
      
      // 安全地过滤代币
      return tokens.filter(token => {
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
      return tokens;
    }
  }, [tokens, searchQuery]);

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

  // 添加代币地址
  const handleAddToken = async () => {
    
  reset()

  // 1. 地址格式校验
  if (!isValidAddress(newTokenAddress)) {
    alert('请输入有效的以太坊地址')
    return
  }

  // 2. 是否已存在
  const exists = tokens.some(
    token =>
      token.contractAddress.toLowerCase() ===
      newTokenAddress.toLowerCase()
  )

  if (exists) {
    alert('该代币地址已存在')
    return
  }

  try {
    // 3. 调用合约 setTokenAddress
    // @ts-ignore: intentionally ignore type requirement for chain/account here
    await writeContract({
      address: CONTRACT_ADDRESS,
      abi: wallet_abi,
      functionName: 'setTokenAddress',
      args: [newTokenAddress],
    } as any)
  } catch (err) {
    console.error(err)
    alert('交易发起失败')
  }
}
useEffect(() => {
  if (isSuccess) {
    setTokens(prev => [
      ...prev,
      {
        contractAddress: newTokenAddress,
        amount: '0.00',
        balancePrice: '$0.00',
        symbol: 'NEW',
      },
    ])

    setNewTokenAddress('')
    onAddTokenOpenChange()
  }
}, [isSuccess])

  // 发起转账
  const handleTransfer = () => {
    // 如果没有代币，不打开
    if (tokens.length === 0) {
      return;
    }
    // 默认选择第一个代币
    setSelectedToken(tokens[0]);
    setTransferAmount('');
    setTransferTo('');
    onTransferOpen();
  };

  // 确认转账
  const handleConfirmTransfer = () => {
    if (!transferTo || !transferAmount) {
      alert('请填写完整信息');
      return;
    }
    if (!isValidAddress(transferTo)) {
      alert('请输入有效的接收地址');
      return;
    }
    // 这里可以添加实际的转账逻辑
    console.log('转账信息:', {
      token: selectedToken,
      to: transferTo,
      amount: transferAmount
    });
    alert('转账功能待实现');
    onTransferOpenChange();
  };

  return (
    <div className={styles.container}>
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
                  <code className={styles.address}>owner地址：{OWNER_ADDRESS}</code>
                  <Tooltip content={copied === 'owner' ? '已复制!' : '点击复制'}>
                    <Button
                      isIconOnly
                      variant="light"
                      size="sm"
                      onPress={() => copyToClipboard(OWNER_ADDRESS, 'owner')}
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
                onPress={onAddTokenOpen}
                className={styles.actionButton}
                isDisabled={!isConnected}
              >
                设置代币地址
              </Button>
              <Button 
                color="secondary" 
                size="sm" 
                onPress={onTransferOpen}
                className={styles.actionButton}
                isDisabled={!isConnected || tokens.length === 0}
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
                      <TableColumn>代币余额价格</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {filteredTokens && filteredTokens.length > 0 ? (
                        filteredTokens
                          .filter(token => token != null)
                          .map((token, index) => (
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
                              <TableCell className={styles.priceCell}>{token.balancePrice || '$0.00'}</TableCell>
                            </TableRow>
                          ))
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
      <Modal isOpen={isAddTokenOpen} onOpenChange={onAddTokenOpenChange} placement="center">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">设置代币地址</ModalHeader>
              <ModalBody>
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

      {/* 发起转账 Modal */}
      <Modal isOpen={isTransferOpen} onOpenChange={onTransferOpenChange} placement="center" size="lg">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                发起转账
              </ModalHeader>
              <ModalBody>
                {tokens.length > 0 ? (
                  <>
                    <div>
                      <label className="text-sm text-default-600 mb-2 block">选择代币</label>
                      <div className="flex flex-col gap-2">
                        {tokens.map((token, index) => (
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
                  <p className="text-center text-default-500 py-4">
                    请先设置代币地址
                  </p>
                )}
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="light" onPress={onClose}>
                  取消
                </Button>
                <Button 
                  color="primary" 
                  onPress={handleConfirmTransfer}
                  isDisabled={
                    !selectedToken ||
                    !isValidAddress(transferTo) || 
                    !transferAmount || 
                    parseFloat(transferAmount) <= 0
                  }
                >
                  确认转账
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
}

