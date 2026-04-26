'use client';

import { useState, useRef } from 'react';
import { IDKitRequestWidget, orbLegacy, type RpContext } from '@worldcoin/idkit';

export type WorldIDProof = {
  nullifier: string;
  idkit_response: Record<string, unknown>;
};

interface WorldIDButtonProps {
  onSuccess: (proof: WorldIDProof) => void;
  onError: (err: Error) => void;
}

export default function WorldIDButton({ onSuccess, onError }: WorldIDButtonProps) {
  const appId = process.env.NEXT_PUBLIC_WLD_APP_ID as `app_${string}`;
  const action = process.env.NEXT_PUBLIC_WLD_ACTION!;
  const environment = (process.env.NEXT_PUBLIC_WLD_ENVIRONMENT ?? 'production') as 'production' | 'staging';

  const [open, setOpen] = useState(false);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const nullifierRef = useRef<string>('');

  const handleOpen = async () => {
    try {
      const ctx = await fetch('/api/worldid/rp-context', { method: 'POST' }).then((r) => r.json());
      setRpContext(ctx as RpContext);
      setOpen(true);
    } catch (e) {
      onError(e instanceof Error ? e : new Error('Failed to initialize verification'));
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--accent)',
          color: 'var(--accent)',
          padding: '1rem 2.5rem',
          fontFamily: "'Source Sans 3', sans-serif",
          fontWeight: 500,
          fontSize: '1rem',
          cursor: 'pointer',
          letterSpacing: '0.03em',
          width: '100%',
          maxWidth: '320px',
        }}
      >
        Verify I&apos;m Human
      </button>

      {rpContext && (
        <IDKitRequestWidget
          open={open}
          onOpenChange={setOpen}
          app_id={appId}
          action={action}
          rp_context={rpContext}
          allow_legacy_proofs={true}
          environment={environment}
          preset={orbLegacy()}
          handleVerify={async (result) => {
            const res = await fetch('/api/worldid/verify', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ idkit_response: result }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
              throw new Error(data.detail ?? 'World ID verification failed');
            }
            nullifierRef.current = data.nullifier ?? '';
          }}
          onSuccess={(result) => {
            onSuccess({
              nullifier: nullifierRef.current,
              idkit_response: result as unknown as Record<string, unknown>,
            });
          }}
        />
      )}
    </>
  );
}
