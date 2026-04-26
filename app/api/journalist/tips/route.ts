import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Tip from '@/lib/models/Tip';

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

  const tips = await Tip.find(
    {
      assigned_journalist_id: journalist_id,
      status: 'routed',
      'ciphertexts.journalist_id': journalist_id,
    },
    {
      _id: 1,
      category: 1,
      priority: 1,
      urgency: 1,
      beats_matched: 1,
      classification_source: 1,
      created_at: 1,
      read_at: 1,
      verified_human: 1,
      credibility_at_submission: 1,
      'metadata.word_count': 1,
      'metadata.has_dates': 1,
      'metadata.has_specifics': 1,
      'metadata.structural_quality': 1,
      'metadata.confidence': 1,
    }
  )
    .sort({ created_at: -1 })
    .lean();

  return NextResponse.json({ tips });
}
