import { cn } from '@/lib/utils';
import type { Rgb } from '@/lib/types';

/** 色板色块（PalettePanel / StatsPanel 共用）：圆角方块 + 选中环 + 可选颗数徽标。 */
export interface SwatchProps {
  rgb: Rgb;
  code: string;
  name: string;
  active?: boolean;
  /** 已用颗数（pixel-beads 采纳：色卡带颗数徽标）。 */
  count?: number;
  size?: 'sm' | 'md' | 'lg';
  title?: string;
  onClick?: () => void;
}

const SIZE_CLASS: Record<NonNullable<SwatchProps['size']>, string> = {
  sm: 'h-5 w-5 rounded-md',
  md: 'h-7 w-7 rounded-lg',
  lg: 'h-12 w-12 rounded-xl',
};

export function Swatch({ rgb, code, name, active = false, count, size = 'md', title, onClick }: SwatchProps) {
  const label = title ?? `${code} ${name}`;
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={cn(
        'relative shrink-0 transition-transform duration-150 active:scale-90',
        SIZE_CLASS[size],
        active ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface' : 'hover:scale-110 hover:shadow-sticker',
      )}
      style={{ backgroundColor: `rgb(${rgb.r},${rgb.g},${rgb.b})` }}
    >
      {count !== undefined && count > 0 && (
        <span className="absolute -right-1.5 -top-1.5 rounded-full bg-ink px-1.5 py-px text-[10px] font-bold leading-none text-bg shadow-sticker">
          {count > 999 ? '999+' : count}
        </span>
      )}
    </button>
  );
}
