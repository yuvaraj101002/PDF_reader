import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Reader appearance settings — persisted across sessions (AsyncStorage on
 * native, localStorage on web). Palette keys drive every reader surface so
 * the whole screen re-themes together.
 */

export type ReaderTheme = 'light' | 'sepia' | 'dark';

export interface ReaderPalette {
  background: string;
  text: string;
  subtle: string;
  /** chrome surfaces: header bar, sheets, buttons */
  surface: string;
  border: string;
  accent: string;
}

export const READER_PALETTES: Record<ReaderTheme, ReaderPalette> = {
  light: {
    background: '#FFFFFF',
    text: '#1A1A1A',
    subtle: '#6B6B6B',
    surface: '#F5F5F5',
    border: '#E2E2E2',
    accent: '#208AEF',
  },
  sepia: {
    background: '#F7F1E3',
    text: '#3D3427',
    subtle: '#8A7B66',
    surface: '#EFE6D2',
    border: '#DFD3BA',
    accent: '#A0653A',
  },
  dark: {
    background: '#121212',
    text: '#E6E1D6',
    subtle: '#9A968D',
    surface: '#1F1F1F',
    border: '#333333',
    accent: '#5FA8F5',
  },
};

export const MIN_FONT_SIZE = 14;
export const MAX_FONT_SIZE = 26;

interface ReaderSettings {
  theme: ReaderTheme;
  fontSize: number;
  setTheme: (theme: ReaderTheme) => void;
  adjustFontSize: (delta: number) => void;
}

export const useReaderSettings = create<ReaderSettings>()(
  persist(
    (set) => ({
      theme: 'light',
      fontSize: 18,
      setTheme: (theme) => set({ theme }),
      adjustFontSize: (delta) =>
        set((state) => ({
          fontSize: Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, state.fontSize + delta)),
        })),
    }),
    {
      name: 'reader-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ theme: state.theme, fontSize: state.fontSize }),
    },
  ),
);
