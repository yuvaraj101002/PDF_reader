import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { FONT } from './app-theme';

/** the app's signature action gradient — raspberry into violet */
export const ACTION_GRADIENT: [string, string] = ['#F2688C', '#8B7AE0'];

/** Primary call-to-action button with the raspberry→violet gradient fill. */
export function GradientButton({
  label,
  onPress,
  disabled = false,
  busy = false,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [styles.button, (pressed || disabled || busy) && styles.pressed, style]}
    >
      <LinearGradient
        colors={ACTION_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.fill}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.label}>{label}</Text>}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 18,
    boxShadow: '0 6px 16px rgba(242, 104, 140, 0.35)',
  },
  fill: {
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#fff',
    fontSize: 16,
    fontFamily: FONT.bold,
  },
  pressed: {
    opacity: 0.75,
  },
});
