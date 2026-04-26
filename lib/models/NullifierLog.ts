import mongoose, { Schema, Document } from 'mongoose';

export interface INullifierLog extends Document {
  nullifier_hash: string;
  submission_count: number;
  last_submission: Date;
  window_start: Date;
}

const NullifierLogSchema = new Schema<INullifierLog>({
  nullifier_hash: { type: String, required: true, unique: true, index: true },
  submission_count: { type: Number, default: 1 },
  last_submission: { type: Date, default: Date.now },
  window_start: { type: Date, default: Date.now },
});

export default mongoose.models.NullifierLog ||
  mongoose.model<INullifierLog>('NullifierLog', NullifierLogSchema);
