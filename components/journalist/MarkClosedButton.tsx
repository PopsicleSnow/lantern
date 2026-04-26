'use client';

import { useState } from 'react';

interface Props {
  tip_id: string;
  journalist_id: string;
  initialStatus: string;
  onClosed?: () => void;
}

export default function MarkClosedButton({
  tip_id,
  journalist_id,
  initialStatus,
  onClosed,
}: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const close = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/tips/${tip_id}/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-token',
        },
        body: JSON.stringify({ journalist_id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Close failed');
      }
      setStatus('closed');
      onClosed?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Close failed');
    } finally {
      setBusy(false);
    }
  };

  if (status === 'closed') {
    return (
      <div
        style={{
          padding: '1rem',
          border: '1px solid var(--success)',
          backgroundColor: 'var(--surface)',
          fontFamily: "'Source Code Pro', monospace",
          fontSize: '0.78rem',
          color: 'var(--text-secondary)',
        }}
      >
        Tip is <span style={{ color: 'var(--success)' }}>closed</span>. The source
        can now claim a Solana bounty if one was funded for this beat.
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
        Investigation outcome
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
        Mark this tip <strong>closed</strong> when you&apos;re done with it.
        Closing unlocks the bounty payout for the original source on Solana.
      </p>
      <button
        onClick={close}
        disabled={busy}
        style={{
          backgroundColor: 'transparent',
          border: '1px solid var(--accent)',
          color: 'var(--accent)',
          padding: '0.6rem 0.9rem',
          fontFamily: "'Source Code Pro', monospace",
          fontSize: '0.78rem',
          cursor: busy ? 'not-allowed' : 'pointer',
          letterSpacing: '0.05em',
        }}
      >
        {busy ? 'Closing…' : 'Mark closed'}
      </button>
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
