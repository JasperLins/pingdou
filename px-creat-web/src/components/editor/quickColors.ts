import { findNearestColors, type Palette } from '@/lib/palettes';
import type { Rgb } from '@/lib/types';

/**
 * 常用色快捷行（Beadify 采纳）：24 个固定常用色目标值，
 * 按当前品牌色板 CIEDE2000 就近解析为具体色号。
 */

export const QUICK_COLOR_TARGETS: readonly Rgb[] = [
  { r: 20, g: 20, b: 24 },
  { r: 90, g: 88, b: 92 },
  { r: 150, g: 148, b: 152 },
  { r: 205, g: 203, b: 206 },
  { r: 250, g: 250, b: 250 },
  { r: 250, g: 240, b: 215 },
  { r: 110, g: 70, b: 45 },
  { r: 245, g: 205, b: 175 },
  { r: 140, g: 25, b: 35 },
  { r: 220, g: 45, b: 50 },
  { r: 235, g: 110, b: 140 },
  { r: 250, g: 175, b: 200 },
  { r: 200, g: 95, b: 30 },
  { r: 245, g: 140, b: 50 },
  { r: 250, g: 190, b: 150 },
  { r: 230, g: 180, b: 60 },
  { r: 250, g: 225, b: 90 },
  { r: 25, g: 95, b: 55 },
  { r: 70, g: 165, b: 90 },
  { r: 170, g: 220, b: 190 },
  { r: 30, g: 130, b: 130 },
  { r: 90, g: 195, b: 215 },
  { r: 40, g: 60, b: 130 },
  { r: 120, g: 70, b: 160 },
];

/** 把常用色目标解析为当前品牌的色板下标（每目标取 CIEDE2000 最近 1 色）。 */
export function quickColorIndices(palette: Palette): number[] {
  return QUICK_COLOR_TARGETS.map((rgb) => findNearestColors(palette, rgb, 1)[0]?.index ?? 0);
}
