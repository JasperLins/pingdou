import { Link } from 'react-router-dom'
import { Card, CardTitle } from '@/components/ui/Card'
import { buttonClass } from '@/components/ui/Button'
import { PixelHeart } from '@/components/layout/Header'

/**
 * 首页营销骨架（版式对齐 web-style 参考图）：
 * 大圆角粉彩渐变 Hero（贴纸感预览卡出血装饰）→ 搜索 pill + 标签 →
 * 三栏内容（贴纸卡片网格 / 侧栏最新列表 / CTA 卡）。文案为占位。
 */

const HERO_BEADS = [
  '#E27988', '#FCA5B2', '#FDE4E9', '#E27988', '#FCA5B5', '#F594A5', '#FDE4E9', '#E27189',
  '#FCA5B2', '#FDE4E9', '#E27189', '#F594A5', '#FCA5B5', '#E27988', '#FDE4E9', '#FCA5B2',
  '#F594A5', '#E27189', '#FCA5B2', '#FDE4E9', '#E27189', '#FCA5B5', '#F594A5', '#E27988',
  '#FDE4E9', '#FCA5B5', '#E27988', '#F594A5', '#FDE4E9', '#FCA5B2', '#E27189', '#FCA5B5',
  '#E27988', '#F594A5', '#FDE4E9', '#FCA5B2', '#E27189', '#FCA5B5', '#F594A5', '#FDE4E9',
]

const HOT_TAGS = ['初音', 'Bocchi', '星之卡比', '宝可梦', '蜡笔小新', 'chiikawa', '花卉', '像素字']

const STICKER_CARDS = [
  { title: '初音未来 · 演唱会', meta: '52×52 · 24 色', tone: 'from-[#8FE5E7] to-[#4FBFC3]' },
  { title: '吉他英雄 · 粉', meta: '29×29 · 16 色', tone: 'from-[#FCA5B2] to-[#E27988]' },
  { title: '星之卡比', meta: '29×29 · 12 色', tone: 'from-[#FDE4E9] to-[#F594A5]' },
  { title: '像素爱心徽章', meta: '8×8 · 3 色', tone: 'from-[#FCA5B5] to-[#C9586C]' },
  { title: '电子宠物狗', meta: '52×52 · 18 色', tone: 'from-[#FDE4E9] to-[#E8738C]' },
  { title: '深海水母', meta: '58×58 · 21 色', tone: 'from-[#AFECED] to-[#2C8E92]' },
]

const LATEST_ITEMS = [
  { name: '格子间的小猫', size: '29×29', colors: 14 },
  { name: '春日郁金香', size: '16×16', colors: 6 },
  { name: '像素早餐桌', size: '52×52', colors: 27 },
  { name: '魔女之夜', size: '58×58', colors: 33 },
  { name: '夏日波子汽水', size: '29×29', colors: 11 },
]

export function Home() {
  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 pb-20 pt-8 sm:px-6">
      <Hero />
      <SearchSection />
      <ContentSection />
    </div>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden rounded-cardLg bg-hero-gradient px-6 py-12 text-heroInk shadow-soft-lg sm:px-12 sm:py-16">
      {/* 装饰：贴纸心形与像素圆点，呼应拼豆像素属性 */}
      <PixelHeart className="absolute right-8 top-8 h-10 w-10 rotate-12 text-white/50" />
      <PixelHeart className="absolute bottom-10 left-[58%] hidden h-6 w-6 -rotate-12 text-white/30 sm:block" />
      <div aria-hidden className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
      <div aria-hidden className="absolute -bottom-16 right-1/3 h-40 w-40 rounded-full bg-white/20 blur-3xl" />

      <div className="relative grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-1.5 text-sm font-bold shadow-sticker backdrop-blur">
            <span aria-hidden className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
            五品牌 1,386 色 · 全流程免费
          </span>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            把想象，
            <br />
            拼成图纸。
          </h1>
          <p className="max-w-md text-base leading-relaxed opacity-80 sm:text-lg">
            上传图片一键转换拼豆图纸，像素画布精修细节，
            烫染效果实时预览，BOM 用料清单一键导出。
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/studio" className={buttonClass('heroLight', 'lg')}>
              开始创作 →
            </Link>
            <Link
              to="/about"
              className={buttonClass('ghost', 'lg', 'text-heroInk hover:bg-white/40')}
            >
              了解更多
            </Link>
          </div>
        </div>

        {/* 贴纸感图纸预览卡（角色插画位的占位，出血于横幅边缘） */}
        <div className="relative mx-auto w-full max-w-xs rotate-2 transition-transform duration-300 hover:rotate-0 sm:rotate-3">
          <div className="rounded-card bg-surface p-4 shadow-soft-lg">
            <div className="mb-3 flex items-center justify-between text-xs font-bold text-inkSoft">
              <span>图纸预览 · 8×5</span>
              <span className="rounded-full bg-primaryFaint px-2 py-0.5 text-primaryStrong">Q版</span>
            </div>
            <div className="grid grid-cols-8 gap-1.5">
              {HERO_BEADS.map((color, i) => (
                <span
                  key={i}
                  aria-hidden
                  className="aspect-square rounded-full shadow-sticker"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-inkSoft">
              <span>MARD · 9 色</span>
              <span>正常烫</span>
            </div>
          </div>
          <span className="absolute -right-3 -top-3 rounded-full bg-primary px-3 py-1 text-xs font-bold text-onPrimary shadow-sticker">
            NEW
          </span>
        </div>
      </div>
    </section>
  )
}

function SearchSection() {
  return (
    <section aria-label="图库搜索" className="flex flex-col items-center gap-4">
      <div className="flex w-full max-w-xl items-center gap-3 rounded-full bg-surface px-5 py-3 shadow-soft">
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-inkSoft" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          placeholder="搜索图库：角色、主题、色数……（P1 上线）"
          className="w-full bg-transparent text-sm text-ink placeholder:text-inkSoft/70 focus:outline-none"
        />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {HOT_TAGS.map((tag) => (
          <span
            key={tag}
            className="cursor-default rounded-full bg-surface2 px-4 py-1.5 text-sm font-semibold text-inkSoft transition-colors hover:bg-primaryFaint hover:text-primaryStrong"
          >
            #{tag}
          </span>
        ))}
      </div>
    </section>
  )
}

function ContentSection() {
  return (
    <section aria-label="精选内容" className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <SectionHeader title="本周精选图纸" hint="贴纸卡网格占位 · 图库 P1 上线" />
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {STICKER_CARDS.map((card) => (
            <Card key={card.title} hover padded={false} className="overflow-hidden">
              <div className={`flex h-28 items-center justify-center bg-gradient-to-br ${card.tone}`}>
                <PixelHeart className="h-9 w-9 text-white/70" />
              </div>
              <div className="space-y-1.5 p-4">
                <h3 className="truncate text-sm font-bold">{card.title}</h3>
                <p className="text-xs text-inkSoft">{card.meta}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <aside className="space-y-6">
        <Card>
          <CardTitle>最新图纸</CardTitle>
          <ul className="mt-4 space-y-1">
            {LATEST_ITEMS.map((item) => (
              <li
                key={item.name}
                className="flex items-center justify-between rounded-thumbSm px-2 py-2.5 text-sm transition-colors hover:bg-primaryFaint"
              >
                <span className="flex items-center gap-2.5">
                  <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-primarySoft" />
                  {item.name}
                </span>
                <span className="text-xs text-inkSoft">
                  {item.size} · {item.colors} 色
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card tone="hero" className="space-y-4 text-center">
          <h3 className="text-lg font-extrabold">今天想拼点什么？</h3>
          <p className="text-sm opacity-80">从一张照片开始，三分钟得到可打印的拼豆图纸。</p>
          <Link to="/studio" className={buttonClass('heroLight', 'md', 'w-full')}>
            打开编辑器
          </Link>
        </Card>
      </aside>
    </section>
  )
}

function SectionHeader({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <h2 className="flex items-center gap-2.5 text-xl font-extrabold">
        <span aria-hidden className="inline-block h-4 w-4 rounded-full bg-primary shadow-sticker" />
        {title}
      </h2>
      <span className="text-xs text-inkSoft">{hint}</span>
    </div>
  )
}
