'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import ReviewQueue from '@/components/ReviewQueue';

interface ReviewTip {
  _id: string;
  category: string;
  priority: 'high' | 'standard';
  urgency: 'low' | 'medium' | 'high';
  beats_matched: string[];
  ai_summary: string;
  classification_source: string;
  created_at: string;
  content: string;
}

export default function AdminReviewPage() {
  const [tips, setTips] = useState<ReviewTip[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/review');
      const data = await res.json();
      setTips(data.tips ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRoute = async (tipId: string, journalistId: string) => {
    await fetch(`/api/admin/review/${tipId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ journalist_id: journalistId }),
    });
    await load();
  };

  const handleClose = async (tipId: string) => {
    await fetch(`/api/admin/review/${tipId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'closed' }),
    });
    await load();
  };

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
          style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '0.75rem', color: 'var(--accent)', textDecoration: 'none', letterSpacing: '0.12em' }}
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
          Admin Review Queue
        </span>
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1
              style={{
                fontFamily: "'Libre Baskerville', serif",
                fontSize: '1.5rem',
                color: 'var(--text-primary)',
                marginBottom: '0.25rem',
              }}
            >
              Human Review Queue
            </h1>
            <p style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              Tips with zero recipients - route or close.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span
              style={{
                fontFamily: "'Source Code Pro', monospace",
                fontSize: '0.72rem',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                padding: '0.3rem 0.75rem',
                backgroundColor: '#fff',
              }}
            >
              {tips.length} PENDING
            </span>
            <button
              onClick={load}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                fontFamily: "'Source Code Pro', monospace",
                fontSize: '0.72rem',
                padding: '0.3rem 0.75rem',
                cursor: 'pointer',
              }}
            >
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-secondary)', fontFamily: "'Source Code Pro', monospace", fontSize: '0.85rem' }}>
            Loading...
          </p>
        ) : (
          <ReviewQueue tips={tips} onRoute={handleRoute} onClose={handleClose} />
        )}
      </div>
    </div>
  );
}
