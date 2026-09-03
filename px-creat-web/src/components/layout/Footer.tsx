import { Link } from 'react-router-dom'
import { PixelHeart } from '@/components/layout/Header'

export function Footer() {
  return (
    <footer className="border-t border-line/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-10 text-sm text-inkSoft sm:px-6">
        <div className="flex items-center gap-2">
          <PixelHeart className="h-5 w-5 text-primary" />
          <span className="font-bold text-ink">拼豆 PinDou</span>
        </div>
        <p>把想象，拼成图纸 · 浏览器里的拼豆创作工坊</p>
        <nav className="flex items-center gap-4">
          <Link to="/" className="transition-colors hover:text-primaryStrong">
            首页
          </Link>
          <Link to="/about" className="transition-colors hover:text-primaryStrong">
            关于
          </Link>
          <Link to="/studio" className="transition-colors hover:text-primaryStrong">
            编辑器
          </Link>
        </nav>
        <p className="text-xs">© 2026 PinDou · 色板数据 MIT (beadcolors)</p>
      </div>
    </footer>
  )
}
