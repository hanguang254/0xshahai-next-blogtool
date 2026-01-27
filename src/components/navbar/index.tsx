import React, { useEffect, useState } from "react";
import {Navbar, NavbarBrand, NavbarContent, NavbarItem, Link, Button, NavbarMenuItem, NavbarMenu, NavbarMenuToggle} from "@heroui/react";
import {AcmeLogo} from "./AcmeLogo.jsx";
import { useRouter } from "next/router.js";
import styles from './index.module.css'
import { motion } from 'framer-motion'

import { ConnectButton } from '@rainbow-me/rainbowkit';


export default function App() {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const router = useRouter(); // 获取路由信息
  
  
  const menuItems = [
    { label: "主页", route: "/owner" },
    // { label: "Web3工具", route: "/tools" }, // 暂不显示
    { label: "Web3导航", route: "/page3"},
    { label: "合约钱包", route: "/wallet"},
  ];


  useEffect(() => {
    const handleHashChange = () => {
      // 获取当前哈希路由
      const hashRoute = window.location.hash.substring(1);
      // 使用 router.replace 触发路由变化
      router.replace(hashRoute, undefined, { shallow: true });
    };

    // 添加哈希路由变化事件监听
    window.addEventListener("hashchange", handleHashChange);

    return () => {
      // 在组件卸载时移除事件监听
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [router]);

  return (
    <Navbar onMenuOpenChange={setIsMenuOpen} className={styles.Navbar}>
      <NavbarContent>
        <NavbarMenuToggle
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          className="sm:hidden"
        />
        <NavbarBrand>
          <AcmeLogo />
          <p className="font-bold text-inherit">0xshahai</p>
        </NavbarBrand>
      </NavbarContent>

      <NavbarContent className="hidden sm:flex gap-2" justify="center">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 backdrop-blur-md p-2">
          {menuItems.map((item, index) => {
            const isHovered = hoveredIndex === index;
            const isActive = activeIndex === index;

            return (
              <a
                key={`${item.label}-${index}`}
                href={`#${item.route}`}
                onClick={() => setActiveIndex(index)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="relative rounded-full px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:text-white"
              >
                <div className="relative z-10">
                  <span>{item.label}</span>
                </div>

                {/* Tubelight glow effect */}
                {(isHovered || isActive) && (
                  <motion.div
                    layoutId="tubelight"
                    className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20"
                    style={{
                      boxShadow: isHovered
                        ? '0 0 20px rgba(139, 92, 246, 0.6), 0 0 40px rgba(139, 92, 246, 0.4), inset 0 0 20px rgba(139, 92, 246, 0.2)'
                        : '0 0 10px rgba(139, 92, 246, 0.4), inset 0 0 10px rgba(139, 92, 246, 0.1)',
                    }}
                    transition={{
                      type: 'spring',
                      stiffness: 380,
                      damping: 30,
                    }}
                  />
                )}

                {/* Animated border glow */}
                {isHovered && (
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.8), transparent)',
                      backgroundSize: '200% 100%',
                    }}
                    animate={{
                      backgroundPosition: ['0% 0%', '200% 0%'],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                  />
                )}
              </a>
            );
          })}
        </div>
      </NavbarContent>
      <NavbarContent justify="end">
        <NavbarItem>
          {/* 链接按钮 */}
          <ConnectButton label="Connect Wallet" showBalance={false} accountStatus={{smallScreen: 'avatar',largeScreen: 'full',}}  />

        </NavbarItem>
      </NavbarContent>

      <NavbarMenu>
        {menuItems.map((item, index) => (
          <NavbarMenuItem key={`${item.label}-${index}`}>
            <Link
              color="foreground"
              className="w-full"
              href={item.route}
              size="lg"
            >
              {item.label}
            </Link>
          </NavbarMenuItem>
        ))}
      </NavbarMenu>
    </Navbar>
  );
}
