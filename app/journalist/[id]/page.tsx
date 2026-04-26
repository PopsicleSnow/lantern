'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import PriorityBadge from '@/components/PriorityBadge';
import SecureDropPrompt from '@/components/SecureDropPrompt';
import RatingControls from '@/components/journalist/RatingControls';
import MarkClosedButton from '@/components/journalist/MarkClosedButton';
import { useJournalistSession } from '@/lib/journalist/session';
import { decryptFromSender } from '@/lib/crypto/keypair';
import {
  unwrapContentKey,
  decryptFilename,
  decryptFileBytes,
} from '@/lib/crypto/file';

interface TipMetadata {
  category: string;
  confidence: number;
  beats: string[];
  urgency: string;
  word_count: number;
  char_count: number;
  has_entities: boolean;
  has_dates: boolean;
  has_specifics: boolean;
  structural_quality: number;
  entity_count: number;
  date_count: number;
  money_mentions: number;
}

interface AttachmentEntry {
  _id: string;
  file_nonce: string;
  filename_ciphertext: string;
  filename_nonce: string;
  mime_type: string;
  file_size: number;
  wrapped_key: {
    key_ciphertext: string;
    key_nonce: string;
    ephemeral_pubkey: string;
  };
  created_at: string;
}

interface TipResponse {
  _id: string;
  metadata: TipMetadata;
  ciphertext: {
    journalist_id: string;
    ciphertext: string;
    nonce: string;
    ephemeral_pubkey: string;
  };
  attachments: AttachmentEntry[];
  verified_human: boolean;
  priority: 'high' | 'standard';
  status: string;
  category: string;
  category_confidence: number;
  classification_source: string;
  beats_matched: string[];
  urgency: 'low' | 'medium' | 'high';
  read_at: string | null;
  credibility_at_submission: number | null;
  created_at: string;
}

interface DecryptedAttachment {
  id: string;
  filename: string;
  size: number;
  mime_type: string;
}

interface JournalistProfile {
  _id?: string;
  name: string;
  organization: string;
  securedrop_url?: string;
}

export default function TipDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tipId = params.id as string;
  const journalistId = searchParams.get('journalist_id') ?? '';

  const { session } = useJournalistSession();
  const [tip, setTip] = useState<TipResponse | null>(null);
  const [journalist, setJournalist] = useState<JournalistProfile | null>(null);
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [decryptedAttachments, setDecryptedAttachments] = useState<DecryptedAttachment[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState('');

  useEffect(() => {
    if (!session || session.journalist_id !== journalistId) {
      router.replace('/journalist');
      return;
    }

    const load = async () => {
      try {
        const [tipRes, jRes] = await Promise.all([
          fetch(`/api/tips/${tipId}?journalist_id=${encodeURIComponent(journalistId)}`, {
            headers: { Authorization: 'Bearer demo-token' },
          }),
          fetch(`/api/journalist/profile?journalist_id=${encodeURIComponent(journalistId)}`),
        ]);
        if (tipRes.status === 403) {
          setError('You are not a recipient of this tip.');
          return;
        }
        if (!tipRes.ok) {
          setError('Tip not found or unavailable.');
          return;
        }
        const tipData = (await tipRes.json()) as TipResponse;
        setTip(tipData);

        if (jRes.ok) setJournalist(await jRes.json());

        try {
          const text = decryptFromSender(tipData.ciphertext, session.secret_key);
          setPlaintext(text);

          const decryptedList: DecryptedAttachment[] = [];
          for (const a of tipData.attachments ?? []) {
            try {
              const ck = unwrapContentKey(a.wrapped_key, session.secret_key);
              const filename = decryptFilename(a.filename_ciphertext, a.filename_nonce, ck);
              decryptedList.push({
                id: a._id,
                filename,
                size: a.file_size,
                mime_type: a.mime_type,
              });
            } catch {
              decryptedList.push({
                id: a._id,
                filename: '(failed to decrypt filename)',
                size: a.file_size,
                mime_type: a.mime_type,
              });
            }
          }
          setDecryptedAttachments(decryptedList);

          fetch(`/api/tips/${tipId}/read`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer demo-token',
            },
            body: JSON.stringify({ journalist_id: journalistId }),
          }).catch(() => {});
        } catch (e) {
          setError(
            e instanceof Error
              ? `Decryption failed: ${e.message}`
              : 'Decryption failed'
          );
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tipId, journalistId, session, router]);

  const downloadAttachment = async (entry: DecryptedAttachment) => {
    if (!tip || !session) return;
    const meta = tip.attachments.find((a) => a._id === entry.id);
    if (!meta) return;
    setDownloadingId(entry.id);
    setDownloadError('');
    try {
      const res = await fetch(
        `/api/tips/${tipId}/attachment/${entry.id}?journalist_id=${encodeURIComponent(
          journalistId
        )}`,
        { headers: { Authorization: 'Bearer demo-token' } }
      );
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const buf = new Uint8Array(await res.arrayBuffer());
      const ck = unwrapContentKey(meta.wrapped_key, session.secret_key);
      const plain = decryptFileBytes(buf, meta.file_nonce, ck);
      const blob = new Blob([new Uint8Array(plain)], {
        type: meta.mime_type || 'application/octet-stream',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = entry.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setDownloadingId(null);
    }
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
        <Link
          href="/journalist"
          style={{
            fontFamily: "'Source Code Pro', monospace",
            fontSize: '0.72rem',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          ← Dashboard
        </Link>
      </div>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '3rem 2rem' }}>
        {loading && (
          <p
            style={{
              color: 'var(--text-secondary)',
              fontFamily: "'Source Code Pro', monospace",
            }}
          >
            Decrypting...
          </p>
        )}

        {!loading && error && (
          <p
            style={{
              color: 'var(--warning)',
              fontFamily: "'Source Code Pro', monospace",
              fontSize: '0.85rem',
            }}
          >
            {error}
          </p>
        )}

        {tip && (
          <>
            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'center',
                marginBottom: '1.5rem',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontFamily: "'Source Code Pro', monospace",
                  fontSize: '0.75rem',
                  color: 'var(--accent)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                {tip.category.replace(/_/g, ' ')}
              </span>
              <PriorityBadge priority={tip.priority} urgency={tip.urgency} />
              {tip.verified_human && (
                <span
                  style={{
                    fontFamily: "'Source Code Pro', monospace",
                    fontSize: '0.7rem',
                    color: 'var(--success)',
                    border: '1px solid var(--success)',
                    padding: '0.15rem 0.5rem',
                  }}
                >
                  VERIFIED HUMAN
                </span>
              )}
              {tip.credibility_at_submission !== null && (
                <span
                  style={{
                    fontFamily: "'Source Code Pro', monospace",
                    fontSize: '0.7rem',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                    padding: '0.15rem 0.5rem',
                  }}
                >
                  source {tip.credibility_at_submission.toFixed(2)}
                </span>
              )}
            </div>

            <div
              style={{
                fontFamily: "'Source Code Pro', monospace",
                fontSize: '0.7rem',
                color: 'var(--text-secondary)',
                marginBottom: '0.5rem',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              Metadata
            </div>
            <div
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                padding: '0.85rem 1rem',
                marginBottom: '2rem',
                fontFamily: "'Source Code Pro', monospace",
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.7,
              }}
            >
              {tip.metadata.word_count} words · confidence{' '}
              {Math.round(tip.metadata.confidence * 100)}% · quality{' '}
              {tip.metadata.structural_quality.toFixed(2)}
              <br />
              entities: {tip.metadata.entity_count} · dates: {tip.metadata.date_count} · money
              mentions: {tip.metadata.money_mentions}
              <br />
              beats: {tip.beats_matched.join(', ') || 'none'}
              <br />
              classification: {tip.classification_source}
            </div>

            <div
              style={{
                fontFamily: "'Source Code Pro', monospace",
                fontSize: '0.7rem',
                color: 'var(--text-secondary)',
                marginBottom: '0.5rem',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              Tip Content (Decrypted)
            </div>
            <div
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--accent-dim)',
                padding: '1.25rem 1.5rem',
                marginBottom: '2rem',
                fontFamily: "'Source Sans 3', sans-serif",
                fontSize: '0.95rem',
                color: 'var(--text-primary)',
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
              }}
            >
              {plaintext ?? '...'}
            </div>

            {decryptedAttachments.length > 0 && (
              <>
                <div
                  style={{
                    fontFamily: "'Source Code Pro', monospace",
                    fontSize: '0.7rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '0.5rem',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  Attachments ({decryptedAttachments.length})
                </div>
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: '0 0 2rem',
                    display: 'grid',
                    gap: '0.5rem',
                  }}
                >
                  {decryptedAttachments.map((a) => (
                    <li
                      key={a.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: 'var(--surface)',
                        border: '1px solid var(--border)',
                        padding: '0.65rem 0.85rem',
                        fontFamily: "'Source Code Pro', monospace",
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)',
                        gap: '1rem',
                      }}
                    >
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {a.filename}{' '}
                        <span style={{ opacity: 0.6 }}>· {Math.ceil(a.size / 1024)} KB</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => downloadAttachment(a)}
                        disabled={downloadingId === a.id}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--accent-dim)',
                          color: 'var(--accent)',
                          fontFamily: "'Source Code Pro', monospace",
                          fontSize: '0.72rem',
                          padding: '0.3rem 0.65rem',
                          cursor: downloadingId === a.id ? 'wait' : 'pointer',
                          letterSpacing: '0.05em',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {downloadingId === a.id ? 'DECRYPTING…' : 'DOWNLOAD'}
                      </button>
                    </li>
                  ))}
                </ul>
                {downloadError && (
                  <p
                    style={{
                      color: 'var(--warning)',
                      fontFamily: "'Source Code Pro', monospace",
                      fontSize: '0.78rem',
                      marginTop: '-1.25rem',
                      marginBottom: '2rem',
                    }}
                  >
                    {downloadError}
                  </p>
                )}
              </>
            )}

            <div
              style={{
                display: 'flex',
                gap: '1.5rem',
                marginBottom: '2rem',
                fontFamily: "'Source Code Pro', monospace",
                fontSize: '0.72rem',
                color: 'var(--text-secondary)',
              }}
            >
              <span>
                {new Date(tip.created_at).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              {tip.read_at && (
                <span>
                  read {new Date(tip.read_at).toLocaleString('en-US', { hour12: false })}
                </span>
              )}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <RatingControls tip_id={tip._id} journalist_id={journalistId} />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <MarkClosedButton
                tip_id={tip._id}
                journalist_id={journalistId}
                initialStatus={tip.status}
              />
            </div>

            {journalist?.securedrop_url && <SecureDropPrompt url={journalist.securedrop_url} />}
          </>
        )}
      </div>
    </div>
  );
}
