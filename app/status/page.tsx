'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ClaimBountyWidget from '@/components/ClaimBountyWidget';

interface StatusResponse {
  status: string;
  created_at: string;
  read: boolean;
  read_at: string | null;
  priority: string;
  category: string;
}

function StatusInner() {
  const params = useSearchParams();
  const initial = params.get('tip_id') ?? '';
  const [tipId, setTipId] = useState(initial);
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const lookup = async (id: string) => {
    setLoading(true);
    setError('');
    setData(null);
    try {
      const res = await fetch(`/api/tips/${id}/status`);
      if (res.status === 404) {
        setError('Tip not found. Double-check the ID.');
        return;
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Lookup failed');
      }
      setData((await res.json()) as StatusResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lookup failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initial) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    lookup(initial);
  }, [initial]);

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
            fontFamily: "'Source Code Pro', monospace",
            fontSize: '0.75rem',
            color: 'var(--accent)',
            textDecoration: 'none',
            letterSpacing: '0.2em',
          }}
        >
          LANTERN
        </Link>
        <span style={{ color: 'var(--border)' }}>|</span>
        <span
          style={{
            fontFamily: "'Source Code Pro', monospace",
            fontSize: '0.72rem',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Tip Status
        </span>
      </div>

      <div style={{ maxWidth: '520px', margin: '0 auto', padding: '3rem 2rem' }}>
        <h1
          style={{
            fontFamily: "'Libre Baskerville', serif",
            fontSize: '1.75rem',
            color: 'var(--text-primary)',
            marginBottom: '0.75rem',
          }}
        >
          Check tip status
        </h1>
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
            lineHeight: 1.7,
            marginBottom: '1.5rem',
          }}
        >
          Enter the tip ID you received after submission. We&apos;ll show you whether your tip has
          been routed and whether a journalist has opened it. We never reveal which journalist.
        </p>

        <input
          value={tipId}
          onChange={(e) => setTipId(e.target.value.trim())}
          placeholder="Tip ID"
          onKeyDown={(e) => e.key === 'Enter' && tipId && lookup(tipId)}
          style={{
            width: '100%',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontFamily: "'Source Code Pro', monospace",
            fontSize: '0.85rem',
            padding: '0.75rem 1rem',
            marginBottom: '0.75rem',
            outline: 'none',
          }}
        />
        <button
          onClick={() => lookup(tipId)}
          disabled={!tipId || loading}
          style={{
            width: '100%',
            backgroundColor: 'var(--accent)',
            color: 'var(--bg)',
            border: 'none',
            padding: '0.7rem',
            fontFamily: "'Source Sans 3', sans-serif",
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: !tipId || loading ? 'not-allowed' : 'pointer',
            opacity: !tipId || loading ? 0.5 : 1,
          }}
        >
          {loading ? 'Checking...' : 'Check status'}
        </button>

        {error && (
          <p
            style={{
              color: 'var(--warning)',
              fontFamily: "'Source Code Pro', monospace",
              fontSize: '0.85rem',
              marginTop: '1rem',
            }}
          >
            {error}
          </p>
        )}

        {data && (
          <div
            style={{
              marginTop: '2rem',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              padding: '1.5rem',
            }}
          >
            <div
              style={{
                fontFamily: "'Source Code Pro', monospace",
                fontSize: '0.7rem',
                color: 'var(--text-secondary)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: '0.5rem',
              }}
            >
              Status
            </div>
            <div
              style={{
                fontFamily: "'Libre Baskerville', serif",
                fontSize: '1.5rem',
                color: 'var(--accent)',
                marginBottom: '1rem',
              }}
            >
              {data.status.replace(/_/g, ' ')}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 1fr',
                gap: '0.5rem 1rem',
                fontFamily: "'Source Code Pro', monospace",
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
              }}
            >
              <span>Submitted</span>
              <span style={{ color: 'var(--text-primary)' }}>
                {new Date(data.created_at).toLocaleString()}
              </span>

              <span>Category</span>
              <span style={{ color: 'var(--text-primary)' }}>
                {data.category.replace(/_/g, ' ')}
              </span>

              <span>Priority</span>
              <span style={{ color: 'var(--text-primary)' }}>{data.priority}</span>

              <span>Read by journalist</span>
              <span style={{ color: data.read ? 'var(--success)' : 'var(--text-primary)' }}>
                {data.read && data.read_at
                  ? new Date(data.read_at).toLocaleString()
                  : 'Not yet'}
              </span>
            </div>

            <p
              style={{
                marginTop: '1.5rem',
                fontFamily: "'Source Code Pro', monospace",
                fontSize: '0.7rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
              }}
            >
              We deliberately don&apos;t reveal which journalist read your tip — only that one did.
            </p>
          </div>
        )}

        {data && data.status === 'closed' && tipId && (
          <ClaimBountyWidget tipId={tipId} />
        )}
      </div>
    </div>
  );
}

export default function StatusPage() {
  return (
    <Suspense fallback={null}>
      <StatusInner />
    </Suspense>
  );
}
