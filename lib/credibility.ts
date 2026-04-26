import dbConnect from './mongodb';
import Credibility from './models/Credibility';

export type Rating = 'valuable' | 'dismissed';

function computeScore(valuable: number, dismissed: number): number {
  return (valuable + 1) / (valuable + dismissed + 2);
}

export async function getScore(nullifier_hash: string): Promise<number> {
  await dbConnect();
  const doc = await Credibility.findOne({ nullifier_hash }).lean<{ score: number }>();
  return doc?.score ?? 0.5;
}

export async function getOrCreate(nullifier_hash: string) {
  await dbConnect();
  let doc = await Credibility.findOne({ nullifier_hash });
  if (!doc) {
    doc = await Credibility.create({
      nullifier_hash,
      total_tips: 0,
      valuable_count: 0,
      dismissed_count: 0,
      score: 0.5,
      last_updated: new Date(),
    });
  }
  return doc;
}

export async function incrementTips(nullifier_hash: string) {
  await dbConnect();
  await Credibility.updateOne(
    { nullifier_hash },
    {
      $inc: { total_tips: 1 },
      $setOnInsert: { score: 0.5, valuable_count: 0, dismissed_count: 0 },
      $set: { last_updated: new Date() },
    },
    { upsert: true }
  );
}

export async function recordRating(nullifier_hash: string, rating: Rating): Promise<number> {
  await dbConnect();
  const doc = await getOrCreate(nullifier_hash);
  if (rating === 'valuable') doc.valuable_count += 1;
  else doc.dismissed_count += 1;
  doc.score = computeScore(doc.valuable_count, doc.dismissed_count);
  doc.last_updated = new Date();
  await doc.save();
  return doc.score;
}
