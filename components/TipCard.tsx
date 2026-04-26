import PriorityBadge from './PriorityBadge';

interface TipCardProps {
  tip: {
    _id: string;
    category: string;
    priority: 'high' | 'standard';
    urgency: 'low' | 'medium' | 'high';
    beats_matched: string[];
    classification_source: string;
    created_at: string;
    read_at?: string | null;
    verified_human?: boolean;
    credibility_at_submission?: number | null;
    metadata?: {
      word_count?: number;
      has_dates?: boolean;
      has_specifics?: boolean;
      structural_quality?: number;
      confidence?: number;
    };
  };
  onClick?: () => void;
}

export default function TipCard({ tip, onClick }: TipCardProps) {
  const md = tip.metadata ?? {};
  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        padding: '1.25rem 1.5rem',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => {
        if (onClick) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent-dim)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '0.75rem',
        }}
      >
        <span
          style={{
            fontFamily: "'Source Code Pro', monospace",
            fontSize: '0.75rem',
            color: 'var(--accent)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          {tip.category.replace(/_/g, ' ')}
        </span>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {tip.read_at && (
            <span
              style={{
                fontFamily: "'Source Code Pro', monospace",
                fontSize: '0.65rem',
                color: 'var(--text-secondary)',
                letterSpacing: '0.05em',
              }}
            >
              READ
            </span>
          )}
          <PriorityBadge priority={tip.priority} urgency={tip.urgency} />
        </div>
      </div>

      <p
        style={{
          color: 'var(--text-secondary)',
          fontSize: '0.78rem',
          lineHeight: 1.6,
          marginBottom: '0.75rem',
          fontFamily: "'Source Code Pro', monospace",
        }}
      >
        {md.word_count ?? 0} words · confidence{' '}
        {md.confidence !== undefined ? Math.round(md.confidence * 100) : '?'}% · quality{' '}
        {md.structural_quality !== undefined ? md.structural_quality.toFixed(2) : '?'}
        {md.has_dates ? ' · dates' : ''}
        {md.has_specifics ? ' · specifics' : ''}
        {tip.verified_human ? ' · verified human' : ''}
        {tip.credibility_at_submission !== null && tip.credibility_at_submission !== undefined
          ? ` · source ${tip.credibility_at_submission.toFixed(2)}`
          : ''}
      </p>

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span
          style={{
            fontFamily: "'Source Code Pro', monospace",
            fontSize: '0.7rem',
            color: 'var(--text-secondary)',
          }}
        >
          {new Date(tip.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
        <span
          style={{
            fontFamily: "'Source Code Pro', monospace",
            fontSize: '0.7rem',
            color: 'var(--text-secondary)',
          }}
        >
          via {tip.classification_source}
        </span>
        {tip.beats_matched?.length > 0 && (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {tip.beats_matched.map((beat) => (
              <span
                key={beat}
                style={{
                  fontFamily: "'Source Code Pro', monospace",
                  fontSize: '0.65rem',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  padding: '0.1rem 0.4rem',
                }}
              >
                {beat}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
