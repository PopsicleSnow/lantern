import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Tip, { type ITipMetadata, type ITipPreferences } from '@/lib/models/Tip';
import NullifierLog from '@/lib/models/NullifierLog';
import { verifyWorldIDProof } from '@/lib/worldid';
import { triageWithAgent } from '@/lib/agent-client';
import { triageFallback } from '@/lib/triage';
import { getScore, incrementTips } from '@/lib/credibility';

const RATE_LIMIT = 30;
const WINDOW_DAYS = 30;

function isValidMetadata(m: unknown): m is ITipMetadata {
  if (!m || typeof m !== 'object') return false;
  const md = m as Record<string, unknown>;
  return (
    typeof md.category === 'string' &&
    typeof md.confidence === 'number' &&
    Array.isArray(md.beats) &&
    typeof md.word_count === 'number' &&
    typeof md.char_count === 'number' &&
    typeof md.structural_quality === 'number'
  );
}

function parsePreferences(raw: unknown): ITipPreferences | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const p = raw as Record<string, unknown>;
  const out: ITipPreferences = {};
  if (typeof p.category === 'string' && p.category.trim()) out.category = p.category.trim();
  if (typeof p.organization === 'string' && p.organization.trim()) {
    out.organization = p.organization.trim();
  }
  if (typeof p.journalist_id === 'string' && p.journalist_id.trim()) {
    out.journalist_id = p.journalist_id.trim();
  }
  return out.category || out.organization || out.journalist_id ? out : undefined;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { metadata, idkit_response, preferences: rawPreferences } = body;

  if (!isValidMetadata(metadata)) {
    return NextResponse.json({ error: 'Invalid metadata' }, { status: 400 });
  }
  if (metadata.char_count > 5000) {
    return NextResponse.json({ error: 'Tip exceeds 5000 characters' }, { status: 400 });
  }

  const preferences = parsePreferences(rawPreferences);

  await dbConnect();

  let verified_human = false;
  let nullifier = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  if (idkit_response) {
    const result = await verifyWorldIDProof(idkit_response as Record<string, unknown>);
    verified_human = result.success;
    if (result.nullifier) nullifier = result.nullifier;
  }

  const windowStart = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const log = await NullifierLog.findOne({ nullifier_hash: nullifier });
  if (log && log.window_start > windowStart && log.submission_count >= RATE_LIMIT) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  if (log) {
    if (log.window_start <= windowStart) {
      log.submission_count = 1;
      log.window_start = new Date();
    } else {
      log.submission_count += 1;
    }
    log.last_submission = new Date();
    await log.save();
  } else {
    await NullifierLog.create({
      nullifier_hash: nullifier,
      submission_count: 1,
      last_submission: new Date(),
      window_start: new Date(),
    });
  }

  const credibility = await getScore(nullifier);

  const tip = await Tip.create({
    nullifier_hash: nullifier,
    metadata,
    preferences,
    ciphertexts: [],
    verified_human,
    priority: 'standard',
    status: 'awaiting_ciphertext',
    category: metadata.category,
    category_confidence: metadata.confidence,
    classification_source: 'edge_ai',
    beats_matched: metadata.beats,
    urgency: metadata.urgency,
    credibility_at_submission: credibility,
  });

  const tipId = String(tip._id);

  const agentResult = await triageWithAgent({
    tip_id: tipId,
    metadata,
    verified_human,
    credibility,
    preferences,
  });

  const decision =
    agentResult ?? (await triageFallback({ metadata, verified_human, credibility, preferences }));

  tip.priority = decision.priority;
  tip.assigned_journalist_id = decision.assigned_journalist_id;
  tip.classification_source = decision.classification_source;
  tip.updated_at = new Date();
  await tip.save();

  await incrementTips(nullifier);

  return NextResponse.json(
    {
      tip_id: tipId,
      recipients: decision.recipients,
      priority: decision.priority,
      planned_status: decision.status,
    },
    { status: 201 }
  );
}
