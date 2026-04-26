import { ActivityIndicator, StyleSheet, View, Text } from 'react-native';

interface Props {
  stage: string;
  detail?: string;
  progress?: number;
}

export default function EdgeAIProgress({ stage, detail, progress }: Props) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#d4a574" />
      <Text style={styles.stage}>{stage.toUpperCase()}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      {typeof progress === 'number' ? (
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              { width: `${Math.min(100, Math.max(0, progress * 100))}%` },
            ]}
          />
        </View>
      ) : null}
      <Text style={styles.footnote}>
        Your tip is being processed on this device. The server never sees the cleartext.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 24, gap: 12 },
  stage: {
    fontFamily: 'Menlo',
    fontSize: 13,
    letterSpacing: 1.5,
    color: '#d4a574',
    marginTop: 8,
  },
  detail: {
    fontFamily: 'Menlo',
    fontSize: 11,
    color: '#888',
    textAlign: 'center',
  },
  barTrack: {
    width: 240,
    height: 4,
    backgroundColor: '#222',
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: '#d4a574' },
  footnote: {
    fontFamily: 'Menlo',
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    maxWidth: 320,
    lineHeight: 16,
  },
});
