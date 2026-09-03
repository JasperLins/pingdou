import { Link, NavLink } from 'react-router-dom'
import { buttonClass } from '@/components/ui/Button'
import { THEME_ACCENTS, useThemeStore } from '@/store/theme'
import { cn } from '@/lib/utils'

/**
 * 居中悬浮导航（web-style 版式）：pill 玻璃拟态条、品牌 logo、
 * 双主题切换（Bocchi 粉 / Miku 青）、暗色切换、进入创作 CTA。
 */

const NAV_LINKS = [
  { to: '/', label: '首页', end: true },
  { to: '/about', label: '关于' },
  { to: '/dev/ui', label: '组件演示' },
]

export function Header() {
  const accent = useThemeStore((s) => s.accent)
  const dark = useThemeStore((s) => s.dark)
  const setAccent = useThemeStore((s) => s.setAccent)
  const toggleDark = useThemeStore((s) => s.toggleDark)

  return (
    <header className="sticky top-0 z-40 bg-bg/60 backdrop-blur-md">
      <div className="mx-auto mt-4 max-w-6xl px-4 sm:px-6">
        <nav className="flex items-center justify-between gap-3 rounded-full border border-line bg-surface/80 px-4 py-2 shadow-soft backdrop-blur">
          <Link to="/" className="flex items-center gap-2" aria-label="拼豆 PinDou 首页">
            <PixelHeart className="h-7 w-7 drop-shadow-sticker" />
            <span className="text-lg font-extrabold tracking-wide">
              拼豆<span className="text-primary">PinDou</span>
            </span>
          </Link>

          <div className="hidden items-center gap-1 sm:flex">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors',
                    isActive
                      ? 'bg-primaryFaint text-primaryStrong'
                      : 'text-inkSoft hover:bg-primaryFaint hover:text-primaryStrong',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div
              role="radiogroup"
              aria-label="主题色"
              className="flex items-center gap-1 rounded-full bg-surface2 p-1"
            >
              {THEME_ACCENTS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  role="radio"
                  aria-checked={accent === option.key}
                  aria-label={`切换到${option.label}`}
                  title={`切换到${option.label}`}
                  onClick={() => setAccent(option.key)}
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full transition-all duration-200',
                    accent === option.key
                      ? 'scale-110 shadow-sticker ring-2 ring-primary/40'
                      : 'opacity-60 hover:opacity-100',
                  )}
                >
                  <span
                    aria-hidden
                    className="h-3.5 w-3.5 rounded-full border border-white/40"
                    style={{ backgroundColor: option.swatch }}
                  />
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={toggleDark}
              aria-label={dark ? '切换到亮色模式' : '切换到暗色模式'}
              title={dark ? '切换到亮色模式' : '切换到暗色模式'}
              className="rounded-full bg-surface2 p-2 text-inkSoft transition-colors hover:bg-primaryFaint hover:text-primaryStrong"
            >
              {dark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
            </button>

            <Link to="/studio" className={buttonClass('primary', 'sm')}>
              开始创作
            </Link>
          </div>
        </nav>
      </div>
    </header>
  )
}

/** 拼豆像素心形 logo（呼应拼豆像素属性）。 */
export function PixelHeart({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 10 9" className={className} aria-hidden>
      <g fill="currentColor">
        <rect x="1" y="0" width="3" height="1" />
        <rect x="6" y="0" width="3" height="1" />
        <rect x="0" y="1" width="10" height="2" />
        <rect x="0" y="3" width="10" height="2" />
        <rect x="1" y="5" width="8" height="1" />
        <rect x="2" y="6" width="6" height="1" />
        <rect x="3" y="7" width="4" height="1" />
        <rect x="4" y="8" width="2" height="1" />
      </g>
    </svg>
  )
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
    </svg>
  )
}
