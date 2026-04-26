'use client';

import { useState } from 'react';
import TipCard from './TipCard';

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

interface ReviewQueueProps {
  tips: ReviewTip[];
  onRoute: (tipId: string, journalistId: string) => Promise<void>;
  onClose: (tipId: string) => Promise<void>;
}

export default function ReviewQueue({ tips, onRoute, onClose }: ReviewQueueProps) {
  const [selected, setSelected] = useState<ReviewTip | null>(null);
  const [journalistId, setJournalistId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRoute = async () => {
    if (!selected || !journalistId.trim()) return;
    setLoading(true);
    await onRoute(selected._id, journalistId.trim());
    setSelected(null);
    setJournalistId('');
    setLoading(false);
  };

  const handleClose = async () => {
    if (!selected) return;
    setLoading(true);
    await onClose(selected._id);
    setSelected(null);
    setLoading(false);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: '1.5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {tips.length === 0 && (
          <p style={{ color: 'var(--text-secondary)', fontFamily: "'Source Code Pro', monospace", fontSize: '0.85rem' }}>
            No tips awaiting review.
          </p>
        )}
        {tips.map((tip) => (
          <TipCard
            key={tip._id}
            tip={tip}
            onClick={() => setSelected(selected?._id === tip._id ? null : tip)}
          />
        ))}
      </div>

      {selected && (
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            padding: '1.5rem',
            position: 'sticky',
            top: '2rem',
            alignSelf: 'start',
          }}
        >
          <p style={{ fontFamily: "'Source Code Pro', monospace", fontSize: '0.7rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>
            TIP DETAIL
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.7, marginBottom: '1.5rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {selected.content}
          </p>

          <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.5rem', fontFamily: "'Source Code Pro', monospace" }}>
            Route to journalist ID
          </label>
          <input
            value={journalistId}
            onChange={(e) => setJournalistId(e.target.value)}
            placeholder="MongoDB ObjectId"
            style={{
              width: '100%',
              backgroundColor: 'var(--bg)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontFamily: "'Source Code Pro', monospace",
              fontSize: '0.85rem',
              padding: '0.6rem 0.75rem',
              marginBottom: '1rem',
              outline: 'none',
            }}
          />

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handleRoute}
              disabled={loading || !journalistId.trim()}
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--bg)',
                border: 'none',
                padding: '0.6rem 1.25rem',
                fontFamily: "'Source Sans 3', sans-serif",
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              Route
            </button>
            <button
              onClick={handleClose}
              disabled={loading}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid var(--warning)',
                color: 'var(--warning)',
                padding: '0.6rem 1.25rem',
                fontFamily: "'Source Sans 3', sans-serif",
                fontWeight: 500,
                fontSize: '0.85rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
