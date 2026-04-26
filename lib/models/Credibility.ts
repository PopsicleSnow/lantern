import mongoose, { Schema, Document } from 'mongoose';

export interface ICredibility extends Document {
  nullifier_hash: string;
  total_tips: number;
  valuable_count: number;
  dismissed_count: number;
  score: number;
  last_updated: Date;
}

const CredibilitySchema = new Schema<ICredibility>({
  nullifier_hash: { type: String, required: true, unique: true, index: true },
  total_tips: { type: Number, default: 0 },
  valuable_count: { type: Number, default: 0 },
  dismissed_count: { type: Number, default: 0 },
  score: { type: Number, default: 0.5 },
  last_updated: { type: Date, default: Date.now },
});

export default (mongoose.models.Credibility as mongoose.Model<ICredibility>) ||
  mongoose.model<ICredibility>('Credibility', CredibilitySchema);
