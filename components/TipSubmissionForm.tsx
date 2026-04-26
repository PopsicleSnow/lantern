'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { WorldIDProof } from './WorldIDButton';
import EdgeAIProgress from './EdgeAIProgress';
import ClaimBountyWidget from './ClaimBountyWidget';
import { classify } from '@/lib/edge-ai/classify';
import { computeMetadata } from '@/lib/edge-ai/quality';
import { encryptToRecipient } from '@/lib/crypto/keypair';
import { encryptFileForRecipients } from '@/lib/crypto/file';
import type { ITipMetadata, ITipPreferences } from '@/lib/models/Tip';

const WorldIDButton = dynamic(() => import('./WorldIDButton'), { ssr: false });

const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'financial_fraud', label: 'Financial fraud' },
  { value: 'environmental', label: 'Environmental misconduct' },
  { value: 'government_corruption', label: 'Government corruption' },
  { value: 'corporate_misconduct', label: 'Corporate misconduct' },
  { value: 'health_safety', label: 'Health and safety' },
  { value: 'national_security', label: 'National security' },
  { value: 'tech', label: 'Tech and platforms' },
];

interface JournalistEntry {
  _id: string;
  name: string;
  organization: string;
  has_key: boolean;
}

type Step =
  | 'writing'
  | 'verifying'
  | 'analyzing'
  | 'encrypting'
  | 'submitting'
  | 'confirmed'
  | 'error';

const MAX_CHARS = 5000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 5;

type Recipient = { journalist_id: string; public_key: string };

type ProgressEvent = { status: string; name?: string; progress?: number };

export default function TipSubmissionForm() {
  const [step, setStep] = useState<Step>('writing');
  const [content, setContent] = useState('');
  const [tipId, setTipId] = useState('');
  const [submittedNullifier, setSubmittedNullifier] = useState<string>('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const [progressStage, setProgressStage] = useState('Analyzing on-device');
  const [progressDetail, setProgressDetail] = useState('');
  const [progressValue, setProgressValue] = useState<number | undefined>(undefined);

  const [showPreferences, setShowPreferences] = useState(false);
  const [prefCategory, setPrefCategory] = useState('');
  const [prefOrganization, setPrefOrganization] = useState('');
  const [prefJournalistId, setPrefJournalistId] = useState('');
  const [journalists, setJournalists] = useState<JournalistEntry[]>([]);

  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState('');

  useEffect(() => {
    fetch('/api/transparency')
      .then((r) => r.json())
      .then((data) => {
        const list: JournalistEntry[] = (data.journalists ?? []).filter(
          (j: JournalistEntry) => j.has_key
        );
        setJournalists(list);
      })
      .catch(() => {});
  }, []);

  const organizations = useMemo(
    () => Array.from(new Set(journalists.map((j) => j.organization))).sort(),
    [journalists]
  );

  const journalistsForOrg = useMemo(
    () =>
      prefOrganization
        ? journalists.filter((j) => j.organization === prefOrganization)
        : journalists,
    [journalists, prefOrganization]
  );

  const buildPreferences = (): ITipPreferences | undefined => {
    const p: ITipPreferences = {};
    if (prefCategory) p.category = prefCategory;
    if (prefOrganization) p.organization = prefOrganization;
    if (prefJournalistId) p.journalist_id = prefJournalistId;
    return p.category || p.organization || p.journalist_id ? p : undefined;
  };

  const onModelProgress = (e: ProgressEvent) => {
    if (e.status === 'progress' && typeof e.progress === 'number') {
      setProgressDetail(
        e.name ? `Loading model: ${e.name} (${Math.round(e.progress)}%)` : `Loading model (${Math.round(e.progress)}%)`
      );
      setProgressValue(e.progress / 100);
    } else if (e.status === 'ready') {
      setProgressDetail('Model ready');
      setProgressValue(1);
    } else if (e.status === 'download') {
      setProgressDetail(`Downloading model${e.name ? ': ' + e.name : ''}`);
    }
  };

  const runEdgeAI = async (text: string): Promise<ITipMetadata> => {
    setProgressStage('Classifying on-device');
    setProgressDetail('Loading classifier...');
    setProgressValue(undefined);

    const classification = await classify(text, onModelProgress);

    setProgressStage('Computing quality signals');
    setProgressDetail('Loading embedder...');
    setProgressValue(undefined);

    const metadata = await computeMetadata(text, classification, onModelProgress);
    return metadata;
  };

  const submit = async (verifiedProof: WorldIDProof | null) => {
    try {
      setStep('analyzing');
      const metadata = await runEdgeAI(content);

      const metadataBody: Record<string, unknown> = { metadata };
      if (verifiedProof) metadataBody.idkit_response = verifiedProof.idkit_response;
      const preferences = buildPreferences();
      if (preferences) metadataBody.preferences = preferences;

      const metaRes = await fetch('/api/tips/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadataBody),
      });

      if (metaRes.status === 429) {
        setError('You have reached the submission limit for this period.');
        setStep('error');
        return;
      }
      if (!metaRes.ok) {
        const data = await metaRes.json().catch(() => ({}));
        throw new Error(data.error ?? 'Submission failed at metadata step');
      }

      const meta = (await metaRes.json()) as {
        tip_id: string;
        recipients: Recipient[];
      };

      if (!meta.recipients || meta.recipients.length === 0) {
        const usedPreferences = !!preferences;
        setError(
          usedPreferences
            ? 'No journalists match your routing preferences. Try removing one of the filters or pick "Auto-route".'
            : 'No journalists are available to receive this tip yet. Please try again once journalists have published their public keys.'
        );
        setStep('error');
        return;
      }

      setStep('encrypting');
      setProgressStage('Encrypting to recipients');
      setProgressDetail(`Encrypting to ${meta.recipients.length} journalist(s)`);
      setProgressValue(undefined);

      const ciphertexts = meta.recipients.map((r) => ({
        journalist_id: r.journalist_id,
        ...encryptToRecipient(content, r.public_key),
      }));

      if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setProgressStage('Encrypting attachments');
          setProgressDetail(`Encrypting ${file.name} (${i + 1}/${files.length})`);
          setProgressValue(undefined);

          const bytes = new Uint8Array(await file.arrayBuffer());
          const encrypted = encryptFileForRecipients(bytes, file.name, meta.recipients);

          const form = new FormData();
          form.append(
            'file',
            new Blob([new Uint8Array(encrypted.file_ciphertext)], {
              type: 'application/octet-stream',
            }),
            'ciphertext.bin'
          );
          form.append(
            'meta',
            JSON.stringify({
              file_nonce: encrypted.file_nonce,
              filename_ciphertext: encrypted.filename_ciphertext,
              filename_nonce: encrypted.filename_nonce,
              mime_type: file.type || 'application/octet-stream',
              file_size: file.size,
              wrapped_keys: encrypted.wrapped_keys,
            })
          );

          setProgressStage('Uploading attachments');
          setProgressDetail(`Uploading ${file.name} (${i + 1}/${files.length})`);

          const upRes = await fetch(`/api/tips/${meta.tip_id}/attachment`, {
            method: 'POST',
            body: form,
          });
          if (!upRes.ok) {
            const data = await upRes.json().catch(() => ({}));
            throw new Error(data.error ?? `Upload failed for ${file.name}`);
          }
        }
      }

      setStep('submitting');

      const ctRes = await fetch(`/api/tips/${meta.tip_id}/ciphertext`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ciphertexts }),
      });
      if (!ctRes.ok) {
        const data = await ctRes.json().catch(() => ({}));
        throw new Error(data.error ?? 'Submission failed at ciphertext step');
      }

      setTipId(meta.tip_id);
      setSubmittedNullifier(verifiedProof?.nullifier ?? '');
      setStep('confirmed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed');
      setStep('error');
    }
  };

  const handleVerified = (proof: WorldIDProof) => {
    submit(proof);
  };

  const handleVerifyError = (err: Error) => {
    setError(err?.message ?? 'Verification failed');
    setStep('error');
  };

  const copyTipId = async () => {
    await navigator.clipboard.writeText(tipId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stepIndex = {
    writing: 0,
    verifying: 1,
    analyzing: 2,
    encrypting: 2,
    submitting: 3,
    confirmed: 3,
    error: 0,
  }[step];

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '3rem', alignItems: 'center' }}>
        {['Write', 'Verify', 'Analyze', 'Submit'].map((label, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                border: `1px solid ${i <= stepIndex ? 'var(--accent)' : 'var(--border)'}`,
                backgroundColor: i < stepIndex ? 'var(--accent)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'Source Code Pro', monospace",
                fontSize: '0.7rem',
                color:
                  i < stepIndex ? 'var(--bg)' : i === stepIndex ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              {i < stepIndex ? '✓' : i + 1}
            </div>
            <span
              style={{
                fontFamily: "'Source Code Pro', monospace",
                fontSize: '0.72rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: i === stepIndex ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              {label}
            </span>
            {i < 3 && (
              <div
                style={{
                  width: '1.5rem',
                  height: '1px',
                  backgroundColor: i < stepIndex ? 'var(--accent-dim)' : 'var(--border)',
                }}
              />
            )}
          </div>
        ))}
      </div>

      <div style={{ width: '100%', maxWidth: '640px' }}>
        {step === 'writing' && (
          <div>
            <h1
              style={{
                fontFamily: "'Libre Baskerville', serif",
                fontSize: '1.75rem',
                color: 'var(--text-primary)',
                marginBottom: '0.5rem',
              }}
            >
              What did you witness?
            </h1>
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '0.9rem',
                marginBottom: '0.5rem',
                lineHeight: 1.6,
              }}
            >
              Be specific. Dates, names, and locations help journalists verify your tip.
            </p>
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '0.78rem',
                marginBottom: '1.5rem',
                lineHeight: 1.6,
                fontFamily: "'Source Code Pro', monospace",
              }}
            >
              Your text is classified and encrypted in this browser before anything leaves your device.
              The server only sees ciphertext + shape metadata.{' '}
              <Link
                href="/transparency"
                style={{ color: 'var(--accent)', textDecoration: 'underline' }}
              >
                Verify journalist keys
              </Link>
              .
            </p>

            <div
              style={{
                display: 'flex',
                gap: '1rem',
                alignItems: 'stretch',
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  flex: '0 1 240px',
                  minWidth: '220px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--surface)',
                  padding: '0.85rem',
                }}
              >
                <div
                  style={{
                    fontFamily: "'Source Code Pro', monospace",
                    fontSize: '0.72rem',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--text-secondary)',
                    marginBottom: '0.5rem',
                  }}
                >
                  Attachments (optional)
                </div>
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.72rem',
                    lineHeight: 1.5,
                    fontFamily: "'Source Code Pro', monospace",
                    marginTop: 0,
                    marginBottom: '0.6rem',
                  }}
                >
                  Up to {MAX_FILES} files, 10MB each. Files and filenames are encrypted in this
                  browser.
                </p>
                <label
                  htmlFor="tip-attachments-input"
                  style={{
                    display: 'inline-block',
                    width: '100%',
                    textAlign: 'center',
                    backgroundColor: 'var(--accent)',
                    color: 'var(--bg)',
                    border: '1px solid var(--accent)',
                    padding: '0.5rem 0.6rem',
                    fontFamily: "'Source Code Pro', monospace",
                    fontSize: '0.72rem',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    marginBottom: files.length > 0 ? '0.45rem' : '0.35rem',
                  }}
                >
                  Choose files
                </label>
                <input
                  id="tip-attachments-input"
                  type="file"
                  multiple
                  onChange={(e) => {
                    setFileError('');
                    const picked = Array.from(e.target.files ?? []);
                    const next = [...files];
                    for (const f of picked) {
                      if (next.length >= MAX_FILES) {
                        setFileError(`Limit ${MAX_FILES} files. Extra files ignored.`);
                        break;
                      }
                      if (f.size > MAX_FILE_BYTES) {
                        setFileError(`${f.name} exceeds 10MB and was skipped.`);
                        continue;
                      }
                      if (!next.some((x) => x.name === f.name && x.size === f.size)) {
                        next.push(f);
                      }
                    }
                    setFiles(next);
                    e.target.value = '';
                  }}
                  style={{ display: 'none' }}
                />
                {files.length === 0 && (
                  <p
                    style={{
                      color: 'var(--text-secondary)',
                      opacity: 0.8,
                      fontSize: '0.68rem',
                      fontFamily: "'Source Code Pro', monospace",
                      margin: 0,
                    }}
                  >
                    No files selected
                  </p>
                )}
                {files.length > 0 && (
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: '0.6rem 0 0',
                      display: 'grid',
                      gap: '0.35rem',
                    }}
                  >
                    {files.map((f, i) => (
                      <li
                        key={`${f.name}-${i}`}
                        style={{
                          display: 'grid',
                          gap: '0.35rem',
                          border: '1px solid var(--border)',
                          padding: '0.45rem 0.5rem',
                          fontFamily: "'Source Code Pro', monospace",
                          fontSize: '0.7rem',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {f.name}
                        </span>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ opacity: 0.6 }}>{Math.ceil(f.size / 1024)} KB</span>
                          <button
                            type="button"
                            onClick={() => setFiles(files.filter((_, j) => j !== i))}
                            style={{
                              background: 'transparent',
                              border: '1px solid var(--border)',
                              color: 'var(--text-secondary)',
                              fontFamily: "'Source Code Pro', monospace",
                              fontSize: '0.65rem',
                              padding: '0.15rem 0.4rem',
                              cursor: 'pointer',
                            }}
                          >
                            REMOVE
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {fileError && (
                  <p
                    style={{
                      color: 'var(--warning)',
                      fontFamily: "'Source Code Pro', monospace",
                      fontSize: '0.72rem',
                      marginTop: '0.5rem',
                    }}
                  >
                    {fileError}
                  </p>
                )}
              </div>

              <div
                style={{
                  flex: '1 1 360px',
                  minWidth: '280px',
                }}
              >
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
                  placeholder="Describe what you witnessed. Dates, names, and locations help journalists verify."
                  rows={10}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    fontFamily: "'Source Sans 3', sans-serif",
                    fontSize: '0.95rem',
                    padding: '1rem',
                    lineHeight: 1.7,
                    resize: 'vertical',
                    outline: 'none',
                  }}
                />

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '0.75rem',
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Source Code Pro', monospace",
                      fontSize: '0.75rem',
                      color: content.length > 4500 ? 'var(--warning)' : 'var(--text-secondary)',
                    }}
                  >
                    {content.length} / {MAX_CHARS}
                  </span>
                  <button
                    onClick={() => setStep('verifying')}
                    disabled={content.trim().length < 10}
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--bg)',
                      border: 'none',
                      padding: '0.75rem 2rem',
                      fontFamily: "'Source Sans 3', sans-serif",
                      fontWeight: 600,
                      fontSize: '0.95rem',
                      cursor: content.trim().length < 10 ? 'not-allowed' : 'pointer',
                      opacity: content.trim().length < 10 ? 0.5 : 1,
                    }}
                  >
                    Continue
                  </button>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setShowPreferences((v) => !v)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontFamily: "'Source Code Pro', monospace",
                  fontSize: '0.78rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {showPreferences ? '▾' : '▸'} Routing preferences (optional)
              </button>

              {showPreferences && (
                <div style={{ marginTop: '1rem', display: 'grid', gap: '1rem' }}>
                  <p
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: '0.78rem',
                      lineHeight: 1.6,
                      fontFamily: "'Source Code Pro', monospace",
                      margin: 0,
                    }}
                  >
                    Pick any combination, or leave blank for auto-routing. A specific journalist
                    overrides newsgroup; newsgroup narrows the auto-routing pool.
                  </p>

                  <PrefSelect
                    label="Story category"
                    value={prefCategory}
                    onChange={setPrefCategory}
                    options={[
                      { value: '', label: 'Auto-detect from content' },
                      ...CATEGORY_OPTIONS,
                    ]}
                  />

                  <PrefSelect
                    label="Newsgroup"
                    value={prefOrganization}
                    onChange={(v) => {
                      setPrefOrganization(v);
                      if (
                        v &&
                        prefJournalistId &&
                        !journalists.some(
                          (j) => j._id === prefJournalistId && j.organization === v
                        )
                      ) {
                        setPrefJournalistId('');
                      }
                    }}
                    options={[
                      { value: '', label: 'Any newsgroup' },
                      ...organizations.map((o) => ({ value: o, label: o })),
                    ]}
                  />

                  <PrefSelect
                    label="Specific journalist"
                    value={prefJournalistId}
                    onChange={(v) => {
                      setPrefJournalistId(v);
                      const picked = journalists.find((j) => j._id === v);
                      if (picked && !prefOrganization) setPrefOrganization(picked.organization);
                    }}
                    options={[
                      { value: '', label: 'Any journalist' },
                      ...journalistsForOrg.map((j) => ({
                        value: j._id,
                        label: `${j.name} — ${j.organization}`,
                      })),
                    ]}
                  />

                  {(prefCategory || prefOrganization || prefJournalistId) && (
                    <button
                      type="button"
                      onClick={() => {
                        setPrefCategory('');
                        setPrefOrganization('');
                        setPrefJournalistId('');
                      }}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--border)',
                        color: 'var(--text-secondary)',
                        fontFamily: "'Source Code Pro', monospace",
                        fontSize: '0.72rem',
                        padding: '0.4rem 0.75rem',
                        cursor: 'pointer',
                        justifySelf: 'start',
                      }}
                    >
                      Clear preferences
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'verifying' && (
          <div style={{ textAlign: 'center' }}>
            <h1
              style={{
                fontFamily: "'Libre Baskerville', serif",
                fontSize: '1.75rem',
                color: 'var(--text-primary)',
                marginBottom: '0.75rem',
              }}
            >
              Prove you&apos;re human.
            </h1>
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '0.9rem',
                lineHeight: 1.6,
                maxWidth: '400px',
                margin: '0 auto 2.5rem',
              }}
            >
              We verify you&apos;re a real person. We store only a cryptographic hash, never your identity.
              World ID also unlocks credibility tracking for your future tips.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <WorldIDButton onSuccess={handleVerified} onError={handleVerifyError} />
            </div>
            <button
              onClick={() => submit(null)}
              style={{
                display: 'block',
                margin: '2rem auto 0',
                backgroundColor: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                fontFamily: "'Source Code Pro', monospace",
                fontSize: '0.75rem',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Skip verification (lowers tip priority)
            </button>
          </div>
        )}

        {(step === 'analyzing' || step === 'encrypting' || step === 'submitting') && (
          <EdgeAIProgress
            stage={
              step === 'submitting'
                ? 'Submitting ciphertext'
                : progressStage
            }
            detail={step === 'submitting' ? 'Sending encrypted payload to server' : progressDetail}
            progress={step === 'submitting' ? undefined : progressValue}
          />
        )}

        {step === 'confirmed' && (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontFamily: "'Source Code Pro', monospace",
                fontSize: '0.7rem',
                color: 'var(--accent)',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                marginBottom: '1.5rem',
              }}
            >
              TIP SUBMITTED
            </div>
            <h1
              style={{
                fontFamily: "'Libre Baskerville', serif",
                fontSize: '1.75rem',
                color: 'var(--text-primary)',
                marginBottom: '1rem',
              }}
            >
              Your tip is encrypted and routed.
            </h1>
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '0.9rem',
                lineHeight: 1.6,
                marginBottom: '2rem',
              }}
            >
              Save this ID — it&apos;s the only way to check status or reference your tip.
            </p>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '1rem',
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--accent-dim)',
                padding: '1rem 1.5rem',
                marginBottom: '1.5rem',
              }}
            >
              <span
                style={{
                  fontFamily: "'Source Code Pro', monospace",
                  fontSize: '1.2rem',
                  fontWeight: 500,
                  color: 'var(--accent)',
                  letterSpacing: '0.1em',
                  wordBreak: 'break-all',
                }}
              >
                {tipId}
              </span>
              <button
                onClick={copyTipId}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  fontFamily: "'Source Code Pro', monospace",
                  fontSize: '0.72rem',
                  padding: '0.4rem 0.75rem',
                  cursor: 'pointer',
                  letterSpacing: '0.05em',
                  whiteSpace: 'nowrap',
                }}
              >
                {copied ? 'COPIED' : 'COPY'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
              <Link
                href={`/status?tip_id=${tipId}`}
                style={{
                  display: 'inline-block',
                  fontFamily: "'Source Code Pro', monospace",
                  fontSize: '0.78rem',
                  color: 'var(--accent)',
                  textDecoration: 'underline',
                  letterSpacing: '0.05em',
                }}
              >
                Check status →
              </Link>
              <Link
                href="/bounties"
                style={{
                  display: 'inline-block',
                  fontFamily: "'Source Code Pro', monospace",
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                  textDecoration: 'underline',
                  letterSpacing: '0.05em',
                }}
              >
                Browse bounties →
              </Link>
            </div>

            <ClaimBountyWidget
              tipId={tipId}
              nullifierHash={submittedNullifier || undefined}
            />
          </div>
        )}

        {step === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <p
              style={{
                color: 'var(--warning)',
                fontFamily: "'Source Code Pro', monospace",
                marginBottom: '1.5rem',
              }}
            >
              {error}
            </p>
            <button
              onClick={() => {
                setStep('writing');
                setError('');
              }}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                fontFamily: "'Source Code Pro', monospace",
                fontSize: '0.85rem',
                padding: '0.6rem 1.25rem',
                cursor: 'pointer',
              }}
            >
              Start over
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PrefSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <span
        style={{
          fontFamily: "'Source Code Pro', monospace",
          fontSize: '0.72rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
        }}
      >
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
          fontFamily: "'Source Sans 3', sans-serif",
          fontSize: '0.9rem',
          padding: '0.6rem 0.75rem',
          outline: 'none',
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
