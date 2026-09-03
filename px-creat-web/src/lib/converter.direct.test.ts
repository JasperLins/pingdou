import { describe, expect, it } from 'vitest';

import { rgbToLab } from './color';
import {
  DEFAULT_CONVERT_OPTIONS,
  applyAdjustments,
  clampAdjustments,
  cropImage,
  detectPixelGrid,
  estimateIsPhotographic,
  isNeutralAdjustments,
  mapPixelGrid,
  type PixelImage,
} from './converter';
import type { Palette } from './palettes';
import type { BeadColor, Rgb } from './types';

// ---------------------------------------------------------------------------
// 测试工具
// ---------------------------------------------------------------------------

/** 构造 RGBA 图：paint(x, y) 返回该像素 [r,g,b,a]。 */
function makeImage(
  w: number,
  h: number,
  paint: (x: number, y: number) => [number, number, number, number],
): PixelImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = paint(x, y);
      const o = (y * w + x) * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = a;
    }
  }
  return { width: w, height: h, data };
}

function solid(rgb: Rgb, alpha = 255): [number, number, number, number] {
  return [rgb.r, rgb.g, rgb.b, alpha];
}

/** 小型可控色板。 */
function mockPalette(entries: Array<[string, Rgb]>): Palette {
  const colors: BeadColor[] = entries.map(([code, rgb]) => ({
    brand: 'mard',
    code,
    name: code,
    rgb,
  }));
  return {
    brand: 'mard',
    colors,
    labs: colors.map((c) => rgbToLab(c.rgb)),
    matchable: colors.map((_, i) => i),
  };
}

const RED: Rgb = { r: 230, g: 30, b: 40 };
const BLUE: Rgb = { r: 30, g: 60, b: 220 };
const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 10, g: 10, b: 10 };

/** 生成 cols×rows 逻辑格、每格 pitch 像素的像素画。 */
function makePixelArt(
  cols: number,
  rows: number,
  pitch: number,
  cellColor: (cx: number, cy: number) => Rgb,
): PixelImage {
  return makeImage(cols * pitch, rows * pitch, (x, y) =>
    solid(cellColor(Math.floor(x / pitch), Math.floor(y / pitch))),
  );
}

// ---------------------------------------------------------------------------
// applyAdjustments / clampAdjustments
// ---------------------------------------------------------------------------

describe('applyAdjustments', () => {
  const img = makeImage(2, 1, (x) => solid(x === 0 ? { r: 100, g: 100, b: 100 } : { r: 200, g: 50, b: 50 }));

  it('中性参数返回原引用', () => {
    expect(applyAdjustments(img, { brightness: 0, contrast: 0, saturation: 0 })).toBe(img);
    expect(isNeutralAdjustments(clampAdjustments({}))).toBe(true);
  });

  it('亮度提亮按比例放大', () => {
    const out = applyAdjustments(img, { brightness: 50, contrast: 0, saturation: 0 });
    // 100 → 150（未触顶），200 → 255（钳制）
    expect(out.data[0]).toBe(150);
    expect(out.data[4]).toBe(255);
  });

  it('饱和度 -100 完全去色（三通道相等）', () => {
    const out = applyAdjustments(img, { brightness: 0, contrast: 0, saturation: -100 });
    expect(out.data[4]).toBe(out.data[5]);
    expect(out.data[5]).toBe(out.data[6]);
  });

  it('clampAdjustments 钳制到 -100–100 并取整', () => {
    const c = clampAdjustments({ brightness: 150, contrast: -200.4, saturation: 12.6 });
    expect(c).toEqual({ brightness: 100, contrast: -100, saturation: 13 });
  });
});

// ---------------------------------------------------------------------------
// cropImage
// ---------------------------------------------------------------------------

describe('cropImage', () => {
  it('提取子图且不重采样', () => {
    const img = makeImage(4, 4, (x, y) => solid({ r: x * 10, g: y * 10, b: 0 }));
    const out = cropImage(img, { x: 1, y: 2, w: 2, h: 1 });
    expect(out.width).toBe(2);
    expect(out.height).toBe(1);
    expect(out.data[0]).toBe(10); // x=1
    expect(out.data[1]).toBe(20); // y=2
  });

  it('越界矩形收敛到边界且至少 1×1', () => {
    const img = makeImage(8, 8, () => solid(RED));
    const out = cropImage(img, { x: -5, y: 7.9, w: 100, h: 100 });
    expect(out.width).toBe(8);
    expect(out.height).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// detectPixelGrid / mapPixelGrid（源图直映）
// ---------------------------------------------------------------------------

describe('detectPixelGrid', () => {
  it('识别整数倍放大的像素画网格（pitch=6）', () => {
    const art = makePixelArt(8, 8, 6, (cx, cy) => ((cx + cy) % 2 === 0 ? RED : BLUE));
    const grid = detectPixelGrid(art);
    expect(grid).not.toBeNull();
    expect(grid?.pitch).toBe(6);
    expect(grid?.cols).toBe(8);
    expect(grid?.rows).toBe(8);
  });

  it('照片式渐变无显著网格时返回 null', () => {
    const photo = makeImage(96, 96, (x, y) => solid({ r: (x * 255) / 96, g: (y * 255) / 96, b: 128 }));
    expect(detectPixelGrid(photo)).toBeNull();
  });

  it('抗锯齿（边界 1px 渐变）仍识别网格', () => {
    const cols = 10;
    const pitch = 5;
    const art = makeImage(cols * pitch, cols * pitch, (x, y) => {
      // 每格边界处左右/上下各 1px 做 50% 混色，模拟缩放抗锯齿
      const cx = Math.floor(x / pitch);
      const cy = Math.floor(y / pitch);
      const inCellX = x % pitch;
      const inCellY = y % pitch;
      let fx = cx;
      let fy = cy;
      let mix = 0;
      if (inCellX === 0 && x > 0) {
        fx = cx - 1;
        mix = Math.max(mix, 0.5);
      } else if (inCellX === pitch - 1 && x < cols * pitch - 1) {
        mix = Math.max(mix, 0.5);
      }
      if (inCellY === 0 && y > 0) {
        fy = cy - 1;
        mix = Math.max(mix, 0.5);
      }
      const a = (cx + cy) % 2 === 0 ? RED : BLUE;
      const b = (fx + Math.max(fy, 0)) % 2 === 0 ? RED : BLUE;
      const lerp = (p: number, q: number): number => p + (q - p) * mix;
      return [lerp(a.r, b.r), lerp(a.g, b.g), lerp(a.b, b.b), 255];
    });
    const grid = detectPixelGrid(art);
    expect(grid).not.toBeNull();
    expect(grid?.pitch).toBe(pitch);
    expect(grid?.cols).toBe(cols);
  });
});

describe('mapPixelGrid（像素画/图纸直映）', () => {
  const palette = mockPalette([
    ['R1', RED],
    ['B1', BLUE],
    ['W1', WHITE],
    ['K1', BLACK],
  ]);

  it('产出格数 = 源图网格，色号为最近色', () => {
    const pattern = (cx: number, cy: number): boolean => (cx * 7 + cy * 5) % 3 === 0;
    const art = makePixelArt(9, 12, 4, (cx, cy) => (pattern(cx, cy) ? RED : BLUE));
    const result = mapPixelGrid(art, palette);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.w).toBe(9);
    expect(result.h).toBe(12);
    expect(result.cells.length).toBe(9 * 12);
    const redIdx = palette.colors.findIndex((c) => c.code === 'R1');
    const blueIdx = palette.colors.findIndex((c) => c.code === 'B1');
    for (let cy = 0; cy < 12; cy++) {
      for (let cx = 0; cx < 9; cx++) {
        const expected = pattern(cx, cy) ? redIdx : blueIdx;
        expect(result.cells[cy * 9 + cx]).toBe(expected);
      }
    }
    expect(result.usedCodes).toBe(2);
  });

  it('带网格边界余量时取完整格子区域', () => {
    // 8 格 pitch 4 = 32px，再附加 3px 余量（右侧白边）
    const padded = makeImage(35, 32, (x, y) => {
      if (x >= 32) return solid(WHITE);
      const cx = Math.floor(x / 4);
      const cy = Math.floor(y / 4);
      return solid((cx + cy) % 2 === 0 ? WHITE : BLACK);
    });
    const result = mapPixelGrid(padded, palette);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.w).toBe(8);
    expect(result.h).toBe(8);
  });

  it('网格超过 104×104 返回 too_large（P2 承接文案）', () => {
    // pitch=1 的 120×120 图 → 逐像素直映 120×120 > 104
    const big = makeImage(120, 120, (x, y) => solid({ r: x, g: y, b: (x + y) % 256 }));
    const result = mapPixelGrid(big, palette);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('too_large');
  });

  it('网格小于 7×7 返回 low_resolution', () => {
    const tiny = makePixelArt(5, 5, 8, (cx, cy) => ((cx + cy) % 2 === 0 ? RED : BLUE));
    const result = mapPixelGrid(tiny, palette);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('low_resolution');
  });

  it('透明格输出 -1，targetColors 子集限制生效', () => {
    // 8×8 网格：左半透明，右半红蓝棋盘
    const art = makeImage(64, 64, (x, y) => {
      const cx = Math.floor(x / 8);
      const cy = Math.floor(y / 8);
      if (cx < 4) return [0, 0, 0, 0];
      return solid((cx + cy) % 2 === 0 ? RED : BLUE);
    });
    const result = mapPixelGrid(art, palette);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.w).toBe(8);
    expect(result.cells[0]).toBe(-1); // 左上透明
    expect(result.cells[7 * 8 + 7]).not.toBe(-1); // 右下实色

    const limited = mapPixelGrid(art, palette, { ...DEFAULT_CONVERT_OPTIONS, targetColors: 1 });
    expect(limited.ok).toBe(true);
    if (!limited.ok) return;
    expect(limited.usedCodes).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// estimateIsPhotographic（Q版 + 写实照片提示的判定依据）
// ---------------------------------------------------------------------------

describe('estimateIsPhotographic', () => {
  it('平涂卡通图判为非照片', () => {
    const art = makePixelArt(45, 45, 4, (cx, cy) => ((cx + cy) % 2 === 0 ? RED : BLUE));
    expect(estimateIsPhotographic(art)).toBe(false);
  });

  it('连续渐变噪声图判为照片', () => {
    const photo = makeImage(400, 400, (x, y) =>
      solid({ r: (x * 7 + y * 3) % 256, g: (x * 5 + y * 11) % 256, b: (x * 13 + y * 2) % 256 }),
    );
    expect(estimateIsPhotographic(photo)).toBe(true);
  });

  it('样本太少不判定', () => {
    const small = makeImage(30, 30, (x, y) => solid({ r: (x * 7 + y * 3) % 256, g: x, b: y }));
    expect(estimateIsPhotographic(small)).toBe(false);
  });
});
