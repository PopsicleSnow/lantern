import type { ITipMetadata, ITipPreferences } from './models/Tip';

export interface AgentTriagePayload {
  tip_id: string;
  metadata: ITipMetadata;
  verified_human: boolean;
  credibility: number;
  preferences?: ITipPreferences;
}

export interface AgentRecipient {
  journalist_id: string;
  public_key: string;
}

export interface AgentTriageResponse {
  priority: 'high' | 'standard';
  status: 'routed' | 'human_review';
  assigned_journalist_id?: string;
  recipients: AgentRecipient[];
  classification_source: 'edge_ai' | 'asi1_meta';
  reasoning?: string;
}

export async function triageWithAgent(
  payload: AgentTriagePayload
): Promise<AgentTriageResponse | null> {
  const endpoint = process.env.AGENT_ENDPOINT;
  if (!endpoint) return null;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.warn('[agent-client] non-OK response', res.status);
      return null;
    }
    return (await res.json()) as AgentTriageResponse;
  } catch (e) {
    console.warn('[agent-client] dispatch failed', e);
    return null;
  }
}
