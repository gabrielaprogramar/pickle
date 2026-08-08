"use client";

import { useSyncExternalStore } from "react";
import Image from "next/image";

const DARK_LOGO = "/logo.png";
const LIGHT_LOGO = "/logo2.png";

function getLogoTheme(): "dark" | "light" {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function subscribeTheme(callback: () => void): () => void {
  const root = document.documentElement;
  const observer = new MutationObserver(callback);
  observer.observe(root, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

interface BrandLogoProps {
  readonly alt?: string;
  readonly width?: number;
  readonly height?: number;
  readonly className?: string;
  readonly priority?: boolean;
}

export function BrandLogo({
  alt = "Poseidon Ledger",
  width = 150,
  height = 26,
  className,
  priority,
}: BrandLogoProps) {
  const theme = useSyncExternalStore(subscribeTheme, getLogoTheme, () => "dark");

  return (
    <Image
      src={theme === "dark" ? DARK_LOGO : LIGHT_LOGO}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={priority}
    />
  );
}
