'use client';

import { useState } from 'react';

interface Props {
  tip_id: string;
  journalist_id: string;
  onRated?: (score: number) => void;
}

export default function RatingControls({ tip_id, journalist_id, onRated }: Props) {
  const [rating, setRating] = useState<'valuable' | 'dismissed' | null>(null);
  const [busy, setBusy] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [error, setError] = useState('');

  const submit = async (choice: 'valuable' | 'dismissed') => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/tips/${tip_id}/rate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer demo-token' },
        body: JSON.stringify({ journalist_id, rating: choice }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Rating failed');
      }
      const data = await res.json();
      setRating(choice);
      setScore(data.nullifier_score);
      onRated?.(data.nullifier_score);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rating failed');
    } finally {
      setBusy(false);
    }
  };

  if (rating) {
    return (
      <div
        style={{
          padding: '1rem',
          border: '1px solid var(--border)',
          backgroundColor: 'var(--surface)',
          fontFamily: "'Source Code Pro', monospace",
          fontSize: '0.78rem',
          color: 'var(--text-secondary)',
        }}
      >
        Recorded as <span style={{ color: 'var(--accent)' }}>{rating}</span>.
        {score !== null && (
          <>
            {' '}Source credibility now: <span style={{ color: 'var(--accent)' }}>{score.toFixed(2)}</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '1rem',
        border: '1px solid var(--border)',
        backgroundColor: 'var(--surface)',
      }}
    >
      <p
        style={{
          fontFamily: "'Source Code Pro', monospace",
          fontSize: '0.72rem',
          color: 'var(--text-secondary)',
          marginBottom: '0.75rem',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        Rate this tip
      </p>
      <p
        style={{
          fontFamily: "'Source Code Pro', monospace",
          fontSize: '0.7rem',
          color: 'var(--text-secondary)',
          marginBottom: '0.75rem',
          lineHeight: 1.5,
        }}
      >
        Your rating updates the source&apos;s credibility score, which shapes how their future tips
        get prioritized. The source stays anonymous either way.
      </p>
      <div style={{ display: 'flex', gap: '0.6rem' }}>
        <button
          onClick={() => submit('valuable')}
          disabled={busy}
          style={{
            flex: 1,
            backgroundColor: 'transparent',
            border: '1px solid var(--success)',
            color: 'var(--success)',
            padding: '0.6rem',
            fontFamily: "'Source Code Pro', monospace",
            fontSize: '0.78rem',
            cursor: busy ? 'not-allowed' : 'pointer',
            letterSpacing: '0.05em',
          }}
        >
          ↑ Valuable
        </button>
        <button
          onClick={() => submit('dismissed')}
          disabled={busy}
          style={{
            flex: 1,
            backgroundColor: 'transparent',
            border: '1px solid var(--warning)',
            color: 'var(--warning)',
            padding: '0.6rem',
            fontFamily: "'Source Code Pro', monospace",
            fontSize: '0.78rem',
            cursor: busy ? 'not-allowed' : 'pointer',
            letterSpacing: '0.05em',
          }}
        >
          ↓ Dismiss
        </button>
      </div>
      {error && (
        <p
          style={{
            color: 'var(--warning)',
            fontFamily: "'Source Code Pro', monospace",
            fontSize: '0.7rem',
            marginTop: '0.6rem',
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
