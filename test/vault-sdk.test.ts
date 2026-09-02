import assert from "node:assert/strict";
import test from "node:test";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  VAULT_PROGRAM_ID, deposit, initializeVault, parseTokenProgram, setAgent,
  setPaused, vaultPda, vaultTokenAccount, withdraw,
} from "../sdk/vault";

const owner = Keypair.generate().publicKey;
const agent = Keypair.generate().publicKey;
const mint = Keypair.generate().publicKey;
const source = Keypair.generate().publicKey;
const destination = Keypair.generate().publicKey;

test("derives a deterministic owner-scoped vault PDA", () => {
  const [actual, bump] = vaultPda(owner);
  const [expected, expectedBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), owner.toBuffer()], VAULT_PROGRAM_ID,
  );
  assert.equal(actual.toBase58(), expected.toBase58());
  assert.equal(bump, expectedBump);
});

test("builds initialize with exact signer and writable privileges", () => {
  const instruction = initializeVault(owner, agent);
  assert.equal(instruction.programId.toBase58(), VAULT_PROGRAM_ID.toBase58());
  assert.deepEqual(instruction.data, Buffer.from([0]));
  assert.deepEqual(instruction.keys.map(({ isSigner, isWritable }) => [isSigner, isWritable]), [
    [true, true], [true, false], [false, false], [false, true], [false, false],
  ]);
  assert.equal(instruction.keys[4].pubkey.toBase58(), SystemProgram.programId.toBase58());
});

test("encodes deposit and withdraw amounts as little-endian u64", () => {
  const args = { authority: owner, actor: agent, mint, source, destination, amount: 42_000_001n, decimals: 6 };
  const depositIx = deposit(args);
  const withdrawIx = withdraw(args);
  assert.equal(depositIx.data[0], 1);
  assert.equal(withdrawIx.data[0], 2);
  assert.equal(depositIx.data.readBigUInt64LE(1), 42_000_001n);
  assert.equal(depositIx.data[9], 6);
  assert.equal(depositIx.keys[5].pubkey.toBase58(), TOKEN_PROGRAM_ID.toBase58());
});

test("supports Token-2022 and derives the matching vault ATA", () => {
  const instruction = deposit({
    authority: owner, actor: agent, mint, source, destination, amount: 1n,
    decimals: 9, tokenProgram: TOKEN_2022_PROGRAM_ID,
  });
  assert.equal(instruction.keys[5].pubkey.toBase58(), TOKEN_2022_PROGRAM_ID.toBase58());
  assert.equal(
    vaultTokenAccount(owner, mint, TOKEN_2022_PROGRAM_ID).toBase58(),
    vaultTokenAccount(owner, mint, TOKEN_2022_PROGRAM_ID).toBase58(),
  );
});

test("encodes owner controls and rejects unsafe transfer values", () => {
  assert.deepEqual(setAgent(owner, agent).data, Buffer.concat([Buffer.from([3]), agent.toBuffer()]));
  assert.deepEqual(setPaused(owner, true).data, Buffer.from([4, 1]));
  assert.deepEqual(setPaused(owner, false).data, Buffer.from([4, 0]));
  assert.throws(() => deposit({ authority: owner, actor: owner, mint, source, destination, amount: 0n, decimals: 6 }), RangeError);
  assert.throws(() => withdraw({ authority: owner, actor: owner, mint, source, destination, amount: 1n, decimals: 256 }), RangeError);
  assert.equal(parseTokenProgram("token-2022").toBase58(), TOKEN_2022_PROGRAM_ID.toBase58());
  assert.throws(() => parseTokenProgram("unknown"));
});
