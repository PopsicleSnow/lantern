// POST /api/bounty/close
// Auth: Authorization: Bearer demo-token
// Body: { journalist_id, beat_slug, journalist_solana_pubkey }
//
// Builds an unsigned `close_bounty` transaction. The journalist signs in their
// browser; closing the pool returns all remaining escrow to them.

import { NextRequest, NextResponse } from 'next/server';
import { PublicKey, Transaction } from '@solana/web3.js';
import dbConnect from '@/lib/mongodb';
import Journalist from '@/lib/models/Journalist';
import { getConnection } from '@/lib/solana/connection';
import { buildCloseBountyIx } from '@/lib/solana/program';
import { isBeatSlug } from '@/lib/solana/beats';

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== 'Bearer demo-token') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { journalist_id, beat_slug, journalist_solana_pubkey } = (await req
    .json()
    .catch(() => ({}))) as {
    journalist_id?: string;
    beat_slug?: string;
    journalist_solana_pubkey?: string;
  };

  if (!journalist_id) return NextResponse.json({ error: 'journalist_id required' }, { status: 400 });
  if (!isBeatSlug(beat_slug)) return NextResponse.json({ error: 'Invalid beat slug' }, { status: 400 });
  if (!journalist_solana_pubkey) {
    return NextResponse.json({ error: 'journalist_solana_pubkey required' }, { status: 400 });
  }

  let journalistPubkey: PublicKey;
  try {
    journalistPubkey = new PublicKey(journalist_solana_pubkey);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? 'Invalid pubkey' },
      { status: 400 }
    );
  }

  await dbConnect();
  const journalist = await Journalist.findById(journalist_id);
  if (!journalist) return NextResponse.json({ error: 'Journalist not found' }, { status: 404 });

  const ix = buildCloseBountyIx({ journalist: journalistPubkey, beat_slug });
  const connection = getConnection();
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash('confirmed');
  const tx = new Transaction().add(ix);
  tx.feePayer = journalistPubkey;
  tx.recentBlockhash = blockhash;

  return NextResponse.json({
    transaction: Buffer.from(
      tx.serialize({ requireAllSignatures: false, verifySignatures: false })
    ).toString('base64'),
    last_valid_block_height: lastValidBlockHeight,
  });
}
