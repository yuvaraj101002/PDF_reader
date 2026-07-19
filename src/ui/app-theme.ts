import { useColorScheme } from 'react-native';

/**
 * App-chrome palette (Library, Vocabulary, navigation headers) — follows the
 * system color scheme. The reader keeps its own user-chosen palette
 * (src/reader/settings.ts).
 *
 * Design language: warm & friendly — cream backgrounds, raspberry accent,
 * violet secondary, rounded Nunito type. Cozy for kids and grown-ups alike.
 */

export interface AppColors {
  background: string;
  surface: string;
  text: string;
  subtle: string;
  border: string;
  accent: string;
  /** soft tint of the accent — pill and badge backgrounds */
  accentSoft: string;
  /** secondary playful hue — badges, cover placeholders */
  secondary: string;
  secondarySoft: string;
}

export const APP_COLORS: Record<'light' | 'dark', AppColors> = {
  light: {
    background: '#FFF8F2',
    surface: '#FFFFFF',
    text: '#3B3049',
    subtle: '#8E7F96',
    border: '#F0E3E4',
    accent: '#F2688C',
    accentSoft: '#FDE9EF',
    secondary: '#7C6FD0',
    secondarySoft: '#EFEBFB',
  },
  dark: {
    background: '#1C1523',
    surface: '#2A2133',
    text: '#F3EDF7',
    subtle: '#A79BB3',
    border: '#3C3147',
    accent: '#F58BA8',
    accentSoft: '#3D2733',
    secondary: '#A79BF0',
    secondarySoft: '#2E2947',
  },
};

/**
 * Nunito families loaded in the root layout. Use the family that carries the
 * weight — do NOT combine with fontWeight (Android would fall back to the
 * system font).
 */
export const FONT = {
  regular: 'Nunito_400Regular',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  heading: 'Nunito_800ExtraBold',
} as const;

export function useAppColors(): AppColors {
  return APP_COLORS[useColorScheme() === 'dark' ? 'dark' : 'light'];
}
