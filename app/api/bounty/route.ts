// GET /api/bounty?beat=<slug>
//
// Returns every active BountyPool on-chain that matches an active Lantern
// journalist with a registered Solana pubkey. Reads the chain via
// `getMultipleAccountsInfo` so the cost is one RPC call per ~100 (journalist,beat)
// pairs.

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Journalist from '@/lib/models/Journalist';
import { fetchBountiesForJournalists } from '@/lib/solana/bounty-loader';
import { BEAT_SLUGS, isBeatSlug, type BeatSlug } from '@/lib/solana/beats';
import { getProgramIdOrNull } from '@/lib/solana/program';

export async function GET(req: NextRequest) {
  if (!getProgramIdOrNull()) {
    return NextResponse.json({
      bounties: [],
      configured: false,
      reason: 'NEXT_PUBLIC_SOLANA_PROGRAM_ID is not set',
    });
  }

  const beatFilter = req.nextUrl.searchParams.get('beat');
  let beats: readonly BeatSlug[] = BEAT_SLUGS;
  if (beatFilter) {
    if (!isBeatSlug(beatFilter)) {
      return NextResponse.json({ error: 'Unknown beat slug' }, { status: 400 });
    }
    beats = [beatFilter];
  }

  await dbConnect();
  const journalists = await Journalist.find(
    {
      active: true,
      solana_pubkey: { $exists: true, $ne: null, $nin: ['', null] },
    },
    { _id: 1, name: 1, organization: 1, solana_pubkey: 1 }
  ).lean<
    Array<{ _id: unknown; name: string; organization: string; solana_pubkey: string }>
  >();

  const refs = journalists
    .filter((j) => typeof j.solana_pubkey === 'string' && j.solana_pubkey.length > 0)
    .map((j) => ({
      _id: String(j._id),
      name: j.name,
      organization: j.organization,
      solana_pubkey: j.solana_pubkey,
    }));

  try {
    const bounties = await fetchBountiesForJournalists(refs, beats);
    return NextResponse.json({
      configured: true,
      bounties: bounties.filter((b) => b.active && b.claims_remaining > 0),
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? 'Failed to load bounties', bounties: [] },
      { status: 500 }
    );
  }
}
