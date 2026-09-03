import { ReactNode, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, buttonClass } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { Drawer, DrawerSide } from '@/components/ui/Drawer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Tooltip } from '@/components/ui/Tooltip'
import { THEME_ACCENTS, useThemeStore } from '@/store/theme'
import { cn } from '@/lib/utils'

/**
 * /dev/ui —— 通用 UI 组件演示页（CSR，noindex）。
 * 视觉走 web-style token：全 pill 按钮、24–32px 圆角卡片、soft 阴影、双主题 + 暗色。
 */

const BUTTON_VARIANTS = ['primary', 'soft', 'outline', 'ghost', 'heroLight'] as const
const BUTTON_SIZES = ['sm', 'md', 'lg'] as const

export function DevUi() {
  return (
    <div className="min-h-screen bg-bg-alt">
      <div className="mx-auto max-w-4xl space-y-10 px-4 py-10 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold">组件演示</h1>
            <p className="mt-1 text-sm text-inkSoft">components/ui · 视觉基准 web-style 双图</p>
          </div>
          <Link to="/" className={buttonClass('outline', 'sm')}>
            返回首页
          </Link>
        </header>

        <ThemeSection />
        <ButtonSection />
        <CardSection />
        <DialogSection />
        <DrawerSection />
        <TabsSection />
        <TooltipSection />
      </div>
    </div>
  )
}

function DemoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2.5 text-xl font-extrabold">
        <span aria-hidden className="inline-block h-3.5 w-3.5 rounded-full bg-primary shadow-sticker" />
        {title}
      </h2>
      <Card>{children}</Card>
    </section>
  )
}

function ThemeSection() {
  const accent = useThemeStore((s) => s.accent)
  const dark = useThemeStore((s) => s.dark)
  const setAccent = useThemeStore((s) => s.setAccent)
  const toggleDark = useThemeStore((s) => s.toggleDark)

  return (
    <DemoSection title="主题">
      <div className="flex flex-wrap items-center gap-4">
        <div role="radiogroup" aria-label="主题色" className="flex items-center gap-2">
          {THEME_ACCENTS.map((option) => (
            <Button
              key={option.key}
              size="sm"
              variant={accent === option.key ? 'primary' : 'outline'}
              onClick={() => setAccent(option.key)}
            >
              <span
                aria-hidden
                className="h-3 w-3 rounded-full border border-white/40"
                style={{ backgroundColor: option.swatch }}
              />
              {option.label}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="soft" onClick={toggleDark}>
          {dark ? '当前暗色 · 切到亮色' : '当前亮色 · 切到暗色'}
        </Button>
        <p className="text-xs text-inkSoft">token 全站生效：CSS 变量 + data-theme / .dark</p>
      </div>
    </DemoSection>
  )
}

function ButtonSection() {
  return (
    <DemoSection title="Button">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant}>
              {variant}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {BUTTON_SIZES.map((size) => (
            <Button key={size} size={size}>
              {size}
            </Button>
          ))}
          <Button disabled>disabled</Button>
        </div>
        <div className="rounded-card bg-hero-gradient p-4">
          <Button variant="heroLight">heroLight（渐变横幅上）</Button>
        </div>
      </div>
    </DemoSection>
  )
}

function CardSection() {
  return (
    <DemoSection title="Card">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card tone="surface" hover className="space-y-2">
          <CardTitle>surface</CardTitle>
          <p className="text-sm text-inkSoft">白卡片 + soft 阴影，hover 上移。</p>
        </Card>
        <Card tone="soft" className="space-y-2">
          <CardTitle dot={false}>soft</CardTitle>
          <p className="text-sm text-inkSoft">主题淡色面板。</p>
        </Card>
        <Card tone="hero" className="space-y-2">
          <CardTitle dot={false}>hero</CardTitle>
          <p className="text-sm opacity-80">粉彩渐变横幅卡。</p>
        </Card>
      </div>
    </DemoSection>
  )
}

function DialogSection() {
  const [open, setOpen] = useState(false)
  return (
    <DemoSection title="Dialog">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setOpen(true)}>打开对话框</Button>
        <p className="text-xs text-inkSoft">Esc / 遮罩点击关闭，打开时锁定背景滚动</p>
      </div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="导出图纸确认"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              再改改
            </Button>
            <Button onClick={() => setOpen(false)}>确认导出</Button>
          </>
        }
      >
        <p>
          将导出：图纸 PNG、BOM CSV、工程 JSON 三件套。
          <br />
          预计用色 18 色 · 29×29 格。
        </p>
      </Dialog>
    </DemoSection>
  )
}

function DrawerSection() {
  const [side, setSide] = useState<DrawerSide | null>(null)
  return (
    <DemoSection title="Drawer">
      <div className="flex flex-wrap items-center gap-3">
        {(['left', 'right', 'bottom'] as const).map((s) => (
          <Button key={s} variant="outline" onClick={() => setSide(s)}>
            {s}
          </Button>
        ))}
        <p className="text-xs text-inkSoft">结构参考 lineone drawer，视觉走本站 token</p>
      </div>
      <Drawer open={side !== null} onClose={() => setSide(null)} side={side ?? 'right'} title="色板面板（示例）">
        <p>抽屉内容占位：m2 将承载 PalettePanel、导出设置等高密度面板。</p>
      </Drawer>
    </DemoSection>
  )
}

function TabsSection() {
  const [tab, setTab] = useState('convert')
  return (
    <DemoSection title="Tabs">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="draw">自由创作</TabsTrigger>
          <TabsTrigger value="convert">图片转图</TabsTrigger>
          <TabsTrigger value="finish">烫染预览</TabsTrigger>
        </TabsList>
        <TabsContent value="draw">
          <Card tone="soft">
            <p>空白画布直接开画，可预挂参考图（m2 落地）。</p>
          </Card>
        </TabsContent>
        <TabsContent value="convert">
          <Card tone="soft">
            <p>上传图片 → CIEDE2000 匹配 → 图纸，方向键可在触发器间移动（roving tabindex）。</p>
          </Card>
        </TabsContent>
        <TabsContent value="finish">
          <Card tone="soft">
            <p>正常烫 / 毛巾烫 / 格利特烫等预设切换（m4 落地）。</p>
          </Card>
        </TabsContent>
      </Tabs>
    </DemoSection>
  )
}

function TooltipSection() {
  return (
    <DemoSection title="Tooltip">
      <div className="flex flex-wrap items-center gap-6">
        {(['top', 'bottom', 'left', 'right'] as const).map((placement, i) => (
          <Tooltip key={placement} content={`${placement} 提示`} placement={placement}>
            <Button variant="soft" className={cn('focus-visible:ring-primary/30')}>
              悬停看 {i + 1}
            </Button>
          </Tooltip>
        ))}
        <p className="text-xs text-inkSoft">纯 CSS 实现，hover / 键盘聚焦均可触发</p>
      </div>
    </DemoSection>
  )
}
