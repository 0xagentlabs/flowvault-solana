import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import { loginMessage, verifyWalletSignature } from "../lib/auth";
import { createLoginMessage } from "../lib/login-message";

const toBase58 = (input: Uint8Array) => {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let value = BigInt(`0x${Buffer.from(input).toString("hex")}`);
  let encoded = "";
  while (value > 0n) {
    encoded = alphabet[Number(value % 58n)] + encoded;
    value /= 58n;
  }
  for (const byte of input) {
    if (byte !== 0) break;
    encoded = `1${encoded}`;
  }
  return encoded;
};

test("client and server build the same FlowVault login message", () => {
  const challenge = {
    nonce: "test-nonce",
    domain: "flowvault.example",
    issuedAt: "2026-09-02T00:00:00.000Z",
    expiresAt: Date.now() + 60_000,
  };
  assert.equal(loginMessage(challenge, "wallet-address"), createLoginMessage(challenge, "wallet-address"));
  assert.match(loginMessage(challenge, "wallet-address"), /^登录 FlowVault\n/);
});

test("server verifies a signature over the shared login message", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const rawPublicKey = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  const wallet = toBase58(rawPublicKey);
  const message = createLoginMessage({ nonce: "nonce", domain: "localhost:3000", issuedAt: "2026-09-02T00:00:00.000Z" }, wallet);
  const signature = sign(null, Buffer.from(message), privateKey).toString("base64");

  assert.equal(verifyWalletSignature(wallet, message, signature), true);
  assert.equal(verifyWalletSignature(wallet, `${message}!`, signature), false);
});
