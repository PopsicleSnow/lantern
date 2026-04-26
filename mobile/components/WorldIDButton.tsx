import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { fetchRpContext, verifyWorldId } from '@/lib/api';
import { getWorldIdConfig } from '@/lib/edge-ai/runtime';

// Note: @worldcoin/idkit-react-native exposes an IDKitWidget similar to the web SDK.
// API surface may differ between versions — this matches the documented v1.x API.
// If the package isn't available or its API differs, the "Skip verification" path
// in the parent screen still produces a valid (unverified) submission.
let IDKitWidget: React.ComponentType<{
  app_id: string;
  action: string;
  signal?: string;
  enableTelemetry?: boolean;
  onSuccess: (result: Record<string, unknown>) => void;
  handleVerify?: (result: Record<string, unknown>) => Promise<void>;
  children: (args: { open: () => void }) => React.ReactNode;
}> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  IDKitWidget = require('@worldcoin/idkit-react-native').IDKitWidget;
} catch {
  IDKitWidget = null;
}

export type WorldIDProof = {
  nullifier: string;
  idkit_response: Record<string, unknown>;
};

interface Props {
  onSuccess: (proof: WorldIDProof) => void;
  onError: (err: Error) => void;
}

export default function WorldIDButton({ onSuccess, onError }: Props) {
  const { appId, action } = getWorldIdConfig();
  const [nullifier, setNullifier] = useState('');

  if (!IDKitWidget) {
    return (
      <Pressable
        style={[styles.btn, styles.btnDisabled]}
        onPress={() =>
          onError(
            new Error(
              '@worldcoin/idkit-react-native not installed. Install the package or skip verification.'
            )
          )
        }
      >
        <Text style={styles.btnText}>World ID unavailable — skip below</Text>
      </Pressable>
    );
  }

  const Widget = IDKitWidget;
  return (
    <Widget
      app_id={appId}
      action={action}
      enableTelemetry
      handleVerify={async (result) => {
        // Pre-fetch RP context so the server-side verify proxy has signed context if needed.
        try {
          await fetchRpContext();
        } catch {}
        const v = await verifyWorldId(result);
        setNullifier(v.nullifier ?? '');
      }}
      onSuccess={(result) => {
        onSuccess({ nullifier, idkit_response: result });
      }}
    >
      {({ open }: { open: () => void }) => (
        <Pressable style={styles.btn} onPress={open}>
          <Text style={styles.btnText}>Verify I&apos;m Human</Text>
        </Pressable>
      )}
    </Widget>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: '#1a1a1a',
    borderColor: '#d4a574',
    borderWidth: 1,
    paddingHorizontal: 32,
    paddingVertical: 16,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnText: {
    color: '#d4a574',
    fontSize: 16,
    fontFamily: 'System',
    letterSpacing: 0.5,
  },
});
