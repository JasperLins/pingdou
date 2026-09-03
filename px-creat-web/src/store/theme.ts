import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 主题 store（zustand + localStorage 持久化）。
 * - accent：Bocchi 粉（默认）/ Miku 青，写入 <html data-theme>；
 * - dark：暗色模式，写入 <html class="dark">；
 * DOM 同步由 components/ThemeController.tsx 完成，store 本身不触碰 DOM。
 */

export type ThemeAccent = 'bocchi' | 'miku'

export interface ThemeAccentOption {
  key: ThemeAccent
  label: string
  /** 按钮色板圆点的展示色 */
  swatch: string
}

export const THEME_ACCENTS: readonly ThemeAccentOption[] = [
  { key: 'bocchi', label: 'Bocchi 粉', swatch: '#E27189' },
  { key: 'miku', label: 'Miku 青', swatch: '#2FABAE' },
]

interface ThemeState {
  accent: ThemeAccent
  dark: boolean
  setAccent: (accent: ThemeAccent) => void
  toggleDark: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      accent: 'bocchi',
      dark: false,
      setAccent: (accent) => set({ accent }),
      toggleDark: () => set((state) => ({ dark: !state.dark })),
    }),
    { name: 'pindou-theme', version: 1 },
  ),
)
