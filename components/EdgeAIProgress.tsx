'use client';

interface EdgeAIProgressProps {
  stage: string;
  detail?: string;
  progress?: number;
}

export default function EdgeAIProgress({ stage, detail, progress }: EdgeAIProgressProps) {
  return (
    <div style={{ textAlign: 'center', padding: '1rem 0' }}>
      <div
        style={{
          width: '48px',
          height: '48px',
          border: '2px solid var(--border)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          margin: '0 auto 1.5rem',
          animation: 'spin 1s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p
        style={{
          fontFamily: "'Source Code Pro', monospace",
          fontSize: '0.85rem',
          color: 'var(--accent)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: '0.5rem',
        }}
      >
        {stage}
      </p>
      {detail && (
        <p
          style={{
            fontFamily: "'Source Code Pro', monospace",
            fontSize: '0.72rem',
            color: 'var(--text-secondary)',
            marginBottom: '0.5rem',
          }}
        >
          {detail}
        </p>
      )}
      {typeof progress === 'number' && (
        <div
          style={{
            width: '240px',
            height: '4px',
            backgroundColor: 'var(--border)',
            margin: '0.5rem auto 0',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Math.min(100, Math.max(0, progress * 100))}%`,
              height: '100%',
              backgroundColor: 'var(--accent)',
              transition: 'width 0.2s ease',
            }}
          />
        </div>
      )}
      <p
        style={{
          fontFamily: "'Source Code Pro', monospace",
          fontSize: '0.65rem',
          color: 'var(--text-secondary)',
          marginTop: '1.5rem',
          maxWidth: '400px',
          margin: '1.5rem auto 0',
          lineHeight: 1.6,
        }}
      >
        Your tip is being processed in your browser. The server never sees the cleartext.
      </p>
    </div>
  );
}
