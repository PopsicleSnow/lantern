// POST /api/bounty/create
// Auth: Authorization: Bearer demo-token (journalist)
// Body: { journalist_id, beat_slug, amount_per_claim_sol, max_claims, journalist_solana_pubkey }
//
// Builds an unsigned `create_bounty` transaction, persists the journalist's
// Solana wallet on their record, and returns the base64-serialized tx for the
// browser to sign with Phantom.

import { NextRequest, NextResponse } from 'next/server';
import { PublicKey, Transaction } from '@solana/web3.js';
import dbConnect from '@/lib/mongodb';
import Journalist from '@/lib/models/Journalist';
import { getConnection } from '@/lib/solana/connection';
import {
  buildCreateBountyIx,
  bountyPoolPDA,
  getProgramId,
} from '@/lib/solana/program';
import { isBeatSlug } from '@/lib/solana/beats';

const MIN_AMOUNT_SOL = 0.001;
const MAX_AMOUNT_SOL = 1000;
const MIN_CLAIMS = 1;
const MAX_CLAIMS = 10_000;

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== 'Bearer demo-token') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const {
    journalist_id,
    beat_slug,
    amount_per_claim_sol,
    max_claims,
    journalist_solana_pubkey,
  } = body as {
    journalist_id?: string;
    beat_slug?: string;
    amount_per_claim_sol?: number;
    max_claims?: number;
    journalist_solana_pubkey?: string;
  };

  if (!journalist_id) {
    return NextResponse.json({ error: 'journalist_id required' }, { status: 400 });
  }
  if (!isBeatSlug(beat_slug)) {
    return NextResponse.json({ error: 'Invalid beat slug' }, { status: 400 });
  }
  if (
    typeof amount_per_claim_sol !== 'number' ||
    amount_per_claim_sol < MIN_AMOUNT_SOL ||
    amount_per_claim_sol > MAX_AMOUNT_SOL
  ) {
    return NextResponse.json(
      { error: `amount_per_claim_sol must be between ${MIN_AMOUNT_SOL} and ${MAX_AMOUNT_SOL}` },
      { status: 400 }
    );
  }
  if (
    typeof max_claims !== 'number' ||
    !Number.isInteger(max_claims) ||
    max_claims < MIN_CLAIMS ||
    max_claims > MAX_CLAIMS
  ) {
    return NextResponse.json(
      { error: `max_claims must be an integer between ${MIN_CLAIMS} and ${MAX_CLAIMS}` },
      { status: 400 }
    );
  }
  if (typeof journalist_solana_pubkey !== 'string' || !journalist_solana_pubkey) {
    return NextResponse.json({ error: 'journalist_solana_pubkey required' }, { status: 400 });
  }

  const claimAuthorityRaw = process.env.NEXT_PUBLIC_SOLANA_CLAIM_AUTHORITY_PUBKEY;
  if (!claimAuthorityRaw) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_SOLANA_CLAIM_AUTHORITY_PUBKEY is not set on the server' },
      { status: 500 }
    );
  }

  let journalistPubkey: PublicKey;
  let claimAuthority: PublicKey;
  let programId: PublicKey;
  try {
    journalistPubkey = new PublicKey(journalist_solana_pubkey);
    claimAuthority = new PublicKey(claimAuthorityRaw);
    programId = getProgramId();
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? 'Invalid pubkey or program id' },
      { status: 500 }
    );
  }

  await dbConnect();
  const journalist = await Journalist.findById(journalist_id);
  if (!journalist || !journalist.active) {
    return NextResponse.json({ error: 'Journalist not found' }, { status: 404 });
  }

  const ix = buildCreateBountyIx({
    journalist: journalistPubkey,
    claim_authority: claimAuthority,
    beat_slug,
    amount_per_claim_lamports: BigInt(Math.floor(amount_per_claim_sol * 1e9)),
    max_claims,
  });

  const connection = getConnection();
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash('confirmed');
  const tx = new Transaction().add(ix);
  tx.feePayer = journalistPubkey;
  tx.recentBlockhash = blockhash;

  // Persist the journalist's Solana pubkey so the bounty board can find them.
  await Journalist.findByIdAndUpdate(journalist_id, {
    solana_pubkey: journalist_solana_pubkey,
  });

  const [poolPda] = bountyPoolPDA(journalistPubkey, beat_slug, programId);

  return NextResponse.json({
    transaction: Buffer.from(
      tx.serialize({ requireAllSignatures: false, verifySignatures: false })
    ).toString('base64'),
    pool_pda: poolPda.toBase58(),
    last_valid_block_height: lastValidBlockHeight,
  });
}
