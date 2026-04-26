import Link from 'next/link';

export default function Home() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        backgroundColor: 'var(--bg)',
      }}
    >
      <div style={{ maxWidth: '640px', width: '100%', textAlign: 'center' }}>
        {/* Wordmark */}
        <div
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.75rem',
            letterSpacing: '0.3em',
            color: 'var(--accent)',
            textTransform: 'uppercase',
            marginBottom: '2rem',
          }}
        >
          LANTERN
        </div>

        {/* Hero */}
        <h1
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 'clamp(2.5rem, 6vw, 4rem)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            lineHeight: 1.15,
            marginBottom: '1.5rem',
          }}
        >
          Light in the dark.
        </h1>

        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '1.1rem',
            lineHeight: 1.7,
            marginBottom: '3rem',
            maxWidth: '480px',
            margin: '0 auto 3rem',
          }}
        >
          Submit tips anonymously. Verified human. Untrackable. Routed to the
          journalists who cover your story.
        </p>

        {/* CTAs */}
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Link
            href="/submit"
            style={{
              backgroundColor: 'var(--accent)',
              color: '#0a0a0a',
              padding: '0.85rem 2rem',
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontWeight: 600,
              fontSize: '0.95rem',
              textDecoration: 'none',
              letterSpacing: '0.02em',
            }}
          >
            Submit a Tip
          </Link>
          <Link
            href="/journalist"
            style={{
              border: '1px solid var(--accent)',
              color: 'var(--accent)',
              padding: '0.85rem 2rem',
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontWeight: 500,
              fontSize: '0.95rem',
              textDecoration: 'none',
              letterSpacing: '0.02em',
            }}
          >
            I&apos;m a Journalist
          </Link>
        </div>

        {/* Trust line */}
        <p
          style={{
            marginTop: '4rem',
            color: 'var(--text-secondary)',
            fontSize: '0.8rem',
            fontFamily: "'IBM Plex Mono', monospace",
            letterSpacing: '0.05em',
          }}
        >
          PROOF-OF-HUMAN &nbsp;·&nbsp; NULLIFIER ANONYMITY &nbsp;·&nbsp; NO LOGS
        </p>
      </div>
    </main>
  );
}
