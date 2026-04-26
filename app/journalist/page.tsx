'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import TipCard from '@/components/TipCard';
import KeypairSetup from '@/components/journalist/KeypairSetup';
import PassphraseUnlock from '@/components/journalist/PassphraseUnlock';
import RestoreFromBackup from '@/components/journalist/RestoreFromBackup';
import { useJournalistSession } from '@/lib/journalist/session';
import { loadKeystore, clearKeystore } from '@/lib/crypto/keystore';

interface Tip {
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
}

type Gate = 'loading' | 'enter_id' | 'setup' | 'unlock' | 'restore' | 'unlocked';

interface ServerKeyState {
  has_key: boolean;
  public_key: string | null;
  fingerprint: string | null;
  name: string;
  organization: string;
}

export default function JournalistDashboard() {
  const [inputId, setInputId] = useState('');
  const [journalistId, setJournalistId] = useState('');
  const [gate, setGate] = useState<Gate>('enter_id');
  const [serverKey, setServerKey] = useState<ServerKeyState | null>(null);
  const [tips, setTips] = useState<Tip[]>([]);
  const [tipsLoading, setTipsLoading] = useState(false);
  const [error, setError] = useState('');

  const { session, setSession } = useJournalistSession();

  const loadServerKey = useCallback(async (id: string): Promise<ServerKeyState | null> => {
    const res = await fetch(`/api/journalist/key?journalist_id=${encodeURIComponent(id)}`, {
      headers: { Authorization: 'Bearer demo-token' },
    });
    if (!res.ok) return null;
    return (await res.json()) as ServerKeyState;
  }, []);

  const beginSession = useCallback(
    async (id: string) => {
      setGate('loading');
      setError('');
      try {
        const remote = await loadServerKey(id);
        if (!remote) {
          setError('Journalist not found. Check the ID.');
          setGate('enter_id');
          return;
        }
        setServerKey(remote);
        if (!remote.has_key) {
          setGate('setup');
          return;
        }
        const local = await loadKeystore(id);
        if (!local) {
          setGate('restore');
          return;
        }
        if (local.public_key !== remote.public_key) {
          setGate('restore');
          return;
        }
        setGate('unlock');
      } catch {
        setError('Could not load journalist profile');
        setGate('enter_id');
      }
    },
    [loadServerKey]
  );

  const fetchTips = useCallback(async (id: string) => {
    setTipsLoading(true);
    try {
      const res = await fetch(`/api/journalist/tips?journalist_id=${encodeURIComponent(id)}`, {
        headers: { Authorization: 'Bearer demo-token' },
      });
      if (!res.ok) throw new Error('Failed to fetch tips');
      const data = await res.json();
      setTips(data.tips);
    } catch {
      setError('Could not load tips.');
    } finally {
      setTipsLoading(false);
    }
  }, []);

  const handleUnlocked = (params: { secret_key: Uint8Array; public_key: string }) => {
    if (!journalistId) return;
    setSession({
      journalist_id: journalistId,
      public_key: params.public_key,
      secret_key: params.secret_key,
    });
    setGate('unlocked');
    fetchTips(journalistId);
  };

  const handleWipe = async () => {
    if (!journalistId) return;
    await clearKeystore(journalistId);
    setGate('restore');
  };

  useEffect(() => {
    if (!session || !session.journalist_id || gate === 'unlocked') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJournalistId(session.journalist_id);
    setGate('unlocked');
    fetchTips(session.journalist_id);
  }, [session, gate, fetchTips]);

  const submitId = () => {
    if (!inputId.trim()) return;
    setJournalistId(inputId.trim());
    beginSession(inputId.trim());
  };

  const switchId = () => {
    setSession(null);
    setJournalistId('');
    setInputId('');
    setServerKey(null);
    setTips([]);
    setGate('enter_id');
  };

  const header = (
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
          fontFamily: "'IBM Plex Mono', monospace",
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
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.72rem',
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        Journalist Dashboard
      </span>
      <Link
        href="/transparency"
        style={{
          marginLeft: 'auto',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.7rem',
          color: 'var(--text-secondary)',
          textDecoration: 'underline',
        }}
      >
        Transparency
      </Link>
    </div>
  );

  if (gate === 'enter_id' || gate === 'loading') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
        {header}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 'calc(100vh - 60px)',
            padding: '2rem',
          }}
        >
          {gate === 'loading' ? (
            <p
              style={{
                color: 'var(--text-secondary)',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '0.85rem',
              }}
            >
              Loading...
            </p>
          ) : (
            <div style={{ maxWidth: '400px', width: '100%' }}>
              <h1
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: '1.5rem',
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem',
                }}
              >
                Sign in
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                Enter your journalist ID. First-time users will generate an encryption keypair.
              </p>
              <input
                value={inputId}
                onChange={(e) => setInputId(e.target.value)}
                placeholder="Journalist ID"
                onKeyDown={(e) => e.key === 'Enter' && submitId()}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: '0.85rem',
                  padding: '0.75rem 1rem',
                  marginBottom: '1rem',
                  outline: 'none',
                }}
              />
              {error && (
                <p
                  style={{
                    color: 'var(--warning)',
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '0.78rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  {error}
                </p>
              )}
              <button
                onClick={submitId}
                disabled={!inputId.trim()}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--accent)',
                  color: '#0a0a0a',
                  border: 'none',
                  padding: '0.75rem',
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: !inputId.trim() ? 'not-allowed' : 'pointer',
                  opacity: !inputId.trim() ? 0.5 : 1,
                }}
              >
                Continue
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (gate === 'setup') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
        {header}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '3rem 2rem',
          }}
        >
          <KeypairSetup
            journalist_id={journalistId}
            journalist_name={serverKey?.name ?? 'Journalist'}
            onComplete={({ secret_key, public_key }) => handleUnlocked({ secret_key, public_key })}
          />
        </div>
      </div>
    );
  }

  if (gate === 'unlock') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
        {header}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '3rem 2rem',
          }}
        >
          <PassphraseUnlock
            journalist_id={journalistId}
            fingerprint={serverKey?.fingerprint ?? null}
            onUnlocked={handleUnlocked}
            onWipe={handleWipe}
          />
        </div>
      </div>
    );
  }

  if (gate === 'restore') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
        {header}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '3rem 2rem',
          }}
        >
          <RestoreFromBackup
            journalist_id={journalistId}
            expected_public_key={serverKey?.public_key ?? null}
            onRestored={handleUnlocked}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      {header}
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '2rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '2rem',
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '1.5rem',
                color: 'var(--text-primary)',
                marginBottom: '0.25rem',
              }}
            >
              Routed Tips
            </h1>
            <p
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '0.72rem',
                color: 'var(--text-secondary)',
              }}
            >
              {tips.length} tip{tips.length !== 1 ? 's' : ''} · key fingerprint{' '}
              {serverKey?.fingerprint?.slice(0, 16) ?? '...'}
            </p>
          </div>
          <button
            onClick={switchId}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.72rem',
              padding: '0.4rem 0.75rem',
              cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </div>

        {tipsLoading && (
          <p
            style={{
              color: 'var(--text-secondary)',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.85rem',
            }}
          >
            Loading tips...
          </p>
        )}

        {!tipsLoading && tips.length === 0 && (
          <p
            style={{
              color: 'var(--text-secondary)',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.85rem',
            }}
          >
            No tips routed to you yet.
          </p>
        )}

        {tips.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {tips.map((tip) => (
              <Link
                key={tip._id}
                href={`/journalist/${tip._id}?journalist_id=${journalistId}`}
                style={{ textDecoration: 'none' }}
              >
                <TipCard tip={tip} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
