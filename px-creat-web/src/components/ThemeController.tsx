import { useEffect } from 'react'
import { useThemeStore } from '@/store/theme'

/**
 * 把 theme store 同步到 <html>：data-theme（bocchi/miku）与 .dark。
 * 仅在客户端 effect 中执行，预渲染输出保持默认（bocchi 亮色）。
 */
export function ThemeController() {
  const accent = useThemeStore((s) => s.accent)
  const dark = useThemeStore((s) => s.dark)

  useEffect(() => {
    const el = document.documentElement
    el.dataset.theme = accent
    el.classList.toggle('dark', dark)
  }, [accent, dark])

  return null
}
