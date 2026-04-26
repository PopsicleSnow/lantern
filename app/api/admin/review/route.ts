import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Tip from '@/lib/models/Tip';

export async function GET() {
  await dbConnect();

  const tips = await Tip.find(
    { status: 'human_review' },
    {
      _id: 1,
      category: 1,
      priority: 1,
      urgency: 1,
      beats_matched: 1,
      classification_source: 1,
      verified_human: 1,
      credibility_at_submission: 1,
      created_at: 1,
      'metadata.confidence': 1,
      'metadata.word_count': 1,
      'metadata.has_dates': 1,
      'metadata.has_specifics': 1,
      'metadata.structural_quality': 1,
      'ciphertexts.journalist_id': 1,
    }
  )
    .sort({ priority: -1, created_at: 1 })
    .lean();

  return NextResponse.json({ tips });
}
