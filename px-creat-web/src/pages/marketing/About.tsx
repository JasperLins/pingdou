import type { ReactNode } from 'react'
import { Card, CardTitle } from '@/components/ui/Card'
import { Link } from 'react-router-dom'
import { buttonClass } from '@/components/ui/Button'
import { PixelHeart } from '@/components/layout/Header'

/** 功能图标（线条风，与站内 SVG 图标语言一致，不使用 emoji 字形）。 */

function IconShell({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}

function GridIcon() {
  return (
    <IconShell>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </IconShell>
  )
}

function BeadsIcon() {
  return (
    <IconShell>
      <circle cx="8" cy="9" r="4" />
      <circle cx="16" cy="9" r="4" />
      <circle cx="12" cy="16" r="4" />
    </IconShell>
  )
}

function FlameIcon() {
  return (
    <IconShell>
      <path d="M12 3c3 3.5 5 6.3 5 9a5 5 0 1 1-10 0c0-2.7 2-5.5 5-9z" />
      <path d="M12 12c.8 1 1.2 1.8 1.2 2.6a1.2 1.2 0 1 1-2.4 0c0-.8.4-1.6 1.2-2.6z" />
    </IconShell>
  )
}

function ExportIcon() {
  return (
    <IconShell>
      <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" />
      <path d="M3 8l9 5 9-5" />
      <path d="M12 13v8" />
    </IconShell>
  )
}

const FEATURE_CARDS = [
  {
    title: '三类创作入口',
    desc: '自由创作与导入作品合并为空白画布入口（可预挂参考图），图片转图独立入口，Q版 / 标准 / 写真三种生成类型。',
    icon: <GridIcon />,
  },
  {
    title: '五品牌 1,386 色',
    desc: 'MARD / COCO / Perler / Hama / Artkal 全量色号内置，CIEDE2000 色彩科学匹配，品牌切换一键映射。',
    icon: <BeadsIcon />,
  },
  {
    title: '烫染效果预览',
    desc: '正常烫、毛巾烫、格利特烫等预设实时预览，渲染层属性零副作用，所见即所得。',
    icon: <FlameIcon />,
  },
  {
    title: '导出三件套',
    desc: '图纸 PNG、BOM 用料 CSV、工程 JSON 一键导出，工程文件内嵌参考图，随时迁移继续拼。',
    icon: <ExportIcon />,
  },
]

export function About() {
  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 pb-20 pt-10 sm:px-6">
      <section className="rounded-cardLg bg-hero-gradient px-6 py-12 text-center text-heroInk shadow-soft-lg sm:px-12">
        <PixelHeart className="mx-auto mb-4 h-10 w-10 text-white/60" />
        <h1 className="text-3xl font-extrabold sm:text-4xl">关于拼豆 PinDou</h1>
        <p className="mx-auto mt-4 max-w-xl leading-relaxed opacity-80">
          我们是一群把像素梦想拼进格子里的人。PinDou 是纯浏览器端的拼豆创作工具——
          不登录、不上传、不收费，打开网页就能开始创作。
        </p>
      </section>

      <section className="grid gap-5 sm:grid-cols-2">
        {FEATURE_CARDS.map((card) => (
          <Card key={card.title} hover className="space-y-3">
            <span
              aria-hidden
              className="inline-flex h-10 w-10 items-center justify-center rounded-thumbSm bg-primaryFaint text-primaryStrong"
            >
              {card.icon}
            </span>
            <CardTitle dot={false}>{card.title}</CardTitle>
            <p className="text-sm leading-relaxed text-inkSoft">{card.desc}</p>
          </Card>
        ))}
      </section>

      <Card tone="soft" className="flex flex-col items-center gap-4 text-center">
        <h2 className="text-xl font-extrabold">准备好了吗？</h2>
        <p className="max-w-md text-sm leading-relaxed text-inkSoft">
          工具页（编辑器）为纯客户端应用，不参与预渲染与索引；营销页与图库（P1）将持续输出静态内容。
        </p>
        <Link to="/" className={buttonClass('primary', 'md')}>
          返回首页
        </Link>
      </Card>
    </div>
  )
}
