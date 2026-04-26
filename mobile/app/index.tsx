import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import EdgeAIProgress from '@/components/EdgeAIProgress';
import WorldIDButton, { type WorldIDProof } from '@/components/WorldIDButton';
import { runEdgeAI } from '@/lib/edge-ai';
import { encryptToRecipient } from '@/lib/crypto/keypair';
import { postCiphertexts, postMetadata, RateLimitError } from '@/lib/api';
import type { ITipMetadata } from '@/lib/types';

type Step =
  | 'writing'
  | 'verifying'
  | 'analyzing'
  | 'encrypting'
  | 'submitting'
  | 'confirmed'
  | 'error';

const MAX_CHARS = 5000;

export default function SubmitScreen() {
  const [step, setStep] = useState<Step>('writing');
  const [content, setContent] = useState('');
  const [tipId, setTipId] = useState('');
  const [error, setError] = useState('');
  const [progressStage, setProgressStage] = useState('Analyzing on-device');
  const [progressDetail, setProgressDetail] = useState('');
  const [progressValue, setProgressValue] = useState<number | undefined>(undefined);

  const onProgress = (e: { status: string; name?: string; progress?: number }) => {
    if (e.status === 'progress' && typeof e.progress === 'number') {
      setProgressDetail(e.name ? `Scoring: ${e.name}` : `Progress ${Math.round(e.progress)}%`);
      setProgressValue(e.progress / 100);
    } else if (e.status === 'ready') {
      setProgressDetail('Classification complete');
      setProgressValue(1);
    }
  };

  const submit = async (verifiedProof: WorldIDProof | null) => {
    try {
      setStep('analyzing');
      setProgressStage('Classifying on-device');
      setProgressDetail('Running ZETIC.MLange…');
      setProgressValue(undefined);

      const metadata: ITipMetadata = await runEdgeAI(content, onProgress);

      const meta = await postMetadata({
        metadata,
        idkit_response: verifiedProof?.idkit_response,
      });

      if (!meta.recipients || meta.recipients.length === 0) {
        setError(
          'No journalists are available to receive this tip yet. Please try again once journalists have published their public keys.'
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

      setStep('submitting');
      await postCiphertexts(meta.tip_id, ciphertexts);

      setTipId(meta.tip_id);
      setStep('confirmed');
    } catch (e) {
      if (e instanceof RateLimitError) setError(e.message);
      else setError(e instanceof Error ? e.message : 'Submission failed');
      setStep('error');
    }
  };

  const reset = () => {
    setStep('writing');
    setError('');
    setContent('');
    setTipId('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <StepIndicator step={step} />

        {step === 'writing' && (
          <View>
            <Text style={styles.h1}>What did you witness?</Text>
            <Text style={styles.subtle}>
              Be specific. Dates, names, and locations help journalists verify your tip.
            </Text>
            <Text style={styles.note}>
              Your text is classified and encrypted on this device before anything leaves it. The
              server only sees ciphertext + shape metadata.
            </Text>
            <TextInput
              value={content}
              onChangeText={(t) => setContent(t.slice(0, MAX_CHARS))}
              multiline
              placeholder="Describe what you witnessed."
              placeholderTextColor="#555"
              style={styles.textarea}
              textAlignVertical="top"
            />
            <View style={styles.row}>
              <Text style={styles.counter}>
                {content.length} / {MAX_CHARS}
              </Text>
              <Pressable
                style={[
                  styles.cta,
                  content.trim().length < 10 && styles.ctaDisabled,
                ]}
                disabled={content.trim().length < 10}
                onPress={() => setStep('verifying')}
              >
                <Text style={styles.ctaText}>Continue</Text>
              </Pressable>
            </View>
          </View>
        )}

        {step === 'verifying' && (
          <View style={styles.center}>
            <Text style={styles.h1}>Prove you&apos;re human.</Text>
            <Text style={styles.subtle}>
              We verify you&apos;re a real person. We store only a cryptographic hash, never your
              identity.
            </Text>
            <View style={{ marginTop: 24, width: '100%', alignItems: 'center' }}>
              <WorldIDButton
                onSuccess={(p) => submit(p)}
                onError={(err) => {
                  setError(err.message);
                  setStep('error');
                }}
              />
            </View>
            <Pressable style={styles.skip} onPress={() => submit(null)}>
              <Text style={styles.skipText}>Skip verification (lowers tip priority)</Text>
            </Pressable>
          </View>
        )}

        {(step === 'analyzing' || step === 'encrypting' || step === 'submitting') && (
          <EdgeAIProgress
            stage={
              step === 'submitting'
                ? 'Submitting ciphertext'
                : progressStage
            }
            detail={
              step === 'submitting'
                ? 'Sending encrypted payload to server'
                : progressDetail
            }
            progress={step === 'submitting' ? undefined : progressValue}
          />
        )}

        {step === 'confirmed' && (
          <View style={styles.center}>
            <Text style={styles.tag}>TIP SUBMITTED</Text>
            <Text style={styles.h1}>Your tip is encrypted and routed.</Text>
            <Text style={styles.subtle}>
              Save this ID — it&apos;s the only way to check status or reference your tip.
            </Text>
            <View style={styles.idBox}>
              <Text style={styles.idText} selectable>
                {tipId}
              </Text>
            </View>
            <Pressable style={styles.startOver} onPress={reset}>
              <Text style={styles.startOverText}>Submit another tip</Text>
            </Pressable>
          </View>
        )}

        {step === 'error' && (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.startOver} onPress={reset}>
              <Text style={styles.startOverText}>Start over</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const idx = {
    writing: 0,
    verifying: 1,
    analyzing: 2,
    encrypting: 2,
    submitting: 3,
    confirmed: 3,
    error: 0,
  }[step];
  return (
    <View style={styles.steps}>
      {['Write', 'Verify', 'Analyze', 'Submit'].map((label, i) => (
        <View key={label} style={styles.stepRow}>
          <View
            style={[
              styles.stepDot,
              i <= idx && styles.stepDotActive,
              i < idx && styles.stepDotDone,
            ]}
          >
            <Text
              style={{
                fontFamily: 'Menlo',
                fontSize: 10,
                color: i < idx ? '#0a0a0a' : i === idx ? '#d4a574' : '#666',
              }}
            >
              {i < idx ? '✓' : i + 1}
            </Text>
          </View>
          <Text
            style={[
              styles.stepLabel,
              i === idx && { color: '#d4a574' },
            ]}
          >
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#0a0a0a' },
  container: { padding: 20, paddingBottom: 60 },
  steps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 24,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { borderColor: '#d4a574' },
  stepDotDone: { backgroundColor: '#d4a574' },
  stepLabel: {
    fontFamily: 'Menlo',
    fontSize: 10,
    letterSpacing: 1,
    color: '#666',
  },
  h1: {
    fontSize: 24,
    color: '#eee',
    marginBottom: 8,
    fontWeight: '500',
  },
  subtle: { color: '#888', fontSize: 14, lineHeight: 22, marginBottom: 12 },
  note: {
    color: '#666',
    fontFamily: 'Menlo',
    fontSize: 11,
    lineHeight: 18,
    marginBottom: 24,
  },
  textarea: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#222',
    color: '#eee',
    fontSize: 15,
    padding: 14,
    minHeight: 200,
    lineHeight: 22,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  counter: { color: '#666', fontFamily: 'Menlo', fontSize: 12 },
  cta: {
    backgroundColor: '#d4a574',
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { color: '#0a0a0a', fontSize: 15, fontWeight: '600' },
  center: { alignItems: 'center', paddingVertical: 24, gap: 12 },
  skip: { marginTop: 32 },
  skipText: { color: '#888', fontFamily: 'Menlo', fontSize: 12, textDecorationLine: 'underline' },
  tag: {
    fontFamily: 'Menlo',
    fontSize: 11,
    color: '#d4a574',
    letterSpacing: 2,
    marginBottom: 16,
  },
  idBox: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#3a2c1a',
    padding: 16,
    marginVertical: 16,
  },
  idText: {
    fontFamily: 'Menlo',
    fontSize: 14,
    color: '#d4a574',
    letterSpacing: 1,
  },
  startOver: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#333',
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  startOverText: {
    color: '#888',
    fontFamily: 'Menlo',
    fontSize: 12,
  },
  errorText: {
    color: '#e07b7b',
    fontFamily: 'Menlo',
    textAlign: 'center',
    marginBottom: 16,
  },
});
