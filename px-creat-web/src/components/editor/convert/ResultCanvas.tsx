import { useEffect, useRef } from 'react';
import { loadPalette } from '@/lib/palettes';
import type { BrandKey } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * 转换结果画布（CompareView 右栏与 done 步共用）：
 * 色板下标逐格填色，-1 空格透出棋盘底。jsdom / 无 2D context 时 no-op。
 */
export interface ResultCanvasProps {
  w: number;
  h: number;
  cells: Int16Array | readonly number[];
  brandKey: BrandKey;
  /** 展示区最大边（CSS px） */
  maxSide?: number;
  className?: string;
}

export function ResultCanvas({ w, h, cells, brandKey, maxSide = 300, className }: ResultCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || w <= 0 || h <= 0) return;
    const cell = Math.max(1, Math.floor(maxSide / Math.max(w, h)));
    canvas.width = w * cell;
    canvas.height = h * cell;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const colors = loadPalette(brandKey).colors;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = cells[y * w + x];
        if (idx < 0 || idx >= colors.length) continue;
        const { r, g, b } = colors[idx].rgb;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
  }, [w, h, cells, brandKey, maxSide]);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={`转换结果 ${w}×${h} 格`}
      className={cn('max-w-full rounded-xl border border-line', className)}
      style={{
        maxWidth: '100%',
        maxHeight: maxSide,
        backgroundColor: '#fff',
        backgroundImage:
          'linear-gradient(45deg, rgb(0 0 0 / 0.06) 25%, transparent 25%, transparent 75%, rgb(0 0 0 / 0.06) 75%), linear-gradient(45deg, rgb(0 0 0 / 0.06) 25%, transparent 25%, transparent 75%, rgb(0 0 0 / 0.06) 75%)',
        backgroundSize: '16px 16px',
        backgroundPosition: '0 0, 8px 8px',
      }}
    />
  );
}
