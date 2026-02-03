import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import styles from './index.module.css';
import AnimatedShaderBackground from '@/components/AnimatedShaderBackground';

interface TokenData {
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
  rank: number;
}

interface BubbleNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  symbol: string;
  marketCap: number;
  iconUrl?: string;
  tokenAddress: string;
  chainId: string;
  priceChange?: { m5?: number; h1?: number; h24?: number };
  radius: number;
}

export default function MemeMap() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredToken, setHoveredToken] = useState<TokenData | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [selectedChain, setSelectedChain] = useState<'solana' | 'bsc' | 'base'>('solana');
  const [displayMode, setDisplayMode] = useState<'all' | 'new'>('all'); // 'all' = 老盘, 'new' = 新盘
  const [copiedAddress, setCopiedAddress] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 获取数据的函数
  const fetchData = (chainId: string, showLoading: boolean = false) => {
    if (showLoading) {
      setLoading(true);
    }
    fetch(`/api/memelist?limit=100&chainId=${chainId}`)
      .then(res => res.json())
      .then(data => {
        const items = data.items || [];
        setTokens(items);
        if (showLoading) {
          setLoading(false);
        }
        setLastUpdate(new Date());
        
        // 调试信息：统计图片情况
        const withIcon = items.filter((t: TokenData) => t.iconUrl && t.iconUrl.trim() !== '').length;
        const withoutIcon = items.length - withIcon;
        console.log(`📊 代币数据加载完成 [${chainId.toUpperCase()}]: 总数=${items.length}, 有图片=${withIcon}, 无图片=${withoutIcon}`);
      })
      .catch(err => {
        console.error('获取数据失败:', err);
        if (showLoading) {
          setLoading(false);
        }
      });
  };

  useEffect(() => {
    // 首次加载数据（显示加载状态）
    fetchData(selectedChain, true);

    // 设置定时器，定时刷新（不显示加载状态，无感更新）
    const interval = setInterval(() => {
      fetchData(selectedChain, false);
    }, 30000); // 10000ms = 10秒

    // 清理定时器
    return () => {
      clearInterval(interval);
      cancelHideTooltip(); // 清理隐藏延时器
    };
  }, [selectedChain]);

  useEffect(() => {
    if (!tokens.length || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // 转换数据为气泡节点
    const nodes: BubbleNode[] = tokens
      .filter(t => t.marketCap && t.marketCap > 0)
      .filter(t => typeof t.priceChange?.m5 === 'number')
      .filter(t => {
        // 新盘模式：同时满足三个条件
        // 1. pairCreatedAt > 昨天凌晨12点
        // 2. 24小时涨幅 > 200%
        // 3. 1小时涨幅 > 50%
        if (displayMode === 'new') {
          // 条件1：检查创建时间
          if (!t.pairCreatedAt) return false;
          
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          yesterday.setHours(0, 0, 0, 0);
          const yesterdayMidnight = yesterday.getTime();
          
          const pairCreatedAtMs = t.pairCreatedAt < 10000000000 
            ? t.pairCreatedAt * 1000 
            : t.pairCreatedAt;
          
          const isNewPair = pairCreatedAtMs > yesterdayMidnight;
          
          // 条件2和3：检查涨幅
          const h24 = t.priceChange?.h24;
          const h1 = t.priceChange?.h1;
          const hasGoodGrowth = typeof h24 === 'number' && h24 > 200 && 
                                typeof h1 === 'number' && h1 > 50;
          
          // 三个条件都要满足
          return isNewPair && hasGoodGrowth;
        }
        // 老盘模式：显示所有
        return true;
      })
      .map(token => {
        // 使用对数scale来计算半径，避免差距过大
        const minRadius = 30;
        const maxRadius = 120;
        const marketCaps = tokens.map(t => t.marketCap || 0).filter(m => m > 0);
        const minMarketCap = Math.min(...marketCaps);
        const maxMarketCap = Math.max(...marketCaps);
        
        const scale = d3.scaleSqrt()
          .domain([minMarketCap, maxMarketCap])
          .range([minRadius, maxRadius]);

        const radius = scale(token.marketCap!);
        // 使用圆形分布，让初始位置更分散
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * Math.min(width, height) * 0.3;
        
        // 尝试使用fallback图片服务
        let finalIconUrl = token.iconUrl;
        if (!finalIconUrl || finalIconUrl.trim() === '') {
          // 对于以太坊系的链，可以尝试使用Trust Wallet的资产库
          const chainMap: Record<string, string> = {
            'ethereum': 'ethereum',
            'bsc': 'smartchain',
            'polygon': 'polygon',
            'arbitrum': 'arbitrum',
            'optimism': 'optimism',
            'base': 'base',
            'avalanche': 'avalanchec',
          };
          
          const trustWalletChain = chainMap[token.chainId.toLowerCase()];
          if (trustWalletChain) {
            finalIconUrl = `https://assets-cdn.trustwallet.com/blockchains/${trustWalletChain}/assets/${token.tokenAddress}/logo.png`;
          }
        }
        
        return {
          id: token.tokenAddress,
          name: token.name || token.symbol || 'Unknown',
          symbol: token.symbol || '',
          marketCap: token.marketCap!,
          iconUrl: finalIconUrl,
          tokenAddress: token.tokenAddress,
          chainId: token.chainId,
          priceChange: token.priceChange,
          radius: radius,
          x: width / 2 + Math.cos(angle) * distance,
          y: height / 2 + Math.sin(angle) * distance,
        };
      });

    // 创建力导向模拟
    const simulation = d3.forceSimulation<BubbleNode>(nodes)
      .force('charge', d3.forceManyBody().strength(10))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<BubbleNode>()
        .radius(d => d.radius + 10)
        .strength(1)
        .iterations(3))
      .force('x', d3.forceX(width / 2).strength(0.03))
      .force('y', d3.forceY(height / 2).strength(0.03))
      .alphaDecay(0.01)
      .velocityDecay(0.3);

    // 创建容器组
    const g = svg.append('g');

    // 创建气泡组
    const bubbles = g.selectAll<SVGGElement, BubbleNode>('.bubble')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'bubble')
      .style('cursor', 'pointer')
      .style('transition', 'all 0.2s ease');

    // 添加渐变定义
    const defs = svg.append('defs');
    nodes.forEach((node, i) => {
      const gradient = defs.append('radialGradient')
        .attr('id', `gradient-${i}`)
        .attr('cx', '30%')
        .attr('cy', '30%');
      
      gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', d3.interpolateRainbow(i / nodes.length))
        .attr('stop-opacity', 0.8);
      
      gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', d3.interpolateRainbow(i / nodes.length))
        .attr('stop-opacity', 0.3);
    });

    // 绘制气泡圆圈（仅用于显示）
    bubbles.append('circle')
      .attr('r', d => d.radius)
      .attr('fill', (d, i) => `url(#gradient-${i})`)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('filter', 'drop-shadow(0px 4px 8px rgba(0,0,0,0.2))')
      .style('pointer-events', 'none');

    // 交互命中区域（透明圆）
    const hitAreas = bubbles.append('circle')
      .attr('r', d => d.radius)
      .attr('fill', 'transparent')
      .attr('stroke', 'transparent')
      .style('pointer-events', 'all')
      .on('mouseenter', function(event, d) {
        cancelHideTooltip(); // 取消任何正在进行的隐藏延时
        
        const bubbleGroup = d3.select(this.parentNode as SVGGElement);
        bubbleGroup.select('circle')
          .transition()
          .duration(200)
          .attr('r', d.radius * 1.1)
          .attr('stroke-width', 3);

        const token = tokens.find(t => t.tokenAddress === d.tokenAddress);
        if (token) {
          setHoveredToken(token);
          setTooltipPos({ x: event.pageX, y: event.pageY });
        }
      })
      .on('mousemove', function(event) {
        setTooltipPos({ x: event.pageX, y: event.pageY });
      })
      .on('mouseleave', function(event, d) {
        const bubbleGroup = d3.select(this.parentNode as SVGGElement);
        bubbleGroup.select('circle')
          .transition()
          .duration(200)
          .attr('r', d.radius)
          .attr('stroke-width', 2);

        scheduleHideTooltip(); // 使用延迟隐藏
      })
      .on('click', function(event, d) {
        event.stopPropagation();
        const url = `https://dexscreener.com/${d.chainId}/${d.tokenAddress}`;
        window.open(url, '_blank');
      });

    // 添加图标
    bubbles.each(function(d, i) {
      const bubble = d3.select(this);
      
      // 创建裁剪路径
      bubble.append('clipPath')
        .attr('id', `clip-${i}`)
        .append('circle')
        .attr('r', d.radius);
      
      // 检查是否有有效的图片URL
      const hasValidIcon = d.iconUrl && d.iconUrl.trim() !== '' && 
                           (d.iconUrl.startsWith('http://') || d.iconUrl.startsWith('https://'));
      
      if (hasValidIcon) {
        // 添加图片
        bubble.append('image')
          .attr('href', d.iconUrl)
          .attr('xlink:href', d.iconUrl)
          .attr('crossorigin', 'anonymous')
          .attr('x', -d.radius)
          .attr('y', -d.radius)
          .attr('width', d.radius * 2)
          .attr('height', d.radius * 2)
          .attr('clip-path', `url(#clip-${i})`)
          .attr('preserveAspectRatio', 'xMidYMid slice')
          .style('opacity', 0.9)
          .style('pointer-events', 'none');
      } else {
        // 没有图片URL时显示首字母
        const initial = d.symbol.charAt(0).toUpperCase();
        const fontSize = d.radius * 0.8;
        
        // 添加大号首字母
        bubble.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', d.radius * 0.3)
          .style('font-size', `${fontSize}px`)
          .style('font-weight', '900')
          .style('fill', '#fff')
          .style('text-shadow', '3px 3px 6px rgba(0,0,0,0.5)')
          .style('pointer-events', 'none')
          .style('font-family', 'Arial, sans-serif')
          .text(initial);
      }
    });

    // 添加文字标签背景（半透明黑色背景）
    bubbles.each(function(d) {
      const bubble = d3.select(this);
      const fontSize = Math.max(12, d.radius / 4.5);
      const text = d.symbol.length > Math.floor(d.radius / 5) 
        ? d.symbol.substring(0, Math.floor(d.radius / 5)) + '...' 
        : d.symbol;
      
      // 所有气泡都添加背景矩形
      bubble.append('rect')
        .attr('x', -d.radius * 0.85)
        .attr('y', d.radius * 0.55)
        .attr('width', d.radius * 1.7)
        .attr('height', fontSize * 1.8)
        .attr('rx', fontSize * 0.5)
        .attr('fill', 'rgba(0, 0, 0, 0.75)')
        .style('pointer-events', 'none');
      
      // 添加文字
      bubble.append('text')
        .attr('dy', d.radius * 0.72 + fontSize * 0.7)
        .attr('text-anchor', 'middle')
        .style('font-size', `${fontSize}px`)
        .style('font-weight', 'bold')
        .style('fill', '#fff')
        .style('text-shadow', '1px 1px 3px rgba(0,0,0,0.9)')
        .style('pointer-events', 'none')
        .text(text);
    });

    // 更新位置
    simulation.on('tick', () => {
      bubbles.attr('transform', d => {
        // 限制气泡在画布范围内
        d.x = Math.max(d.radius, Math.min(width - d.radius, d.x!));
        d.y = Math.max(d.radius, Math.min(height - d.radius, d.y!));
        return `translate(${d.x},${d.y})`;
      });
    });

    // 添加缩放功能
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
      });

    svg.call(zoom);

    // 清理函数
    return () => {
      simulation.stop();
    };
  }, [tokens, displayMode]);

  const formatNumber = (num?: number) => {
    if (!num) return 'N/A';
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatPercentage = (num?: number) => {
    if (num === undefined) return 'N/A';
    const sign = num >= 0 ? '+' : '';
    return `${sign}${num.toFixed(2)}%`;
  };

  const formatCreatedAt = (timestamp?: number) => {
    if (!timestamp) return 'N/A';
    // 判断是秒级还是毫秒级时间戳
    const timestampMs = timestamp < 10000000000 ? timestamp * 1000 : timestamp;
    const date = new Date(timestampMs);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const copyToClipboard = async (text: string) => {
    try {
      // 优先使用现代 Clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        setCopiedAddress(true);
        console.log('✅ 复制成功:', text);
        setTimeout(() => setCopiedAddress(false), 2000);
        return;
      }

      // 备用方案：使用传统的 execCommand
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        setCopiedAddress(true);
        console.log('✅ 复制成功 (execCommand):', text);
        setTimeout(() => setCopiedAddress(false), 2000);
      } else {
        console.error('❌ 复制失败');
      }
    } catch (err) {
      console.error('❌ 复制失败:', err);
      // 即使失败也显示反馈，让用户知道点击了
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

  // 取消隐藏延时
  const cancelHideTooltip = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  // 延迟隐藏悬浮框
  const scheduleHideTooltip = () => {
    cancelHideTooltip();
    hideTimeoutRef.current = setTimeout(() => {
      setHoveredToken(null);
      setCopiedAddress(false);
    }, 500); // 300ms 延迟，给用户时间移动鼠标到悬浮框
  };

  const getChainName = (chainId: string) => {
    const chains: Record<string, string> = {
      'ethereum': 'Ethereum',
      'bsc': 'BSC',
      'polygon': 'Polygon',
      'solana': 'Solana',
      'arbitrum': 'Arbitrum',
      'optimism': 'Optimism',
      'base': 'Base',
      'avalanche': 'Avalanche',
    };
    return chains[chainId.toLowerCase()] || chainId.toUpperCase();
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <AnimatedShaderBackground />
        <div className={styles.loading}>加载中...</div>
      </div>
    );
  }

  const formatUpdateTime = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  return (
    <div className={styles.container}>
      <AnimatedShaderBackground />
      <div className={styles.header}>
        <div className={styles.filterContainer}>
          <div className={styles.chainSelector}>
            <button 
              className={`${styles.chainButton} ${selectedChain === 'solana' ? styles.active : ''}`}
              onClick={() => setSelectedChain('solana')}
            >
              <span className={styles.chainIcon}>◎</span>
              Solana
            </button>
            <button 
              className={`${styles.chainButton} ${selectedChain === 'bsc' ? styles.active : ''}`}
              onClick={() => setSelectedChain('bsc')}
            >
              <span className={styles.chainIcon}>💎</span>
              BSC
            </button>
            <button 
              className={`${styles.chainButton} ${selectedChain === 'base' ? styles.active : ''}`}
              onClick={() => setSelectedChain('base')}
            >
              <span className={styles.chainIcon}>🔵</span>
              Base
            </button>
          </div>
          
          <div className={styles.modeSelector}>
            <button 
              className={`${styles.modeButton} ${displayMode === 'all' ? styles.active : ''}`}
              onClick={() => setDisplayMode('all')}
            >
              <span className={styles.modeIcon}>📊</span>
              老盘
            </button>
          <button
              className={`${styles.modeButton} ${displayMode === 'new' ? styles.active : ''}`}
              onClick={() => setDisplayMode('new')}
            >
              <span className={styles.modeIcon}>🚀</span>
              新盘
          </button>
          </div>
        </div>
        
        <div className={styles.updateInfo}>
          <span>🔄 自动刷新：每分钟</span>
          <span>最后更新：{formatUpdateTime(lastUpdate)}</span>
        </div>
      </div>
      
      <div className={styles.mapWrapper}>
        <svg
          ref={svgRef}
          className={styles.svg}
          width="100%"
          height="100%"
        />
      </div>

      {hoveredToken && (
        <div 
          className={styles.tooltip}
          style={{
            left: tooltipPos.x + 10,
            top: tooltipPos.y + 10,
          }}
          onMouseEnter={cancelHideTooltip} // 鼠标进入悬浮框时取消隐藏
          onMouseLeave={scheduleHideTooltip} // 鼠标离开悬浮框时延迟隐藏
        >
          <div className={styles.tooltipHeader}>
            {hoveredToken.iconUrl && (
              <img
                src={hoveredToken.iconUrl}
                alt={hoveredToken.symbol}
                crossOrigin="anonymous"
                referrerPolicy="no-referrer"
              />
            )}
            <div>
              <h3>{hoveredToken.name || hoveredToken.symbol}</h3>
              <p className={styles.symbol}>{hoveredToken.symbol}</p>
            </div>
          </div>
          
          <div className={styles.tooltipContent}>
            <div className={styles.row}>
              <span className={styles.label}>合约地址:</span>
              <button
                className={`${styles.value} ${styles.copyableAddress}`}
                title={copiedAddress ? '已复制!' : '点击复制完整地址'}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  console.log('🖱️ 点击了合约地址，准备复制:', hoveredToken.tokenAddress);
                  copyToClipboard(hoveredToken.tokenAddress);
                }}
                type="button"
              >
                {hoveredToken.tokenAddress.substring(0, 6)}...
                {hoveredToken.tokenAddress.substring(hoveredToken.tokenAddress.length - 4)}
                {copiedAddress && <span className={styles.copiedIcon}> ✓ 已复制</span>}
                {!copiedAddress && <span style={{ marginLeft: '4px', opacity: 0.6, fontSize: '0.85em' }}>📋</span>}
              </button>
            </div>
            
            <div className={styles.row}>
              <span className={styles.label}>链:</span>
              <span className={styles.value}>{getChainName(hoveredToken.chainId)}</span>
            </div>
            
            <div className={styles.row}>
              <span className={styles.label}>市值:</span>
              <span className={styles.value}>{formatNumber(hoveredToken.marketCap)}</span>
            </div>
            
            {hoveredToken.pairCreatedAt && (
              <div className={styles.row}>
                <span className={styles.label}>创建时间:</span>
                <span className={styles.value}>{formatCreatedAt(hoveredToken.pairCreatedAt)}</span>
              </div>
            )}
            
            <div className={styles.row}>
              <span className={styles.label}>5分钟涨幅:</span>
              <span 
                className={`${styles.value} ${
                  (hoveredToken.priceChange?.m5 || 0) >= 0 
                    ? styles.positive 
                    : styles.negative
                }`}
              >
                {formatPercentage(hoveredToken.priceChange?.m5)}
              </span>
            </div>
            
            <div className={styles.row}>
              <span className={styles.label}>1小时涨幅:</span>
              <span 
                className={`${styles.value} ${
                  (hoveredToken.priceChange?.h1 || 0) >= 0 
                    ? styles.positive 
                    : styles.negative
                }`}
              >
                {formatPercentage(hoveredToken.priceChange?.h1)}
              </span>
            </div>
            
            <div className={styles.row}>
              <span className={styles.label}>24小时涨幅:</span>
              <span 
                className={`${styles.value} ${
                  (hoveredToken.priceChange?.h24 || 0) >= 0 
                    ? styles.positive 
                    : styles.negative
                }`}
              >
                {formatPercentage(hoveredToken.priceChange?.h24)}
              </span>
            </div>
        </div>

          <div className={styles.tooltipFooter}>
            💡 点击气泡查看 DexScreener 详情
          </div>
        </div>
      )}
    </div>
  );
}
