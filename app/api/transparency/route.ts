import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Journalist from '@/lib/models/Journalist';

export async function GET() {
  try {
    await dbConnect();
    const journalists = await Journalist.find(
      { active: true },
      {
        _id: 1,
        name: 1,
        organization: 1,
        beats: 1,
        public_key: 1,
        public_key_fingerprint: 1,
        key_uploaded_at: 1,
        verified: 1,
      }
    )
      .sort({ name: 1 })
      .lean<
        Array<{
          _id: unknown;
          name: string;
          organization: string;
          beats: string[];
          public_key?: string;
          public_key_fingerprint?: string;
          key_uploaded_at?: Date;
          verified: boolean;
        }>
      >();

    return NextResponse.json({
      journalists: journalists.map((j) => ({
        _id: String(j._id),
        name: j.name,
        organization: j.organization,
        beats: j.beats,
        public_key: j.public_key ?? null,
        fingerprint: j.public_key_fingerprint ?? null,
        key_uploaded_at: j.key_uploaded_at ?? null,
        verified: j.verified,
        has_key: !!j.public_key,
      })),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('MONGODB_URI is not defined in environment variables')
    ) {
      return NextResponse.json(
        {
          journalists: [],
          warning: 'MONGODB_URI missing; returning empty transparency list in local dev.',
        },
        { status: 200 }
      );
    }
    throw error;
  }
}
