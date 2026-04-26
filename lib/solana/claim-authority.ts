// Server-side claim authority signer. Loads the keypair from
// SOLANA_CLAIM_AUTHORITY_KEYPAIR (base58-encoded 64-byte secret key) and
// builds + sends the claim_bounty instruction after MongoDB checks pass.

import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { createHash } from 'node:crypto';
import { getConnection } from './connection';
import { buildClaimBountyIx, claimReceiptPDA } from './program';
import { BeatSlug } from './beats';

let _keypair: Keypair | null = null;

export function getClaimAuthorityKeypair(): Keypair {
  if (_keypair) return _keypair;
  const raw = process.env.SOLANA_CLAIM_AUTHORITY_KEYPAIR;
  if (!raw) throw new Error('SOLANA_CLAIM_AUTHORITY_KEYPAIR is not set');
  try {
    const secret = bs58.decode(raw);
    _keypair = Keypair.fromSecretKey(secret);
    return _keypair;
  } catch (e) {
    throw new Error('SOLANA_CLAIM_AUTHORITY_KEYPAIR is not a valid base58 secret key: ' + (e as Error).message);
  }
}

export function getClaimAuthorityKeypairOrNull(): Keypair | null {
  try {
    return getClaimAuthorityKeypair();
  } catch {
    return null;
  }
}

export function computeServerClaimHash(tipId: string, nullifierHash: string): Buffer {
  return createHash('sha256').update(tipId + nullifierHash).digest();
}

export interface SubmitClaimArgs {
  tipId: string;
  nullifierHash: string;
  recipientPubkey: PublicKey;
  journalistPubkey: PublicKey;
  beatSlug: BeatSlug;
  poolPda: PublicKey;
}

export interface SubmitClaimResult {
  tx_sig: string;
  receipt_pda: string;
  claim_hash_hex: string;
}

export async function submitClaim(args: SubmitClaimArgs): Promise<SubmitClaimResult> {
  const authority = getClaimAuthorityKeypair();
  const connection = getConnection();

  const claimHash = computeServerClaimHash(args.tipId, args.nullifierHash);
  const [receiptPda] = claimReceiptPDA(claimHash);

  const ix: TransactionInstruction = buildClaimBountyIx({
    pool: args.poolPda,
    journalist: args.journalistPubkey,
    claim_authority: authority.publicKey,
    recipient: args.recipientPubkey,
    claim_hash: claimHash,
    beat_slug: args.beatSlug,
  });

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  const tx = new Transaction().add(ix);
  tx.feePayer = authority.publicKey;
  tx.recentBlockhash = blockhash;
  tx.sign(authority);

  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });
  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    'confirmed'
  );

  return {
    tx_sig: sig,
    receipt_pda: receiptPda.toBase58(),
    claim_hash_hex: claimHash.toString('hex'),
  };
}
