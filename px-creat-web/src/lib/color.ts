/**
 * 色彩科学：sRGB → CIELAB 转换、CIEDE2000 色差、最近色查找。
 *
 * 实现依据：Sharma, Wu & Dalal (2005) "The CIEDE2000 Color-Difference Formula"
 * （含 hue 均值与 Δh 的 180° 折返修正），D65 白点、sRGB gamma。
 */

import type { Rgb } from './types';

/** CIELAB 颜色：L* 0–100，a* 与 b* 约 ±128。 */
export interface Lab {
  l: number;
  a: number;
  b: number;
}

const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------
// sRGB → CIELAB
// ---------------------------------------------------------------------------

/** sRGB 0–255 分量 → 线性光（IEC 61966-2-1）。 */
function srgbChannelToLinear(c: number): number {
  const cs = c / 255;
  return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

/** sRGB → CIE XYZ（D65），输入 0–255。 */
function rgbToXyz(rgb: Rgb): { x: number; y: number; z: number } {
  const r = srgbChannelToLinear(rgb.r);
  const g = srgbChannelToLinear(rgb.g);
  const b = srgbChannelToLinear(rgb.b);
  return {
    x: 0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
    y: 0.2126729 * r + 0.7151522 * g + 0.072175 * b,
    z: 0.0193339 * r + 0.119192 * g + 0.9503041 * b,
  };
}

/** D65 白点。 */
const WP = { x: 0.95047, y: 1.0, z: 1.08883 } as const;

/** CIE Lab 的 f 函数（t > 0.008856 走立方根，否则线性段）。 */
function labF(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

/**
 * sRGB → CIELAB（D65）。
 *
 * @param rgb 0–255 的 sRGB 颜色
 */
export function rgbToLab(rgb: Rgb): Lab {
  const { x, y, z } = rgbToXyz(rgb);
  const fx = labF(x / WP.x);
  const fy = labF(y / WP.y);
  const fz = labF(z / WP.z);
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

// ---------------------------------------------------------------------------
// CIEDE2000
// ---------------------------------------------------------------------------

/** atan2 结果规整到 [0, 360)。 */
function atan2Deg(y: number, x: number): number {
  const deg = Math.atan2(y, x) / DEG;
  return deg < 0 ? deg + 360 : deg;
}

/**
 * CIEDE2000 色差（kL = kC = kH = 1）。
 *
 * 遵循 Sharma 2005 修正公式：含 G 修正的 a'、hue 均值在 |h1'−h2'| > 180° 时的
 * ±360° 折返、以及 C1'C2' = 0 时的特殊处理。
 *
 * @param lab1 颜色 1（CIELAB）
 * @param lab2 颜色 2（CIELAB）
 * @returns ΔE00，非负；同色为 0
 */
export function ciede2000(lab1: Lab, lab2: Lab): number {
  const { l: l1, a: a1, b: b1 } = lab1;
  const { l: l2, a: a2, b: b2 } = lab2;

  const c1 = Math.hypot(a1, b1);
  const c2 = Math.hypot(a2, b2);
  const cBar = (c1 + c2) / 2;
  const cBar7 = Math.pow(cBar, 7);
  const pow25_7 = Math.pow(25, 7);
  const g = 0.5 * (1 - Math.sqrt(cBar7 / (cBar7 + pow25_7)));

  const a1p = (1 + g) * a1;
  const a2p = (1 + g) * a2;
  const c1p = Math.hypot(a1p, b1);
  const c2p = Math.hypot(a2p, b2);

  const h1p = c1p === 0 ? 0 : atan2Deg(b1, a1p);
  const h2p = c2p === 0 ? 0 : atan2Deg(b2, a2p);

  const dLp = l2 - l1;
  const dCp = c2p - c1p;

  let dhp = 0;
  if (c1p * c2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin((dhp * DEG) / 2);

  const lBarP = (l1 + l2) / 2;
  const cBarP = (c1p + c2p) / 2;

  let hBarP: number;
  if (c1p * c2p === 0) {
    hBarP = h1p + h2p;
  } else {
    const sum = h1p + h2p;
    if (Math.abs(h1p - h2p) <= 180) {
      hBarP = sum / 2;
    } else if (sum < 360) {
      hBarP = (sum + 360) / 2;
    } else {
      hBarP = (sum - 360) / 2;
    }
  }

  const t =
    1 -
    0.17 * Math.cos((hBarP - 30) * DEG) +
    0.24 * Math.cos(2 * hBarP * DEG) +
    0.32 * Math.cos((3 * hBarP + 6) * DEG) -
    0.2 * Math.cos((4 * hBarP - 63) * DEG);

  const dTheta = 30 * Math.exp(-Math.pow((hBarP - 275) / 25, 2));
  const rC = 2 * Math.sqrt(Math.pow(cBarP, 7) / (Math.pow(cBarP, 7) + pow25_7));
  const sL = 1 + (0.015 * Math.pow(lBarP - 50, 2)) / Math.sqrt(20 + Math.pow(lBarP - 50, 2));
  const sC = 1 + 0.045 * cBarP;
  const sH = 1 + 0.015 * cBarP * t;
  const rT = -Math.sin(2 * dTheta * DEG) * rC;

  const tl = dLp / sL;
  const tc = dCp / sC;
  const th = dHp / sH;
  return Math.sqrt(tl * tl + tc * tc + th * th + rT * tc * th);
}

/**
 * 两个 sRGB 颜色的 CIEDE2000 色差（便捷封装）。
 *
 * @param rgb1 颜色 1（0–255）
 * @param rgb2 颜色 2（0–255）
 */
export function rgbDeltaE(rgb1: Rgb, rgb2: Rgb): number {
  return ciede2000(rgbToLab(rgb1), rgbToLab(rgb2));
}

// ---------------------------------------------------------------------------
// HSL（色系分组用）
// ---------------------------------------------------------------------------

/** HSL 颜色：h ∈ [0,360)，s/l ∈ [0,1]。 */
export interface Hsl {
  h: number;
  s: number;
  l: number;
}

/**
 * sRGB → HSL。
 *
 * @param rgb 0–255 的 sRGB 颜色
 */
export function rgbToHsl(rgb: Rgb): Hsl {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return { h, s, l };
}
