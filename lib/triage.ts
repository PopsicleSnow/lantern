import mongoose from 'mongoose';
import dbConnect from './mongodb';
import Journalist from './models/Journalist';
import type { ITipMetadata, ITipPreferences } from './models/Tip';
import type { AgentRecipient, AgentTriageResponse } from './agent-client';

interface JournalistLean {
  _id: unknown;
  beats: string[];
  public_key?: string;
}

export async function findRecipientsByBeats(beats: string[]): Promise<AgentRecipient[]> {
  await dbConnect();
  const journalists = await Journalist.find(
    {
      active: true,
      public_key: { $exists: true, $ne: null },
      beats: { $in: beats.length > 0 ? beats : ['general'] },
    },
    { _id: 1, public_key: 1, beats: 1 }
  ).lean<JournalistLean[]>();

  return journalists
    .filter((j) => typeof j.public_key === 'string')
    .map((j) => ({
      journalist_id: String(j._id),
      public_key: j.public_key as string,
    }));
}

export async function findAllRecipients(): Promise<AgentRecipient[]> {
  await dbConnect();
  const journalists = await Journalist.find(
    { active: true, public_key: { $exists: true, $ne: null } },
    { _id: 1, public_key: 1 }
  ).lean<JournalistLean[]>();

  return journalists
    .filter((j) => typeof j.public_key === 'string')
    .map((j) => ({
      journalist_id: String(j._id),
      public_key: j.public_key as string,
    }));
}

export function hasPreferences(p?: ITipPreferences | null): boolean {
  return !!(p && (p.journalist_id || p.organization || p.category));
}

export async function findRecipientsForPreferences(
  preferences: ITipPreferences,
  beats: string[]
): Promise<AgentRecipient[]> {
  await dbConnect();

  const baseQuery: Record<string, unknown> = {
    active: true,
    public_key: { $exists: true, $ne: null },
  };

  if (preferences.journalist_id) {
    if (!mongoose.isValidObjectId(preferences.journalist_id)) return [];
    const j = await Journalist.findOne(
      { ...baseQuery, _id: new mongoose.Types.ObjectId(preferences.journalist_id) },
      { _id: 1, public_key: 1 }
    ).lean<JournalistLean>();
    if (!j || typeof j.public_key !== 'string') return [];
    return [{ journalist_id: String(j._id), public_key: j.public_key }];
  }

  const query: Record<string, unknown> = { ...baseQuery };
  if (preferences.organization) query.organization = preferences.organization;
  if (preferences.category) {
    query.beats = { $in: beats.length > 0 ? beats : [preferences.category, 'general'] };
  }

  const journalists = await Journalist.find(query, {
    _id: 1,
    public_key: 1,
  }).lean<JournalistLean[]>();

  return journalists
    .filter((j) => typeof j.public_key === 'string')
    .map((j) => ({
      journalist_id: String(j._id),
      public_key: j.public_key as string,
    }));
}

export interface TriageInputs {
  metadata: ITipMetadata;
  verified_human: boolean;
  credibility: number;
  preferences?: ITipPreferences;
}

export async function triageFallback(inputs: TriageInputs): Promise<AgentTriageResponse> {
  const { metadata, verified_human, credibility, preferences } = inputs;

  let recipients: AgentRecipient[];
  if (hasPreferences(preferences)) {
    recipients = await findRecipientsForPreferences(preferences as ITipPreferences, metadata.beats);
  } else {
    recipients = await findRecipientsByBeats(metadata.beats);
    if (recipients.length === 0) recipients = await findAllRecipients();
  }

  const trustworthy = verified_human || credibility >= 0.6;
  const high_quality = metadata.confidence >= 0.7 && metadata.structural_quality >= 0.45;
  const has_signal = metadata.has_dates || metadata.has_specifics || metadata.money_mentions > 0;

  let priority: 'high' | 'standard' = 'standard';
  if (verified_human && (high_quality || has_signal)) priority = 'high';
  else if (trustworthy && metadata.urgency === 'high') priority = 'high';

  const status: 'routed' | 'human_review' =
    recipients.length > 0 ? 'routed' : 'human_review';

  const assigned_journalist_id =
    recipients.length > 0 ? recipients[0].journalist_id : undefined;

  return {
    priority,
    status,
    assigned_journalist_id,
    recipients,
    classification_source: 'edge_ai',
    reasoning: 'fallback rules (agent unavailable)',
  };
}
