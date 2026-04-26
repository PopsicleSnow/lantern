import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import dbConnect from '@/lib/mongodb';
import Journalist from '@/lib/models/Journalist';

function fingerprintFromBase64(b64: string): string {
  const buf = Buffer.from(b64, 'base64');
  return createHash('sha256').update(buf).digest('hex');
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== 'Bearer demo-token') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const journalist_id = req.nextUrl.searchParams.get('journalist_id');
  if (!journalist_id) {
    return NextResponse.json({ error: 'journalist_id required' }, { status: 400 });
  }

  await dbConnect();
  const j = await Journalist.findById(journalist_id, {
    public_key: 1,
    public_key_fingerprint: 1,
    key_uploaded_at: 1,
    name: 1,
    organization: 1,
  }).lean<{
    public_key?: string;
    public_key_fingerprint?: string;
    key_uploaded_at?: Date;
    name: string;
    organization: string;
  }>();

  if (!j) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    has_key: !!j.public_key,
    public_key: j.public_key ?? null,
    fingerprint: j.public_key_fingerprint ?? null,
    key_uploaded_at: j.key_uploaded_at ?? null,
    name: j.name,
    organization: j.organization,
  });
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== 'Bearer demo-token') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { journalist_id, public_key } = body as {
    journalist_id?: string;
    public_key?: string;
  };

  if (!journalist_id || !public_key) {
    return NextResponse.json({ error: 'journalist_id and public_key required' }, { status: 400 });
  }
  if (!/^[A-Za-z0-9+/=]{40,}$/.test(public_key)) {
    return NextResponse.json({ error: 'Invalid public_key format' }, { status: 400 });
  }

  await dbConnect();
  const j = await Journalist.findById(journalist_id);
  if (!j) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (j.public_key && j.public_key !== public_key) {
    return NextResponse.json(
      { error: 'Public key already set; restore from backup instead of overwriting' },
      { status: 409 }
    );
  }

  const fingerprint = fingerprintFromBase64(public_key);
  j.public_key = public_key;
  j.public_key_fingerprint = fingerprint;
  if (!j.key_uploaded_at) j.key_uploaded_at = new Date();
  await j.save();

  return NextResponse.json({
    journalist_id,
    public_key,
    fingerprint,
    key_uploaded_at: j.key_uploaded_at,
  });
}
