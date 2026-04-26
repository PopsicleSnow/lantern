import { NextResponse } from 'next/server';
import { signRequest } from '@worldcoin/idkit-server';

export async function POST() {
  const sig = signRequest({
    signingKeyHex: process.env.WLD_RP_SIGNING_KEY!,
    action: process.env.NEXT_PUBLIC_WLD_ACTION!,
    ttl: 300,
  });

  return NextResponse.json({
    rp_id: process.env.WLD_RP_ID!,
    nonce: sig.nonce,
    created_at: sig.createdAt,
    expires_at: sig.expiresAt,
    signature: sig.sig,
  });
}
