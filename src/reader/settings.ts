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
  /** very subtle top→bottom wash behind the page — keeps text readable */
  backgroundGradient: [string, string];
  text: string;
  subtle: string;
  /** chrome surfaces: header bar, sheets, buttons */
  surface: string;
  border: string;
  accent: string;
}

export const READER_PALETTES: Record<ReaderTheme, ReaderPalette> = {
  light: {
    background: '#FFFDFA',
    backgroundGradient: ['#FFFDFA', '#FAF1F4'],
    text: '#2E2837',
    subtle: '#877D91',
    surface: '#F8F2EE',
    border: '#EDE2DE',
    accent: '#E96A8D',
  },
  sepia: {
    background: '#F7F1E3',
    backgroundGradient: ['#F9F3E6', '#F2E9D3'],
    text: '#3D3427',
    subtle: '#8A7B66',
    surface: '#EFE6D2',
    border: '#DFD3BA',
    accent: '#A0653A',
  },
  dark: {
    background: '#171219',
    backgroundGradient: ['#1A1420', '#151017'],
    text: '#EAE3E9',
    subtle: '#9C93A1',
    surface: '#241E28',
    border: '#382F3D',
    accent: '#F58BA8',
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
