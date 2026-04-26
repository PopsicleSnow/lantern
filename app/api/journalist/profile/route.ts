import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Journalist from '@/lib/models/Journalist';

export async function GET(req: NextRequest) {
  const journalist_id = req.nextUrl.searchParams.get('journalist_id');
  if (!journalist_id) {
    return NextResponse.json({ error: 'journalist_id required' }, { status: 400 });
  }

  await dbConnect();

  const journalist = await Journalist.findById(journalist_id, {
    _id: 1, name: 1, organization: 1, beats: 1, securedrop_url: 1
  }).lean();

  if (!journalist) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(journalist);
}
