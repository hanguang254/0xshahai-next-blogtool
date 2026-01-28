"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface GlowingEffectProps {
  className?: string;
  glow?: boolean;
  disabled?: boolean;
  proximity?: number;
  inactiveZone?: number;
  spread?: number;
  borderWidth?: number;
  color?: string;
}

export function GlowingEffect({
  className,
  glow = true,
  disabled = false,
  proximity = 64,
  inactiveZone = 0.12,
  spread = 80,
  borderWidth = 2,
  color = "rgba(59, 130, 246, 0.75)",
}: GlowingEffectProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (disabled) {
      return;
    }

    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) {
      return;
    }

    const update = (x: number, y: number, opacity: number) => {
      el.style.setProperty("--glow-x", `${x}px`);
      el.style.setProperty("--glow-y", `${y}px`);
      el.style.setProperty("--glow-opacity", `${opacity}`);
    };

    const handleMove = (clientX: number, clientY: number) => {
      const rect = parent.getBoundingClientRect();
      const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
      const y = Math.min(Math.max(clientY - rect.top, 0), rect.height);

      const distX = Math.min(x, rect.width - x);
      const distY = Math.min(y, rect.height - y);
      const edgeDistance = Math.min(distX, distY);

      const proximityPx = Math.max(proximity, 1);
      const edgeFactor = Math.min(edgeDistance / proximityPx, 1);
      const rawOpacity = 1 - edgeFactor;

      const inactive = Math.min(Math.max(inactiveZone, 0), 0.99);
      const opacity =
        rawOpacity <= inactive ? 0 : (rawOpacity - inactive) / (1 - inactive);

      update(x, y, opacity);
    };

    const handlePointerMove = (event: PointerEvent) => {
      handleMove(event.clientX, event.clientY);
    };

    const handleMouseMove = (event: MouseEvent) => {
      handleMove(event.clientX, event.clientY);
    };

    const handleLeave = () => {
      update(0, 0, glow ? 0.15 : 0);
    };

    parent.addEventListener("pointermove", handlePointerMove);
    parent.addEventListener("pointerleave", handleLeave);
    parent.addEventListener("mousemove", handleMouseMove);
    parent.addEventListener("mouseleave", handleLeave);

    return () => {
      parent.removeEventListener("pointermove", handlePointerMove);
      parent.removeEventListener("pointerleave", handleLeave);
      parent.removeEventListener("mousemove", handleMouseMove);
      parent.removeEventListener("mouseleave", handleLeave);
    };
  }, [disabled, inactiveZone, proximity]);

  const sharedStyle: React.CSSProperties = {
    padding: "var(--glow-border)",
    background:
      "radial-gradient(circle var(--glow-spread) at var(--glow-x) var(--glow-y), var(--glow-color), rgba(0, 0, 0, 0) 65%)",
    WebkitMask:
      "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
    WebkitMaskComposite: "xor",
    maskComposite: "exclude",
    opacity: "var(--glow-opacity)",
  };

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 z-0 rounded-[inherit] transition-opacity duration-200",
        className
      )}
      style={
        {
          "--glow-x": "50%",
          "--glow-y": "50%",
          "--glow-opacity": glow ? 0.35 : 0,
          "--glow-spread": `${spread}px`,
          "--glow-border": `${borderWidth}px`,
          "--glow-color": color,
        } as React.CSSProperties
      }
    >
      {glow ? (
        <div
          className="absolute inset-0 rounded-[inherit] blur-[18px]"
          style={sharedStyle}
        />
      ) : null}
      <div className="absolute inset-0 rounded-[inherit]" style={sharedStyle} />
    </div>
  );
}
