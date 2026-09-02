"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useEffect, useMemo, useState } from "react";
import { createLoginMessage, type LoginChallenge } from "@/lib/login-message";

type Access = { cluster: string; programId: string; memberships: { account: string; tenant: string; role: string; expiresAt: number | null }[] };

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
};

const compact = (address: string) => `${address.slice(0, 5)}…${address.slice(-5)}`;

export default function Home() {
  const { publicKey, connected, disconnect, signMessage } = useWallet();
  const [address, setAddress] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [status, setStatus] = useState("连接钱包以继续");
  const [busy, setBusy] = useState(false);
  const [access, setAccess] = useState<Access | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then(async (response) => response.ok ? response.json() as Promise<{ wallet: string }> : null)
      .then((session) => {
        if (session?.wallet) {
          setAddress(session.wallet);
          setAuthenticated(true);
          setStatus("已通过签名验证");
          void fetch("/api/controller/access").then((r) => r.ok ? r.json() : null).then(setAccess);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const next = publicKey?.toBase58() ?? "";
    if (!next || next === address) return;
    if (address) {
      setAuthenticated(false);
      setAccess(null);
      void fetch("/api/auth/session", { method: "DELETE" });
      setStatus("账户已切换，请重新签名");
    }
    setAddress(next);
  }, [publicKey, address]);

  const avatar = useMemo(() => address.slice(0, 2).toUpperCase() || "◎", [address]);

  async function login() {
    setBusy(true);
    try {
      if (!connected || !publicKey) throw new Error("请先选择并连接钱包");
      if (!signMessage) throw new Error("该钱包不支持消息签名登录，请选择其他钱包");
      const walletAddress = publicKey.toBase58();
      setAddress(walletAddress);
      setStatus("等待钱包签名…");
      const challengeResponse = await fetch("/api/auth/challenge", { cache: "no-store" });
      if (!challengeResponse.ok) throw new Error("无法创建登录请求");
      const challenge = await challengeResponse.json() as LoginChallenge;
      const statement = createLoginMessage(challenge, walletAddress);
      const signature = await signMessage(new TextEncoder().encode(statement));
      const verification = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: walletAddress, signature: toBase64(signature) }),
      });
      const result = await verification.json() as { error?: string };
      if (!verification.ok) throw new Error(result.error ?? "钱包签名验证失败");
      setAuthenticated(true);
      setStatus("已通过签名验证");
      const accessResponse = await fetch("/api/controller/access", { cache: "no-store" });
      if (accessResponse.ok) setAccess(await accessResponse.json() as Access);
    } catch (error) {
      const message = error instanceof Error ? error.message : "操作已取消";
      setStatus(/reject|cancel/i.test(message) ? "你取消了钱包操作，可以重新签名" : message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await Promise.all([
      disconnect().catch(() => undefined),
      fetch("/api/auth/session", { method: "DELETE" }).catch(() => undefined),
    ]);
    setAddress("");
    setAuthenticated(false);
    setAccess(null);
    setStatus("已安全退出");
  }

  return (
    <main>
      <nav>
        <a className="brand" href="#" aria-label="FlowVault 首页">
          <span className="brandMark">F</span>
          <span>FlowVault</span>
        </a>
        <span className="network"><i /> Devnet live</span>
      </nav>

      <section className="hero">
        <div className="eyebrow"><span>◆</span> AGENT-NATIVE TREASURY</div>
        <h1>让资金自动流动，<br /><em>控制权始终在你。</em></h1>
        <p className="lede">FlowVault 是面向 AI Agent 与团队的非托管 Solana 金库。委托自动执行、设置单笔限额，随时链上一键暂停。</p>

        <div className="card">
          <div className="glow" />
          {authenticated ? (
            <>
              <div className="walletAvatar">{avatar}</div>
              <div className="success">✓ 身份已验证</div>
              <h2>欢迎回来</h2>
              <div className="address">{compact(address)} <button onClick={() => navigator.clipboard.writeText(address)} aria-label="复制钱包地址">⧉</button></div>
              <section className="accessPanel" aria-labelledby="access-title">
                <div className="accessHeading"><span id="access-title">链上权限</span><small>DEVNET</small></div>
                {access?.memberships.length ? access.memberships.map((member) => (
                  <div className="membership" key={member.account}>
                    <span><strong>{member.role}</strong><small>租户 {compact(member.tenant)}</small></span>
                    <i className="verified">已验证</i>
                  </div>
                )) : <p className="emptyAccess">该钱包暂无链上租户权限</p>}
                <a className="programLink" href={`https://explorer.solana.com/address/${access?.programId ?? "HzZSNAsacNF61tfNDa8sr9PS8fVzfxfunh7A6yVRmaFp"}?cluster=devnet`} target="_blank" rel="noreferrer">查看控制器程序</a>
              </section>
              <button className="primary" onClick={logout}>断开连接</button>
            </>
          ) : (
            <>
              <div className="walletIcon" aria-hidden="true">FV</div>
              <h2>打开你的控制台</h2>
              <p>安全签名验证所有权，不发送交易、不收取费用。</p>
              <WalletMultiButton className="walletAdapterButton" />
              <button className="primary" onClick={login} disabled={busy || !connected}>{busy ? "等待钱包签名…" : connected ? "签名并登录" : "连接钱包后继续"}<span>→</span></button>
              <div className="status" aria-live="polite"><i /> {status}</div>
            </>
          )}
        </div>

        <div className="trust">
          <span>非托管金库</span><span>Token + Token-2022</span><span>Owner 紧急暂停</span>
        </div>
      </section>
      <footer>FlowVault · Built on <strong>Solana</strong><span>Programmable · Non-custodial · Auditable</span></footer>
    </main>
  );
}
