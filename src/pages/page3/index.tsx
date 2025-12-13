import React, { useState } from 'react'
import styles from './index.module.css'
import Image from 'next/image';
import { Card, CardBody } from "@heroui/react";

interface Exchange {
  name: string;
  nameEn: string;
  logo: string;
  fallbackLogo?: string;
  link: string;
  color: string;
}

export default function Page3() {
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

  const exchanges: Exchange[] = [
    {
      name: '币安',
      nameEn: 'Binance',
      logo: 'https://cryptologos.cc/logos/binance-coin-bnb-logo.png',
      link: 'https://www.maxweb.cab/referral/earn-together/refer2earn-usdc/claim?hl=zh-CN&ref=GRO_28502_4LXP2&utm_source=default',
      color: '#F3BA2F'
    },
    {
      name: 'OKX',
      nameEn: 'OKX',
      logo: 'https://www.okx.com/cdn/assets/imgs/226/EB771F0EE8994DD5.png',
      link: 'https://www.bjwebptyiou.com/join/6460869',
      color: '#000000'
    },
    {
      name: 'Axiom',
      nameEn: 'Axiom Trade',
      logo: 'https://axiom.trade/logo.png',
      fallbackLogo: 'https://axiom.trade/favicon.ico',
      link: 'https://axiom.trade/@0xshahai',
      color: '#6366F1'
    },
    {
      name: 'GMGN',
      nameEn: 'GMGN.ai',
      logo: '/gmgn.png',
      fallbackLogo: '/gmgn.png',
      link: 'https://gmgn.ai/r/3ZRFy0OG',
      color: '#8B5CF6'
    }
  ];

  const handleImageError = (index: number, fallbackLogo?: string) => {
    if (!imageErrors[index] && fallbackLogo) {
      setImageErrors(prev => ({ ...prev, [index]: true }));
    }
  };

  return (
    <div className={styles.main}>
      <div className={styles.header}>
        <h1 className={styles.title}>Web3 导航</h1>
        <p className={styles.subtitle}>精选交易所邀请链接</p>
      </div>
      
      <div className={styles.exchangesContainer}>
        {exchanges.map((exchange, index) => (
          <a
            key={index}
            href={exchange.link}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.exchangeCard}
          >
            <Card className={styles.card} isPressable>
              <CardBody className={styles.cardBody}>
                <div className={styles.logoContainer}>
                  <Image
                    src={imageErrors[index] && exchange.fallbackLogo ? exchange.fallbackLogo : exchange.logo}
                    alt={exchange.name}
                    width={60}
                    height={60}
                    className={styles.logo}
                    unoptimized
                    onError={() => handleImageError(index, exchange.fallbackLogo)}
                  />
                </div>
                <div className={styles.info}>
                  <h3 className={styles.exchangeName}>{exchange.name}</h3>
                  <p className={styles.exchangeNameEn}>{exchange.nameEn}</p>
                  <div className={styles.badge}>点击注册</div>
                </div>
              </CardBody>
            </Card>
          </a>
        ))}
      </div>
    </div>
  )
}
