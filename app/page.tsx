import Link from 'next/link';

export default function Home() {
  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '2rem 1rem',
        backgroundColor: 'var(--bg)',
      }}
    >
      <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <section
          style={{
            border: '1px solid var(--border)',
            borderRadius: '24px',
            background: 'linear-gradient(180deg, #ffffff 0%, #f6f8ff 100%)',
            padding: 'clamp(3rem, 6vw, 5rem) 2rem',
            textAlign: 'center',
            marginBottom: '3rem',
            boxShadow: '0 4px 24px rgba(0,0,0,0.02)'
          }}
        >
          <h2
            style={{
              fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
              margin: 0,
              fontWeight: 700,
              lineHeight: 1.05,
              color: 'var(--text-primary)',
            }}
          >
            Privacy first.
            <br />
            Truth, protected.
          </h2>
          <p
            style={{
              margin: '1.5rem auto 0',
              color: 'var(--text-secondary)',
              maxWidth: '50ch',
              fontSize: '1.15rem',
              lineHeight: 1.6,
            }}
          >
            Iceberg encrypts tips securely in your browser and routes them directly to the right journalist.
            Your identity stays completely private. The platform never sees your cleartext.
          </p>
          <div
            style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
              marginTop: '2.5rem',
            }}
          >
            <Link
              href="/submit"
              style={{
                backgroundColor: 'var(--accent)',
                color: '#fff',
                padding: '0.8rem 1.8rem',
                borderRadius: '999px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '1.05rem'
              }}
            >
              Submit a Tip
            </Link>
            <Link
              href="/journalist"
              style={{
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                backgroundColor: 'var(--surface)',
                padding: '0.8rem 1.8rem',
                borderRadius: '999px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '1.05rem'
              }}
            >
              Journalist Dashboard
            </Link>
          </div>
        </section>

        <section style={{ marginBottom: '3rem', padding: '0 1rem' }}>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>
            The Essence of the Idea
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>
            In an era where digital surveillance is ubiquitous, journalists and their sources need a secure line of communication. Traditional methods leave metadata trails or require extensive technical knowledge (like setting up PGP keys and Tor environments).
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: 1.7 }}>
            <strong>The Iceberg</strong> serves as a modern, accessible drop-point. We handle the complex encryption locally on your device before any data is sent over the network. This means not even the servers hosting The Iceberg can read your submissions. We are the tip of the iceberg; the truth lies beneath the surface, safe with you and the journalist.
          </p>
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1rem',
          }}
        >
          {[
            ['Verified Human', 'Optional World ID verification for anti-bot trust signals, completely anonymous.'],
            ['End-to-End Encryption', 'TweetNaCl encryption runs entirely client-side before submission.'],
            ['Public Key Transparency', 'Published journalist fingerprints help prevent key substitution.'],
          ].map(([title, body]) => (
            <article
              key={title}
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '1.5rem',
                boxShadow: '0 2px 12px rgba(0,0,0,0.02)'
              }}
            >
              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{title}</h4>
              <p style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5 }}>
                {body}
              </p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
