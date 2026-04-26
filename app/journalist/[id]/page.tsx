'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import PriorityBadge from '@/components/PriorityBadge';
import SecureDropPrompt from '@/components/SecureDropPrompt';
import RatingControls from '@/components/journalist/RatingControls';
import { useJournalistSession } from '@/lib/journalist/session';
import { decryptFromSender } from '@/lib/crypto/keypair';

interface TipMetadata {
  category: string;
  confidence: number;
  beats: string[];
  urgency: string;
  word_count: number;
  char_count: number;
  has_entities: boolean;
  has_dates: boolean;
  has_specifics: boolean;
  structural_quality: number;
  entity_count: number;
  date_count: number;
  money_mentions: number;
}

interface TipResponse {
  _id: string;
  metadata: TipMetadata;
  ciphertext: {
    journalist_id: string;
    ciphertext: string;
    nonce: string;
    ephemeral_pubkey: string;
  };
  verified_human: boolean;
  priority: 'high' | 'standard';
  status: string;
  category: string;
  category_confidence: number;
  classification_source: string;
  beats_matched: string[];
  urgency: 'low' | 'medium' | 'high';
  read_at: string | null;
  credibility_at_submission: number | null;
  created_at: string;
}

interface JournalistProfile {
  _id?: string;
  name: string;
  organization: string;
  securedrop_url?: string;
}

export default function TipDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tipId = params.id as string;
  const journalistId = searchParams.get('journalist_id') ?? '';

  const { session } = useJournalistSession();
  const [tip, setTip] = useState<TipResponse | null>(null);
  const [journalist, setJournalist] = useState<JournalistProfile | null>(null);
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session || session.journalist_id !== journalistId) {
      router.replace('/journalist');
      return;
    }

    const load = async () => {
      try {
        const [tipRes, jRes] = await Promise.all([
          fetch(`/api/tips/${tipId}?journalist_id=${encodeURIComponent(journalistId)}`, {
            headers: { Authorization: 'Bearer demo-token' },
          }),
          fetch(`/api/journalist/profile?journalist_id=${encodeURIComponent(journalistId)}`),
        ]);
        if (tipRes.status === 403) {
          setError('You are not a recipient of this tip.');
          return;
        }
        if (!tipRes.ok) {
          setError('Tip not found or unavailable.');
          return;
        }
        const tipData = (await tipRes.json()) as TipResponse;
        setTip(tipData);

        if (jRes.ok) setJournalist(await jRes.json());

        try {
          const text = decryptFromSender(tipData.ciphertext, session.secret_key);
          setPlaintext(text);

          fetch(`/api/tips/${tipId}/read`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer demo-token',
            },
            body: JSON.stringify({ journalist_id: journalistId }),
          }).catch(() => {});
        } catch (e) {
          setError(
            e instanceof Error
              ? `Decryption failed: ${e.message}`
              : 'Decryption failed'
          );
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tipId, journalistId, session, router]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      <div
        style={{
          borderBottom: '1px solid var(--border)',
          padding: '1.25rem 2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          backgroundColor: 'var(--surface)',
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.75rem',
            color: 'var(--accent)',
            textDecoration: 'none',
            letterSpacing: '0.2em',
          }}
        >
          LANTERN
        </Link>
        <span style={{ color: 'var(--border)' }}>|</span>
        <Link
          href="/journalist"
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.72rem',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          ← Dashboard
        </Link>
      </div>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '3rem 2rem' }}>
        {loading && (
          <p
            style={{
              color: 'var(--text-secondary)',
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          >
            Decrypting...
          </p>
        )}

        {!loading && error && (
          <p
            style={{
              color: 'var(--warning)',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.85rem',
            }}
          >
            {error}
          </p>
        )}

        {tip && (
          <>
            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'center',
                marginBottom: '1.5rem',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '0.75rem',
                  color: 'var(--accent)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                {tip.category.replace(/_/g, ' ')}
              </span>
              <PriorityBadge priority={tip.priority} urgency={tip.urgency} />
              {tip.verified_human && (
                <span
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '0.7rem',
                    color: 'var(--success)',
                    border: '1px solid var(--success)',
                    padding: '0.15rem 0.5rem',
                  }}
                >
                  VERIFIED HUMAN
                </span>
              )}
              {tip.credibility_at_submission !== null && (
                <span
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '0.7rem',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                    padding: '0.15rem 0.5rem',
                  }}
                >
                  source {tip.credibility_at_submission.toFixed(2)}
                </span>
              )}
            </div>

            <div
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '0.7rem',
                color: 'var(--text-secondary)',
                marginBottom: '0.5rem',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              Metadata
            </div>
            <div
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                padding: '0.85rem 1rem',
                marginBottom: '2rem',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.7,
              }}
            >
              {tip.metadata.word_count} words · confidence{' '}
              {Math.round(tip.metadata.confidence * 100)}% · quality{' '}
              {tip.metadata.structural_quality.toFixed(2)}
              <br />
              entities: {tip.metadata.entity_count} · dates: {tip.metadata.date_count} · money
              mentions: {tip.metadata.money_mentions}
              <br />
              beats: {tip.beats_matched.join(', ') || 'none'}
              <br />
              classification: {tip.classification_source}
            </div>

            <div
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '0.7rem',
                color: 'var(--text-secondary)',
                marginBottom: '0.5rem',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              Tip Content (Decrypted)
            </div>
            <div
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--accent-dim)',
                padding: '1.25rem 1.5rem',
                marginBottom: '2rem',
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: '0.95rem',
                color: 'var(--text-primary)',
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
              }}
            >
              {plaintext ?? '...'}
            </div>

            <div
              style={{
                display: 'flex',
                gap: '1.5rem',
                marginBottom: '2rem',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '0.72rem',
                color: 'var(--text-secondary)',
              }}
            >
              <span>
                {new Date(tip.created_at).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              {tip.read_at && (
                <span>
                  read {new Date(tip.read_at).toLocaleString('en-US', { hour12: false })}
                </span>
              )}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <RatingControls tip_id={tip._id} journalist_id={journalistId} />
            </div>

            {journalist?.securedrop_url && <SecureDropPrompt url={journalist.securedrop_url} />}
          </>
        )}
      </div>
    </div>
  );
}
