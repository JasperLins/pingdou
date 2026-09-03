import { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * 大圆角卡片（24–32px，token rounded-card*）。tone：
 * - surface：白卡片 + soft 阴影（默认）；
 * - soft：主题淡色面板；
 * - hero：粉彩渐变横幅卡。
 */

export type CardTone = 'surface' | 'soft' | 'hero'

const TONE_CLASS: Record<CardTone, string> = {
  surface: 'bg-surface text-ink shadow-soft',
  soft: 'bg-surface2 text-ink',
  hero: 'bg-hero-gradient text-heroInk shadow-soft-lg',
}

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: CardTone
  /** 悬浮上移（贴纸卡/入口卡） */
  hover?: boolean
  padded?: boolean
}

export function Card({ tone = 'surface', hover = false, padded = true, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-card',
        TONE_CLASS[tone],
        padded && 'p-6',
        hover && 'transition-all duration-200 hover:-translate-y-1 hover:shadow-soft-lg',
        className,
      )}
      {...rest}
    />
  )
}

export interface CardTitleProps {
  children: ReactNode
  /** 左侧主题色圆点装饰 */
  dot?: boolean
  className?: string
}

export function CardTitle({ children, dot = true, className }: CardTitleProps) {
  return (
    <h3 className={cn('flex items-center gap-2.5 text-lg font-bold', className)}>
      {dot && (
        <span aria-hidden className="inline-block h-3 w-3 rounded-full bg-primary shadow-sticker" />
      )}
      {children}
    </h3>
  )
}
