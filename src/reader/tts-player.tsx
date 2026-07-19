import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ReaderPalette } from './settings';
import { useTts } from './tts';

/** Floating mini-player shown while read-aloud is active. */
export function TtsPlayerBar({ palette }: { palette: ReaderPalette }) {
  const insets = useSafeAreaInsets();
  const status = useTts((s) => s.status);
  const rate = useTts((s) => s.rate);
  const pause = useTts((s) => s.pause);
  const resume = useTts((s) => s.resume);
  const stop = useTts((s) => s.stop);
  const cycleRate = useTts((s) => s.cycleRate);

  if (status === 'idle') return null;

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
          bottom: 20 + insets.bottom,
        },
      ]}
    >
      <PlayerButton
        label={status === 'playing' ? '⏸' : '▶'}
        color={palette.text}
        onPress={status === 'playing' ? pause : resume}
      />
      <Text style={[styles.label, { color: palette.subtle }]}>
        {status === 'playing' ? 'Reading aloud…' : 'Paused'}
      </Text>
      <PlayerButton label={`${rate}×`} color={palette.accent} onPress={cycleRate} />
      <PlayerButton label="✕" color={palette.text} onPress={stop} />
    </View>
  );
}

function PlayerButton({
  label,
  color,
  onPress,
}: {
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Text style={{ color, fontSize: 16, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginHorizontal: 4,
  },
  button: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pressed: {
    opacity: 0.6,
  },
});
