// POST /api/bounty/claim
// Body: {
//   tip_id, nullifier_hash, recipient_wallet,
//   beat_slug?, journalist_solana_pubkey?
// }
//
// Verifies (server-side) that:
//   1. The tip exists and is `closed`.
//   2. The supplied nullifier_hash matches the one stored on the tip.
//   3. A bounty is available for (assigned_journalist, beat_slug).
//   4. The bounty hasn't already been claimed (no ClaimReceipt PDA on-chain
//      AND tip.bounty_claimed === false in MongoDB).
// Then signs and submits `claim_bounty` with the server's claim authority key.

import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import dbConnect from '@/lib/mongodb';
import Tip from '@/lib/models/Tip';
import Journalist from '@/lib/models/Journalist';
import {
  getClaimAuthorityKeypairOrNull,
  submitClaim,
  computeServerClaimHash,
} from '@/lib/solana/claim-authority';
import {
  bountyPoolPDA,
  claimReceiptPDA,
  decodeBountyPool,
  getProgramIdOrNull,
  explainAnchorError,
} from '@/lib/solana/program';
import { getConnection } from '@/lib/solana/connection';
import { bestBeatSlugForTip, isBeatSlug, type BeatSlug } from '@/lib/solana/beats';

export async function POST(req: NextRequest) {
  const programId = getProgramIdOrNull();
  if (!programId) {
    return NextResponse.json(
      { error: 'Solana program is not configured (NEXT_PUBLIC_SOLANA_PROGRAM_ID missing)' },
      { status: 503 }
    );
  }

  const authority = getClaimAuthorityKeypairOrNull();
  if (!authority) {
    return NextResponse.json(
      { error: 'Server claim authority is not configured (SOLANA_CLAIM_AUTHORITY_KEYPAIR missing)' },
      { status: 503 }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    tip_id?: string;
    nullifier_hash?: string;
    recipient_wallet?: string;
    beat_slug?: string;
    journalist_solana_pubkey?: string;
  } | null;
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const { tip_id, nullifier_hash, recipient_wallet } = body;
  if (!tip_id || !/^[0-9a-fA-F]{24}$/.test(tip_id)) {
    return NextResponse.json({ error: 'Invalid tip_id' }, { status: 400 });
  }
  if (!nullifier_hash || typeof nullifier_hash !== 'string') {
    return NextResponse.json({ error: 'nullifier_hash required' }, { status: 400 });
  }
  if (!recipient_wallet || typeof recipient_wallet !== 'string') {
    return NextResponse.json({ error: 'recipient_wallet required' }, { status: 400 });
  }

  let recipientPubkey: PublicKey;
  try {
    recipientPubkey = new PublicKey(recipient_wallet);
  } catch (e) {
    return NextResponse.json(
      { error: 'recipient_wallet is not a valid base58 pubkey: ' + (e as Error).message },
      { status: 400 }
    );
  }

  await dbConnect();
  const tip = await Tip.findById(tip_id);
  if (!tip) return NextResponse.json({ error: 'Tip not found' }, { status: 404 });
  if (tip.status !== 'closed') {
    return NextResponse.json(
      { error: 'Tip has not been marked closed yet' },
      { status: 400 }
    );
  }
  if (tip.nullifier_hash !== nullifier_hash) {
    return NextResponse.json({ error: 'Nullifier mismatch' }, { status: 403 });
  }
  if (tip.bounty_claimed) {
    return NextResponse.json(
      { error: 'Bounty already claimed for this tip' },
      { status: 409 }
    );
  }

  const journalistId = tip.assigned_journalist_id;
  if (!journalistId) {
    return NextResponse.json({ error: 'No journalist assigned to this tip' }, { status: 400 });
  }

  const journalist = await Journalist.findById(journalistId);
  if (!journalist || !journalist.solana_pubkey) {
    return NextResponse.json({ error: 'Assigned journalist has no Solana wallet' }, { status: 400 });
  }

  // Resolve the (journalist_pubkey, beat_slug) pair. Caller may override beat_slug;
  // otherwise we infer it from the tip's category/beats.
  let beatSlug: BeatSlug | null = null;
  if (body.beat_slug && isBeatSlug(body.beat_slug)) {
    beatSlug = body.beat_slug;
  } else {
    beatSlug = bestBeatSlugForTip(tip.category, tip.beats_matched ?? []);
  }
  if (!beatSlug) {
    return NextResponse.json(
      { error: 'Could not infer a bounty beat slug for this tip' },
      { status: 400 }
    );
  }

  let journalistPubkey: PublicKey;
  try {
    journalistPubkey = new PublicKey(journalist.solana_pubkey);
  } catch (e) {
    return NextResponse.json(
      { error: 'Journalist Solana pubkey is invalid: ' + (e as Error).message },
      { status: 500 }
    );
  }

  // Look up the on-chain pool first so we can short-circuit with a friendly error.
  const [poolPda] = bountyPoolPDA(journalistPubkey, beatSlug, programId);
  const connection = getConnection();
  const poolInfo = await connection.getAccountInfo(poolPda, 'confirmed');
  if (!poolInfo) {
    return NextResponse.json(
      { error: 'No bounty pool exists for this journalist + beat' },
      { status: 404 }
    );
  }
  const pool = decodeBountyPool(poolInfo.data);
  if (!pool) {
    return NextResponse.json({ error: 'Pool data corrupt' }, { status: 500 });
  }
  if (!pool.active || pool.claims_paid >= pool.max_claims) {
    return NextResponse.json({ error: 'Bounty pool exhausted or inactive' }, { status: 410 });
  }
  if (pool.claim_authority.toBase58() !== authority.publicKey.toBase58()) {
    return NextResponse.json(
      { error: 'Pool was created with a different claim authority key' },
      { status: 409 }
    );
  }

  // Cheap on-chain check: receipt PDA already exists ⇒ already claimed.
  const claimHash = computeServerClaimHash(tip_id, nullifier_hash);
  const [receiptPda] = claimReceiptPDA(claimHash, programId);
  const receipt = await connection.getAccountInfo(receiptPda, 'confirmed');
  if (receipt) {
    return NextResponse.json(
      { error: 'Receipt already on-chain — bounty was already claimed for this (tip, nullifier)' },
      { status: 409 }
    );
  }

  try {
    const result = await submitClaim({
      tipId: tip_id,
      nullifierHash: nullifier_hash,
      recipientPubkey,
      journalistPubkey,
      beatSlug,
      poolPda,
    });

    await Tip.findByIdAndUpdate(tip_id, {
      bounty_claimed: true,
      bounty_tx_sig: result.tx_sig,
      bounty_recipient: recipient_wallet,
      bounty_amount_lamports: pool.amount_per_claim.toString(),
      bounty_claimed_at: new Date(),
      updated_at: new Date(),
    });

    return NextResponse.json({
      success: true,
      tx_sig: result.tx_sig,
      receipt_pda: result.receipt_pda,
      amount_lamports: pool.amount_per_claim.toString(),
      amount_sol: Number(pool.amount_per_claim) / 1e9,
      beat_slug: beatSlug,
    });
  } catch (e) {
    return NextResponse.json(
      { error: explainAnchorError(e) },
      { status: 500 }
    );
  }
}
