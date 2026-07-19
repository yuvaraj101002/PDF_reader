import { useColorScheme } from 'react-native';

/**
 * App-chrome palette (Library, Vocabulary, navigation headers) — follows the
 * system color scheme. The reader keeps its own user-chosen palette
 * (src/reader/settings.ts).
 */

export interface AppColors {
  background: string;
  surface: string;
  text: string;
  subtle: string;
  border: string;
  accent: string;
}

export const APP_COLORS: Record<'light' | 'dark', AppColors> = {
  light: {
    background: '#FFFFFF',
    surface: '#F6F6F6',
    text: '#1A1A1A',
    subtle: '#6B6B6B',
    border: '#E2E2E2',
    accent: '#208AEF',
  },
  dark: {
    background: '#121212',
    surface: '#1E1E1E',
    text: '#EDEAE3',
    subtle: '#9A968D',
    border: '#333333',
    accent: '#5FA8F5',
  },
};

export function useAppColors(): AppColors {
  return APP_COLORS[useColorScheme() === 'dark' ? 'dark' : 'light'];
}
