import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { APP_GRADIENT } from './app-theme';

/**
 * Dreamy backdrop for every app screen: vertical pastel gradient with soft
 * floating blobs and sparkles. Purely decorative (pointerEvents none) —
 * content renders above it, cards use colors.glass to let it glow through.
 */
export function ScreenBackground({ children }: { children: React.ReactNode }) {
  const dark = useColorScheme() === 'dark';
  const gradient = APP_GRADIENT[dark ? 'dark' : 'light'];
  const blobRaspberry = dark ? 'rgba(245, 139, 168, 0.10)' : 'rgba(242, 104, 140, 0.13)';
  const blobViolet = dark ? 'rgba(167, 155, 240, 0.11)' : 'rgba(124, 111, 208, 0.12)';
  const blobGlow = dark ? 'rgba(245, 139, 168, 0.06)' : 'rgba(255, 255, 255, 0.45)';
  const sparkle = dark ? 'rgba(245, 139, 168, 0.35)' : 'rgba(233, 106, 141, 0.35)';

  return (
    <View style={styles.root}>
      <LinearGradient colors={gradient} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.blob, styles.blobTopRight, { backgroundColor: blobRaspberry }]} />
        <View style={[styles.blob, styles.blobBottomLeft, { backgroundColor: blobViolet }]} />
        <View style={[styles.blob, styles.blobMidLeft, { backgroundColor: blobGlow }]} />
        <Text style={[styles.sparkle, styles.sparkleA, { color: sparkle }]}>✦</Text>
        <Text style={[styles.sparkle, styles.sparkleB, { color: sparkle }]}>✦</Text>
        <Text style={[styles.sparkle, styles.sparkleC, { color: sparkle }]}>✦</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  blob: {
    position: 'absolute',
  },
  blobTopRight: {
    width: 340,
    height: 340,
    borderRadius: 170,
    top: -130,
    right: -110,
  },
  blobBottomLeft: {
    width: 430,
    height: 430,
    borderRadius: 215,
    bottom: -180,
    left: -150,
  },
  blobMidLeft: {
    width: 190,
    height: 190,
    borderRadius: 95,
    top: '36%',
    left: -80,
  },
  sparkle: {
    position: 'absolute',
  },
  sparkleA: {
    top: 96,
    left: 30,
    fontSize: 22,
  },
  sparkleB: {
    top: 190,
    right: 44,
    fontSize: 14,
  },
  sparkleC: {
    bottom: 150,
    right: 84,
    fontSize: 18,
  },
});
