import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import { BEAT_SLUGS, type BeatSlug } from './beats';

// ---------------------------------------------------------------------------
// Program constants
// ---------------------------------------------------------------------------
//
// PROGRAM_ID is read from NEXT_PUBLIC_SOLANA_PROGRAM_ID. The wrapper functions
// throw a clear error if the env var is missing so the app degrades gracefully
// before the program is deployed.

export function getProgramId(): PublicKey {
  const id = process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ID;
  if (!id) throw new Error('NEXT_PUBLIC_SOLANA_PROGRAM_ID is not set');
  try {
    return new PublicKey(id);
  } catch {
    throw new Error(`NEXT_PUBLIC_SOLANA_PROGRAM_ID is not a valid base58 pubkey: ${id}`);
  }
}

export function getProgramIdOrNull(): PublicKey | null {
  try {
    return getProgramId();
  } catch {
    return null;
  }
}

// Anchor instruction discriminators: sha256("global:<snake_name>") first 8 bytes.
export const IX_DISCRIMINATORS = {
  create_bounty: new Uint8Array([122, 90, 14, 143, 8, 125, 200, 2]),
  claim_bounty: new Uint8Array([225, 157, 163, 238, 239, 169, 75, 226]),
  close_bounty: new Uint8Array([90, 33, 205, 110, 210, 22, 247, 49]),
  top_up_bounty: new Uint8Array([92, 218, 186, 142, 94, 191, 155, 242]),
} as const;

// Anchor account discriminators: sha256("account:<PascalName>") first 8 bytes.
export const ACCOUNT_DISCRIMINATORS = {
  BountyPool: new Uint8Array([36, 23, 141, 200, 254, 71, 41, 171]),
  ClaimReceipt: new Uint8Array([223, 233, 11, 229, 124, 165, 207, 28]),
} as const;

// ---------------------------------------------------------------------------
// Borsh helpers (manual)
// ---------------------------------------------------------------------------

class BorshWriter {
  private buf: number[] = [];

  writeU8(n: number) {
    this.buf.push(n & 0xff);
  }
  writeU32LE(n: number) {
    this.buf.push(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff);
  }
  writeU64LE(n: bigint) {
    let v = BigInt.asUintN(64, n);
    const MASK = BigInt(0xff);
    const SHIFT = BigInt(8);
    for (let i = 0; i < 8; i++) {
      this.buf.push(Number(v & MASK));
      v >>= SHIFT;
    }
  }
  writeBytes(b: Uint8Array) {
    for (const x of b) this.buf.push(x);
  }
  writeString(s: string) {
    const enc = new TextEncoder().encode(s);
    this.writeU32LE(enc.length);
    this.writeBytes(enc);
  }
  toBuffer(): Buffer {
    return Buffer.from(Uint8Array.from(this.buf));
  }
}

class BorshReader {
  private offset = 0;
  constructor(private readonly bytes: Uint8Array) {}

  readU8(): number {
    return this.bytes[this.offset++];
  }
  readU32LE(): number {
    const b = this.bytes;
    const o = this.offset;
    const v = b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24);
    this.offset += 4;
    return v >>> 0;
  }
  readI64LE(): bigint {
    let v = BigInt(0);
    const SHIFT = BigInt(8);
    for (let i = 0; i < 8; i++) v |= BigInt(this.bytes[this.offset + i]) << (SHIFT * BigInt(i));
    this.offset += 8;
    const SIGN_BIT = BigInt(1) << BigInt(63);
    const TWO_64 = BigInt(1) << BigInt(64);
    if (v & SIGN_BIT) v -= TWO_64;
    return v;
  }
  readU64LE(): bigint {
    let v = BigInt(0);
    const SHIFT = BigInt(8);
    for (let i = 0; i < 8; i++) v |= BigInt(this.bytes[this.offset + i]) << (SHIFT * BigInt(i));
    this.offset += 8;
    return v;
  }
  readBytes(n: number): Uint8Array {
    const out = this.bytes.slice(this.offset, this.offset + n);
    this.offset += n;
    return out;
  }
  readString(): string {
    const len = this.readU32LE();
    const bytes = this.readBytes(len);
    return new TextDecoder().decode(bytes);
  }
  readPubkey(): PublicKey {
    return new PublicKey(this.readBytes(32));
  }
  readBool(): boolean {
    return this.readU8() !== 0;
  }
}

// ---------------------------------------------------------------------------
// PDAs
// ---------------------------------------------------------------------------

export function bountyPoolPDA(
  journalist: PublicKey,
  beatSlug: string,
  programId: PublicKey = getProgramId()
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('bounty_pool'), journalist.toBuffer(), Buffer.from(beatSlug)],
    programId
  );
}

export function claimReceiptPDA(
  claimHash: Uint8Array,
  programId: PublicKey = getProgramId()
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('claim'), Buffer.from(claimHash)],
    programId
  );
}

// ---------------------------------------------------------------------------
// Account decoding
// ---------------------------------------------------------------------------

export interface BountyPoolState {
  journalist: PublicKey;
  claim_authority: PublicKey;
  beat_slug: string;
  amount_per_claim: bigint;
  max_claims: number;
  claims_paid: number;
  active: boolean;
  bump: number;
}

export function decodeBountyPool(data: Uint8Array): BountyPoolState | null {
  if (data.length < 8) return null;
  for (let i = 0; i < 8; i++) {
    if (data[i] !== ACCOUNT_DISCRIMINATORS.BountyPool[i]) return null;
  }
  const r = new BorshReader(data.slice(8));
  return {
    journalist: r.readPubkey(),
    claim_authority: r.readPubkey(),
    beat_slug: r.readString(),
    amount_per_claim: r.readU64LE(),
    max_claims: r.readU32LE(),
    claims_paid: r.readU32LE(),
    active: r.readBool(),
    bump: r.readU8(),
  };
}

export interface ClaimReceiptState {
  claim_hash: Uint8Array;
  pool: PublicKey;
  paid_at: bigint;
}

export function decodeClaimReceipt(data: Uint8Array): ClaimReceiptState | null {
  if (data.length < 8) return null;
  for (let i = 0; i < 8; i++) {
    if (data[i] !== ACCOUNT_DISCRIMINATORS.ClaimReceipt[i]) return null;
  }
  const r = new BorshReader(data.slice(8));
  return {
    claim_hash: r.readBytes(32),
    pool: r.readPubkey(),
    paid_at: r.readI64LE(),
  };
}

// ---------------------------------------------------------------------------
// Instruction builders (manual Anchor encoding)
// ---------------------------------------------------------------------------

export interface CreateBountyArgs {
  journalist: PublicKey;
  claim_authority: PublicKey;
  beat_slug: BeatSlug;
  amount_per_claim_lamports: bigint;
  max_claims: number;
}

export function buildCreateBountyIx(args: CreateBountyArgs): TransactionInstruction {
  const programId = getProgramId();
  const [pool] = bountyPoolPDA(args.journalist, args.beat_slug, programId);

  const w = new BorshWriter();
  w.writeBytes(IX_DISCRIMINATORS.create_bounty);
  w.writeString(args.beat_slug);
  w.writeU64LE(args.amount_per_claim_lamports);
  w.writeU32LE(args.max_claims);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: pool, isSigner: false, isWritable: true },
      { pubkey: args.journalist, isSigner: true, isWritable: true },
      { pubkey: args.claim_authority, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: w.toBuffer(),
  });
}

export interface ClaimBountyArgs {
  pool: PublicKey;
  journalist: PublicKey;
  claim_authority: PublicKey;
  recipient: PublicKey;
  claim_hash: Uint8Array;
  beat_slug: string;
}

export function buildClaimBountyIx(args: ClaimBountyArgs): TransactionInstruction {
  const programId = getProgramId();
  const [receipt] = claimReceiptPDA(args.claim_hash, programId);

  const w = new BorshWriter();
  w.writeBytes(IX_DISCRIMINATORS.claim_bounty);
  w.writeBytes(args.claim_hash);
  w.writeString(args.beat_slug);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: args.pool, isSigner: false, isWritable: true },
      { pubkey: receipt, isSigner: false, isWritable: true },
      { pubkey: args.claim_authority, isSigner: true, isWritable: true },
      { pubkey: args.recipient, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: w.toBuffer(),
  });
}

export interface CloseBountyArgs {
  journalist: PublicKey;
  beat_slug: string;
}

export function buildCloseBountyIx(args: CloseBountyArgs): TransactionInstruction {
  const programId = getProgramId();
  const [pool] = bountyPoolPDA(args.journalist, args.beat_slug, programId);

  const w = new BorshWriter();
  w.writeBytes(IX_DISCRIMINATORS.close_bounty);
  w.writeString(args.beat_slug);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: pool, isSigner: false, isWritable: true },
      { pubkey: args.journalist, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: w.toBuffer(),
  });
}

export interface TopUpBountyArgs {
  journalist: PublicKey;
  beat_slug: string;
  additional_claims: number;
}

export function buildTopUpBountyIx(args: TopUpBountyArgs): TransactionInstruction {
  const programId = getProgramId();
  const [pool] = bountyPoolPDA(args.journalist, args.beat_slug, programId);

  const w = new BorshWriter();
  w.writeBytes(IX_DISCRIMINATORS.top_up_bounty);
  w.writeString(args.beat_slug);
  w.writeU32LE(args.additional_claims);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: pool, isSigner: false, isWritable: true },
      { pubkey: args.journalist, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: w.toBuffer(),
  });
}

// ---------------------------------------------------------------------------
// Anchor error decoding
// ---------------------------------------------------------------------------

export const ANCHOR_ERROR_CODES: Record<number, string> = {
  6000: 'Claim authority mismatch or unauthorized journalist',
  6001: 'Pool is no longer active',
  6002: 'Pool has no claims remaining',
  6003: 'Beat slug too long (max 32 bytes)',
  6004: 'amount_per_claim must be >= 1_000_000 lamports (0.001 SOL)',
  6005: 'max_claims must be > 0',
  6006: 'Arithmetic overflow',
  6007: 'Pool would fall below rent-exempt minimum after claim',
};

export function explainAnchorError(err: unknown): string {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err && 'message' in err
        ? String((err as { message?: unknown }).message)
        : String(err);
  const m = msg.match(/custom program error: (0x[0-9a-fA-F]+|\d+)/);
  if (m) {
    const code = m[1].startsWith('0x') ? parseInt(m[1], 16) : parseInt(m[1], 10);
    if (ANCHOR_ERROR_CODES[code]) return ANCHOR_ERROR_CODES[code];
  }
  return msg;
}

export { BEAT_SLUGS };
