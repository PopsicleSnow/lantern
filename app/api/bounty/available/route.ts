// GET /api/bounty/available?tip_id=<id>
//
// Lightweight probe used by /status and the /submit confirmation screen to
// decide whether to render the ClaimBountyWidget. Returns minimal data:
// the matching beat_slug + journalist Solana pubkey + payout amount. We do
// NOT reveal the journalist's identity here — the pubkey is already public
// (it appears on /bounties), so this is no additional leak.

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Tip from '@/lib/models/Tip';
import Journalist from '@/lib/models/Journalist';
import { fetchBountyPool } from '@/lib/solana/bounty-loader';
import { bestBeatSlugForTip } from '@/lib/solana/beats';
import { getProgramIdOrNull } from '@/lib/solana/program';

export async function GET(req: NextRequest) {
  const tipId = req.nextUrl.searchParams.get('tip_id');
  if (!tipId || !/^[0-9a-fA-F]{24}$/.test(tipId)) {
    return NextResponse.json({ error: 'Invalid tip_id' }, { status: 400 });
  }

  await dbConnect();
  const tip = await Tip.findById(tipId).lean<{
    status: string;
    category: string;
    beats_matched: string[];
    assigned_journalist_id?: string;
    bounty_claimed: boolean;
  }>();
  if (!tip) {
    return NextResponse.json({ available: false, reason: 'Tip not found' }, { status: 404 });
  }
  if (tip.status !== 'closed') {
    return NextResponse.json({ available: false, reason: 'Tip not yet closed' });
  }
  if (tip.bounty_claimed) {
    return NextResponse.json({ available: false, reason: 'Bounty already claimed' });
  }
  if (!tip.assigned_journalist_id) {
    return NextResponse.json({ available: false, reason: 'No journalist assigned' });
  }
  if (!getProgramIdOrNull()) {
    return NextResponse.json({ available: false, reason: 'Solana program not configured' });
  }

  const beatSlug = bestBeatSlugForTip(tip.category, tip.beats_matched ?? []);
  if (!beatSlug) {
    return NextResponse.json({
      available: false,
      reason: 'No bounty beat slug matches this tip category',
    });
  }

  const journalist = await Journalist.findById(tip.assigned_journalist_id).lean<{
    solana_pubkey?: string;
  }>();
  if (!journalist?.solana_pubkey) {
    return NextResponse.json({
      available: false,
      reason: 'Assigned journalist has no Solana wallet',
    });
  }

  const pool = await fetchBountyPool(journalist.solana_pubkey, beatSlug);
  if (!pool || !pool.active || pool.claims_remaining <= 0) {
    return NextResponse.json({
      available: false,
      reason: 'No active bounty for this journalist + beat',
    });
  }

  return NextResponse.json({
    available: true,
    beat_slug: beatSlug,
    journalist_solana_pubkey: journalist.solana_pubkey,
    amount_per_claim_sol: pool.amount_per_claim_sol,
    amount_per_claim_lamports: pool.amount_per_claim_lamports,
    claims_remaining: pool.claims_remaining,
  });
}
