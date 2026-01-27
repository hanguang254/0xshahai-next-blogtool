"use client"

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  name: string
  url: string
  icon: LucideIcon
}

interface NavBarProps {
  items: NavItem[]
  className?: string
}

export function NavBar({ items, className }: NavBarProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [activeIndex, setActiveIndex] = useState<number>(0)

  return (
    <nav
      className={cn(
        'flex items-center justify-center gap-2 rounded-full border border-white/10 bg-black/40 backdrop-blur-md p-2',
        className
      )}
    >
      {items.map((item, index) => {
        const Icon = item.icon
        const isHovered = hoveredIndex === index
        const isActive = activeIndex === index

        return (
          <a
            key={item.name}
            href={item.url}
            onClick={() => setActiveIndex(index)}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            className="relative rounded-full px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:text-white"
          >
            <div className="relative z-10 flex items-center gap-2">
              <Icon className="h-4 w-4" />
              <span>{item.name}</span>
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
        )
      })}
    </nav>
  )
}
