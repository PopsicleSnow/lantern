// Server-side helpers for reading BountyPool accounts on-chain. Used by GET
// /api/bounty and /api/bounty/available. We deliberately don't use Anchor's TS
// client here so the route works with or without the IDL JSON in place.

import { PublicKey } from '@solana/web3.js';
import {
  bountyPoolPDA,
  decodeBountyPool,
  getProgramIdOrNull,
  type BountyPoolState,
} from './program';
import { getConnection } from './connection';
import { BEAT_SLUGS, type BeatSlug } from './beats';

export interface OnChainBounty {
  pda: string;
  journalist_solana_pubkey: string;
  claim_authority: string;
  beat_slug: BeatSlug;
  amount_per_claim_lamports: string;
  amount_per_claim_sol: number;
  max_claims: number;
  claims_paid: number;
  claims_remaining: number;
  active: boolean;
  pool_balance_lamports: string;
}

function lamportsToSol(lamports: bigint): number {
  return Number(lamports) / 1e9;
}

function toOnChainBounty(
  pda: PublicKey,
  state: BountyPoolState,
  poolBalance: bigint
): OnChainBounty | null {
  if (!(BEAT_SLUGS as readonly string[]).includes(state.beat_slug)) return null;
  return {
    pda: pda.toBase58(),
    journalist_solana_pubkey: state.journalist.toBase58(),
    claim_authority: state.claim_authority.toBase58(),
    beat_slug: state.beat_slug as BeatSlug,
    amount_per_claim_lamports: state.amount_per_claim.toString(),
    amount_per_claim_sol: lamportsToSol(state.amount_per_claim),
    max_claims: state.max_claims,
    claims_paid: state.claims_paid,
    claims_remaining: Math.max(state.max_claims - state.claims_paid, 0),
    active: state.active,
    pool_balance_lamports: poolBalance.toString(),
  };
}

// Fetch a single pool by (journalist solana pubkey, beat slug). Returns null
// if the program isn't deployed, the journalist's pubkey is invalid, or the
// pool doesn't exist on-chain.
export async function fetchBountyPool(
  journalistSolanaPubkey: string,
  beatSlug: BeatSlug
): Promise<OnChainBounty | null> {
  const programId = getProgramIdOrNull();
  if (!programId) return null;

  let journalistKey: PublicKey;
  try {
    journalistKey = new PublicKey(journalistSolanaPubkey);
  } catch {
    return null;
  }

  const [pda] = bountyPoolPDA(journalistKey, beatSlug, programId);
  const connection = getConnection();
  const acct = await connection.getAccountInfo(pda, 'confirmed');
  if (!acct) return null;
  const state = decodeBountyPool(acct.data);
  if (!state) return null;
  return toOnChainBounty(pda, state, BigInt(acct.lamports));
}

interface JournalistRef {
  _id: string;
  name: string;
  organization: string;
  solana_pubkey: string;
}

// For each (journalist, beat) pair, fetch the on-chain pool. Pool addresses
// are batched into a single getMultipleAccountsInfo call to minimize RPC.
export async function fetchBountiesForJournalists(
  journalists: JournalistRef[],
  beats: readonly BeatSlug[] = BEAT_SLUGS
): Promise<Array<OnChainBounty & { journalist_id: string; journalist_name: string; organization: string }>> {
  const programId = getProgramIdOrNull();
  if (!programId || journalists.length === 0) return [];

  const connection = getConnection();
  const refs: Array<{ pda: PublicKey; journalist: JournalistRef; beat: BeatSlug }> = [];
  for (const j of journalists) {
    let pubkey: PublicKey;
    try {
      pubkey = new PublicKey(j.solana_pubkey);
    } catch {
      continue;
    }
    for (const beat of beats) {
      const [pda] = bountyPoolPDA(pubkey, beat, programId);
      refs.push({ pda, journalist: j, beat });
    }
  }
  if (refs.length === 0) return [];

  // getMultipleAccountsInfo accepts up to 100 keys per call; chunk if needed.
  const out: Array<OnChainBounty & { journalist_id: string; journalist_name: string; organization: string }> = [];
  for (let i = 0; i < refs.length; i += 99) {
    const slice = refs.slice(i, i + 99);
    const infos = await connection.getMultipleAccountsInfo(
      slice.map((r) => r.pda),
      'confirmed'
    );
    infos.forEach((info, idx) => {
      if (!info) return;
      const ref = slice[idx];
      const state = decodeBountyPool(info.data);
      if (!state) return;
      const pretty = toOnChainBounty(ref.pda, state, BigInt(info.lamports));
      if (!pretty) return;
      out.push({
        ...pretty,
        journalist_id: ref.journalist._id,
        journalist_name: ref.journalist.name,
        organization: ref.journalist.organization,
      });
    });
  }
  return out;
}

export async function claimReceiptExists(
  receiptPDA: PublicKey
): Promise<boolean> {
  const connection = getConnection();
  const acct = await connection.getAccountInfo(receiptPDA, 'confirmed');
  return !!acct;
}
