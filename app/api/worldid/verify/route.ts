import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { idkit_response } = await req.json();
  const rpId = process.env.WLD_RP_ID!;

  try {
    const res = await fetch(`https://developer.world.org/api/v4/verify/${rpId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(idkit_response),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : 400 });
  } catch {
    return NextResponse.json({ success: false, detail: 'Verification request failed' }, { status: 500 });
  }
}
