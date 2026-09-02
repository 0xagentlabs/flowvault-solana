export type LoginChallenge = { nonce: string; domain: string; issuedAt: string };

export function createLoginMessage(challenge: LoginChallenge, wallet: string) {
  return [
    "登录 FlowVault",
    "",
    `Wallet: ${wallet}`,
    `Domain: ${challenge.domain}`,
    `Nonce: ${challenge.nonce}`,
    `Issued At: ${challenge.issuedAt}`,
    "",
    "此签名不会发起交易或产生费用。",
  ].join("\n");
}
