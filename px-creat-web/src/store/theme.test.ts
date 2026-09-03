import { beforeEach, describe, expect, it } from 'vitest'
import { useThemeStore } from '@/store/theme'

describe('theme store', () => {
  beforeEach(() => {
    useThemeStore.setState({ accent: 'bocchi', dark: false })
  })

  it('默认 Bocchi 粉 + 亮色', () => {
    expect(useThemeStore.getState().accent).toBe('bocchi')
    expect(useThemeStore.getState().dark).toBe(false)
  })

  it('setAccent 切换到 Miku 青', () => {
    useThemeStore.getState().setAccent('miku')
    expect(useThemeStore.getState().accent).toBe('miku')
  })

  it('toggleDark 来回切换', () => {
    useThemeStore.getState().toggleDark()
    expect(useThemeStore.getState().dark).toBe(true)
    useThemeStore.getState().toggleDark()
    expect(useThemeStore.getState().dark).toBe(false)
  })
})
