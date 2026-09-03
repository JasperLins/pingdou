import { ForwardRefExoticComponent, RefAttributes, ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

/**
 * 全 pill 按钮。视觉走 web-style token：圆润、soft 阴影、按压缩放。
 * 需要以链接形态使用时，用 buttonClass(variant, size) 拼 react-router Link 的 className。
 */

export type ButtonVariant = 'primary' | 'soft' | 'outline' | 'ghost' | 'heroLight'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-onPrimary shadow-soft hover:bg-primaryStrong hover:shadow-soft-lg',
  soft: 'bg-primaryFaint text-primaryStrong hover:bg-primarySoft/50',
  outline:
    'border-2 border-line bg-surface text-ink hover:border-primary hover:text-primaryStrong',
  ghost: 'text-primaryStrong hover:bg-primaryFaint',
  heroLight:
    'bg-surface text-heroInk shadow-soft hover:-translate-y-0.5 hover:shadow-soft-lg',
}

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'px-4 py-1.5 text-sm',
  md: 'px-6 py-2.5 text-sm',
  lg: 'px-8 py-3 text-base',
}

const BASE_CLASS =
  'inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 ' +
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 ' +
  'active:scale-95 disabled:pointer-events-none disabled:opacity-50'

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string): string {
  return cn(BASE_CLASS, VARIANT_CLASS[variant], SIZE_CLASS[size], className)
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export const Button: ForwardRefExoticComponent<ButtonProps & RefAttributes<HTMLButtonElement>> =
  forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { variant = 'primary', size = 'md', type = 'button', className, ...rest },
    ref,
  ) {
    return <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...rest} />
  })
