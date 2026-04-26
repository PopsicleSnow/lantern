'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface JournalistEntry {
  _id: string;
  name: string;
  organization: string;
  beats: string[];
  public_key: string | null;
  fingerprint: string | null;
  key_uploaded_at: string | null;
  verified: boolean;
  has_key: boolean;
}

export default function TransparencyPage() {
  const [journalists, setJournalists] = useState<JournalistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/transparency')
      .then((r) => r.json())
      .then((data) => setJournalists(data.journalists ?? []))
      .catch(() => setError('Could not load transparency list'))
      .finally(() => setLoading(false));
  }, []);

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
          ICEBERG
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
          Transparency
        </span>
      </div>

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '3rem 2rem' }}>
        <h1
          style={{
            fontFamily: "'Libre Baskerville', serif",
            fontSize: '1.75rem',
            color: 'var(--text-primary)',
            marginBottom: '0.75rem',
          }}
        >
          Journalist Public Keys
        </h1>
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
            lineHeight: 1.7,
            marginBottom: '0.75rem',
          }}
        >
          Tips submitted to Iceberg are encrypted in your browser to one or more journalists below.
          The server cannot read tips — only the journalist with the matching private key can.
        </p>
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '0.85rem',
            lineHeight: 1.7,
            marginBottom: '2rem',
          }}
        >
          Verifying a fingerprint here against a journalist&apos;s out-of-band channel (e.g. their
          Twitter bio) confirms the encryption key your browser uses really belongs to them.
        </p>

        {loading && (
          <p
            style={{
              color: 'var(--text-secondary)',
              fontFamily: "'Source Code Pro', monospace",
            }}
          >
            Loading...
          </p>
        )}

        {error && (
          <p
            style={{
              color: 'var(--warning)',
              fontFamily: "'Source Code Pro', monospace",
            }}
          >
            {error}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {journalists.map((j) => (
            <div
              key={j._id}
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                padding: '1.25rem 1.5rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '0.5rem',
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: "'Libre Baskerville', serif",
                      fontSize: '1.1rem',
                      color: 'var(--text-primary)',
                      marginBottom: '0.2rem',
                    }}
                  >
                    {j.name}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Source Code Pro', monospace",
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {j.organization}
                  </div>
                </div>
                {j.verified && (
                  <span
                    style={{
                      fontFamily: "'Source Code Pro', monospace",
                      fontSize: '0.65rem',
                      color: 'var(--success)',
                      border: '1px solid var(--success)',
                      padding: '0.15rem 0.5rem',
                      letterSpacing: '0.05em',
                    }}
                  >
                    VERIFIED
                  </span>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.4rem',
                  marginBottom: '0.85rem',
                }}
              >
                {j.beats.map((beat) => (
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

              {j.has_key && j.fingerprint ? (
                <>
                  <div
                    style={{
                      fontFamily: "'Source Code Pro', monospace",
                      fontSize: '0.7rem',
                      color: 'var(--text-secondary)',
                      marginBottom: '0.3rem',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Fingerprint (SHA-256)
                  </div>
                  <div
                    style={{
                      fontFamily: "'Source Code Pro', monospace",
                      fontSize: '0.78rem',
                      color: 'var(--accent)',
                      wordBreak: 'break-all',
                      marginBottom: '0.85rem',
                    }}
                  >
                    {j.fingerprint.match(/.{1,4}/g)?.join(' ') ?? j.fingerprint}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Source Code Pro', monospace",
                      fontSize: '0.65rem',
                      color: 'var(--text-secondary)',
                      wordBreak: 'break-all',
                    }}
                  >
                    {j.public_key}
                  </div>
                  {j.key_uploaded_at && (
                    <div
                      style={{
                        fontFamily: "'Source Code Pro', monospace",
                        fontSize: '0.65rem',
                        color: 'var(--text-secondary)',
                        marginTop: '0.5rem',
                      }}
                    >
                      Published {new Date(j.key_uploaded_at).toLocaleDateString()}
                    </div>
                  )}
                </>
              ) : (
                <div
                  style={{
                    fontFamily: "'Source Code Pro', monospace",
                    fontSize: '0.72rem',
                    color: 'var(--text-secondary)',
                    fontStyle: 'italic',
                  }}
                >
                  Public key not yet published — this journalist cannot receive encrypted tips yet.
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
