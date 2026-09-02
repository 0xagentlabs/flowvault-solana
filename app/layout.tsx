import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlowVault — Agent-Native Solana Treasury",
  description: "Non-custodial treasury automation for AI agents and teams on Solana.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
