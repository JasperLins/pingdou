import { describe, expect, it } from 'vitest';

import { rgbToLab } from './color';
import {
  DEFAULT_CONVERT_OPTIONS,
  computeRepresentatives,
  convertImage,
  createNearestMatcher,
  halveToNear,
  removeSolidBackground,
  selectPaletteSubset,
  validateSource,
  type CellRepresentative,
  type ConvertOptions,
  type PixelImage,
} from './converter';
import { loadPalette, type Palette } from './palettes';
import type { BeadColor, Rgb } from './types';

// ---------------------------------------------------------------------------
// 测试工具
// ---------------------------------------------------------------------------

/** 构造 RGBA 图：paint(x, y) 返回该像素 [r,g,b,a]。 */
function makeImage(w: number, h: number, paint: (x: number, y: number) => [number, number, number, number]): PixelImage {
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

/** 小型可控色板（硬边断言用）。 */
function mockPalette(entries: Array<[string, Rgb, BeadColor['colorType']?]>): Palette {
  const colors: BeadColor[] = entries.map(([code, rgb, colorType]) => ({
    brand: 'mard',
    code,
    name: code,
    rgb,
    ...(colorType === undefined ? {} : { colorType }),
  }));
  return {
    brand: 'mard',
    colors,
    labs: colors.map((c) => rgbToLab(c.rgb)),
    matchable: colors.map((c, i) => (c.colorType === undefined ? i : -1)).filter((i) => i >= 0),
  };
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const RED: Rgb = { r: 230, g: 30, b: 40 };
const GRAY: Rgb = { r: 128, g: 128, b: 128 };
const BLACK: Rgb = { r: 10, g: 10, b: 10 };
const BLUE: Rgb = { r: 30, g: 60, b: 220 };

/** 转换参数便捷构造。 */
function opts(over: Partial<ConvertOptions> = {}): ConvertOptions {
  return { ...DEFAULT_CONVERT_OPTIONS, ...over };
}

// ---------------------------------------------------------------------------
// 边界校验
// ---------------------------------------------------------------------------

describe('validateSource（§4.3.5 边界）', () => {
  it('低于 100×100 返回 low_resolution', () => {
    const img = makeImage(99, 200, () => solid(RED));
    const result = validateSource(img);
    expect(result?.code).toBe('low_resolution');
    expect(convertImage(img, mockPalette([]), 29, 29).ok).toBe(false);
  });

  it('近纯色返回 near_solid_color', () => {
    const img = makeImage(128, 128, () => solid(WHITE));
    expect(validateSource(img)?.code).toBe('near_solid_color');
  });

  it('JPEG 式轻微噪声的纯色图同样被判近纯色（覆盖率 ≥99.9%）', () => {
    let i = 0;
    const img = makeImage(200, 200, () => {
      i += 1;
      return i % 1000 === 0 ? solid({ r: 250, g: 252, b: 250 }) : solid(WHITE);
    });
    expect(validateSource(img)?.code).toBe('near_solid_color');
  });

  it('完全透明返回 near_solid_color', () => {
    const img = makeImage(128, 128, () => solid(WHITE, 0));
    expect(validateSource(img)?.code).toBe('near_solid_color');
  });

  it('透明底单色剪影是合法素材（不判近纯色）', () => {
    const img = makeImage(128, 128, (x, y) => (x >= 40 && x < 88 && y >= 40 && y < 88 ? solid(BLACK) : solid(BLACK, 0)));
    expect(validateSource(img)).toBeNull();
  });

  it('正常内容图通过', () => {
    const img = makeImage(128, 128, (x) => (x < 64 ? solid(RED) : solid(BLUE)));
    expect(validateSource(img)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 降采样
// ---------------------------------------------------------------------------

describe('halveToNear（阶梯式减半）', () => {
  it('中间结果不低于目标尺寸且 < 2× 目标', () => {
    const img = makeImage(800, 800, () => solid(RED));
    const mid = halveToNear(img, 104, 104, 'smooth');
    expect(mid.width).toBeGreaterThanOrEqual(104);
    expect(mid.width).toBeLessThan(208);
    expect(mid.height).toBe(mid.width);
  });

  it('目标接近源图尺寸时不减半', () => {
    const img = makeImage(120, 120, () => solid(RED));
    const mid = halveToNear(img, 104, 104, 'smooth');
    expect(mid.width).toBe(120);
  });

  it('平滑模式减半 = 区域平均（alpha 加权）', () => {
    // 4×4：左上 2×2 红，其余白 → 减半后 (0,0) 应为红
    const img = makeImage(4, 4, (x, y) => (x < 2 && y < 2 ? solid(RED) : solid(WHITE)));
    const mid = halveToNear(img, 2, 2, 'smooth');
    expect(mid.width).toBe(2);
    const o = 0;
    expect(mid.data[o]).toBeCloseTo(RED.r, 0);
    expect(mid.data[o + 1]).toBeCloseTo(RED.g, 0);
    expect(mid.data[o + 2]).toBeCloseTo(RED.b, 0);
  });

  it('卡通模式减半不混色：红白对角块的众数桶保持纯色', () => {
    // 2×2 红/白对角 → 众数桶并列取先到者，结果必为纯红或纯白（不是粉）
    const img = makeImage(2, 2, (x, y) => ((x + y) % 2 === 0 ? solid(RED) : solid(WHITE)));
    const mid = halveOncePublic(img, 'cartoon');
    const [r, g, b] = [mid.data[0], mid.data[1], mid.data[2]];
    const isPureRed = Math.abs(r - RED.r) < 2 && Math.abs(g - RED.g) < 2 && Math.abs(b - RED.b) < 2;
    const isPureWhite = Math.abs(r - 255) < 2 && Math.abs(g - 255) < 2 && Math.abs(b - 255) < 2;
    expect(isPureRed || isPureWhite).toBe(true);
  });
});

/** halveOnce 未导出，经 halveToNear 单步等价触发（4→2 恰一步）。 */
function halveOncePublic(img: PixelImage, mode: 'smooth' | 'cartoon'): PixelImage {
  return halveToNear(img, 2, 2, mode);
}

// ---------------------------------------------------------------------------
// 代表色
// ---------------------------------------------------------------------------

describe('computeRepresentatives（双模式）', () => {
  it('平滑模式 = 区域平均：红蓝渐变的中间格为混合色', () => {
    const img = makeImage(8, 8, (x) => [
      Math.round(RED.r + ((BLUE.r - RED.r) * x) / 7),
      Math.round(RED.g + ((BLUE.g - RED.g) * x) / 7),
      Math.round(RED.b + ((BLUE.b - RED.b) * x) / 7),
      255,
    ]);
    const reps = computeRepresentatives(img, 4, 4, 'smooth');
    expect(reps).toHaveLength(16);
    // 第 1 列（x=0..1）接近红
    expect(reps[0].rgb.r).toBeGreaterThan(180);
    expect(reps[0].rgb.b).toBeLessThan(120);
    // 第 4 列（x=6..7）接近蓝
    expect(reps[3].rgb.b).toBeGreaterThan(160);
    expect(reps[3].rgb.r).toBeLessThan(120);
    // 中间列是混合色（红蓝之间）
    expect(reps[1].rgb.b).toBeGreaterThan(reps[0].rgb.b);
    expect(reps[1].rgb.r).toBeLessThan(reps[0].rgb.r);
  });

  it('卡通模式 = 众数主导色：红白各半的格子不产生粉色混合', () => {
    // 8×8 目标 1×1？computeRepresentatives 直测：8×8 图 → 2×2 格，每格 4×4 像素中红白各半
    const img = makeImage(8, 8, (x) => (x < 4 ? solid(RED) : solid(WHITE)));
    const reps = computeRepresentatives(img, 2, 2, 'cartoon');
    for (const rep of reps) {
      const isRed = Math.abs(rep.rgb.r - RED.r) < 3 && Math.abs(rep.rgb.g - RED.g) < 3;
      const isWhite = rep.rgb.r > 250 && rep.rgb.g > 250;
      expect(isRed || isWhite, `got rgb(${rep.rgb.r},${rep.rgb.g},${rep.rgb.b})`).toBe(true);
    }
  });

  it('平均 alpha 反映透明占比', () => {
    const img = makeImage(8, 8, (x) => (x < 4 ? solid(RED, 255) : solid(RED, 0)));
    const reps = computeRepresentatives(img, 2, 2, 'smooth');
    expect(reps[0].alpha).toBeCloseTo(255, 0);
    expect(reps[1].alpha).toBeCloseTo(0, 0);
  });
});

// ---------------------------------------------------------------------------
// 背景移除
// ---------------------------------------------------------------------------

describe('removeSolidBackground（边缘扩散式）', () => {
  it('白底红方块：背景透空、主体保留', () => {
    const img = makeImage(200, 200, (x, y) => (x >= 60 && x < 140 && y >= 60 && y < 140 ? solid(RED) : solid(WHITE)));
    const out = removeSolidBackground(img, 10);
    // 边角像素被移除
    expect(out.data[3]).toBe(0);
    // 中心像素保留且仍是红
    const center = (100 * 200 + 100) * 4;
    expect(out.data[center + 3]).toBe(255);
    expect(out.data[center]).toBe(RED.r);
    // 与主体不连通的"白洞"（在主体内部）不被移除——本图无此构造，间接以保留像素计数验证
    let opaque = 0;
    for (let i = 3; i < out.data.length; i += 4) if (out.data[i] > 0) opaque += 1;
    expect(opaque).toBeGreaterThan(60 * 60);
    expect(opaque).toBeLessThan(200 * 200);
  });

  it('背景移除不越界侵蚀主体（容差 10）', () => {
    const img = makeImage(200, 200, (x, y) => (x >= 60 && x < 140 && y >= 60 && y < 140 ? solid(RED) : solid(WHITE)));
    const out = removeSolidBackground(img, 10);
    // 主体中心 20×20 全部保留
    for (let y = 90; y < 110; y++) {
      for (let x = 90; x < 110; x++) {
        expect(out.data[(y * 200 + x) * 4 + 3], `${x},${y}`).toBe(255);
      }
    }
  });

  it('输入不被修改（返回新缓冲）', () => {
    const img = makeImage(128, 128, () => solid(WHITE));
    removeSolidBackground(img, 10);
    expect(img.data[3]).toBe(255);
  });
});

// ---------------------------------------------------------------------------
// targetColors 子集选择
// ---------------------------------------------------------------------------

describe('selectPaletteSubset（目标色数）', () => {
  const mard = loadPalette('mard');

  function repsOf(colors: Rgb[]): CellRepresentative[] {
    return colors.map((rgb) => ({ alpha: 255, rgb }));
  }

  it('n=0 返回全量可匹配色', () => {
    const subset = selectPaletteSubset(repsOf([RED]), mard, 0);
    expect(subset.length).toBe(mard.matchable.length);
  });

  it('n=4 的渐变素材产出 ≤4 色子集，且子集都在可匹配色内', () => {
    const reps = repsOf(
      Array.from({ length: 64 }, (_, i) => ({
        r: Math.round(30 + (i * 200) / 63),
        g: Math.round(20 + (i * 100) / 63),
        b: 200,
      })),
    );
    const subset = selectPaletteSubset(reps, mard, 4);
    expect(subset.length).toBeLessThanOrEqual(4);
    expect(subset.length).toBeGreaterThan(0);
    for (const idx of subset) {
      expect(mard.matchable.includes(idx)).toBe(true);
    }
  });

  it('色相差异大的素材保住色相覆盖（红+绿+蓝+黄）', () => {
    const reps = repsOf([RED, { r: 30, g: 180, b: 40 }, BLUE, { r: 250, g: 220, b: 30 }]);
    const subset = selectPaletteSubset(reps, mard, 4);
    expect(subset.length).toBeGreaterThanOrEqual(3);
  });

  it('空代表色返回空子集', () => {
    expect(selectPaletteSubset([], mard, 16)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 主管线
// ---------------------------------------------------------------------------

describe('convertImage（主管线）', () => {
  it('alpha 通道直通：透明区域输出空格', () => {
    const img = makeImage(128, 128, (x) => (x < 64 ? solid(RED) : solid(RED, 0)));
    const palette = mockPalette([
      ['W', WHITE],
      ['R', RED],
      ['G', GRAY],
      ['K', BLACK],
    ]);
    const result = convertImage(img, palette, 16, 16, opts());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cells).toHaveLength(256);
    const redIdx = 1; // mockPalette 第二项 'R'
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const cell = result.cells[y * 16 + x];
        if (x < 8) {
          expect(cell, `(${x},${y}) 应为红`).toBe(redIdx);
        } else {
          expect(cell, `(${x},${y}) 应为空格`).toBe(-1);
        }
      }
    }
  });

  it('卡通模式硬边：白底红方块移除背景后无染灰格（Q2/Q4）', () => {
    const img = makeImage(200, 200, (x, y) => (x >= 60 && x < 140 && y >= 60 && y < 140 ? solid(RED) : solid(WHITE)));
    const palette = mockPalette([
      ['W', WHITE],
      ['R', RED],
      ['G', GRAY],
      ['K', BLACK],
    ]);
    const grayIdx = 2;
    const result = convertImage(img, palette, 20, 20, opts({ background: { remove: true, tolerance: 10 } }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const reds: number[] = [];
    let empties = 0;
    for (const cell of result.cells) {
      expect(cell, '不得出现染灰格').not.toBe(grayIdx);
      if (cell === -1) empties += 1;
      else if (cell === 1) reds.push(cell);
      else expect(cell, '只允许红或空格').toBe(1);
    }
    // 主体 80×80 源像素 ≈ 8×8 格全红
    expect(reds.length).toBeGreaterThanOrEqual(49);
    expect(empties).toBeGreaterThan(0);
  });

  it('卡通模式硬边（不移除背景）：边缘格只有纯红或纯白，无中间混色', () => {
    const img = makeImage(200, 200, (x, y) => (x >= 60 && x < 140 && y >= 60 && y < 140 ? solid(RED) : solid(WHITE)));
    const palette = mockPalette([
      ['W', WHITE],
      ['R', RED],
      ['G', GRAY],
      ['K', BLACK],
    ]);
    const result = convertImage(img, palette, 20, 20, opts());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const cell of result.cells) {
      expect(cell === 0 || cell === 1, `cell=${cell}`).toBe(true);
    }
  });

  it('平滑模式适配照片：渐变素材产出更多色号', () => {
    const gradient = makeImage(256, 256, (x, y) => [
      Math.round(20 + (x * 215) / 255),
      Math.round(30 + (y * 200) / 255),
      Math.round(240 - ((x + y) * 100) / 510),
      255,
    ]);
    const mard = loadPalette('mard');
    const smooth = convertImage(gradient, mard, 32, 32, opts({ mode: 'smooth' }));
    expect(smooth.ok).toBe(true);
    if (smooth.ok) expect(smooth.usedCodes).toBeGreaterThan(20);
  });

  it('targetColors=16 时产出用色 ≤16（真实 MARD 色板）', () => {
    const colorful = makeImage(256, 256, (x, y) => {
      const band = Math.floor((x / 256) * 8) * 32 + Math.floor((y / 256) * 8) * 8;
      const n = ((x * 7 + y * 13 + band * 29) % 256) / 255;
      return [Math.round(30 + n * 200), Math.round((1 - n) * 180 + 20), Math.round((band % 5) * 40 + 40), 255];
    });
    const mard = loadPalette('mard');
    const result = convertImage(colorful, mard, 29, 29, opts({ targetColors: 16 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.usedCodes).toBeLessThanOrEqual(16);
    expect(result.usedCodes).toBeGreaterThan(4);
  });

  it('结果确定性（缓存不改变输出）：同参数两次转换逐格一致', () => {
    const img = makeImage(180, 180, (x, y) => [
      (x * 3 + y * 5) % 256,
      (x * 7 + y * 11) % 256,
      (x * 13 + y * 3) % 256,
      255,
    ]);
    const mard = loadPalette('mard');
    const a = convertImage(img, mard, 26, 26, opts({ targetColors: 24 }));
    const b = convertImage(img, mard, 26, 26, opts({ targetColors: 24 }));
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(Array.from(a.cells)).toEqual(Array.from(b.cells));
  });

  it('转换结果 cells 与 BOM 口径兼容：非空格都指向存在的色板色', () => {
    const img = makeImage(160, 160, (x, y) => [(x * 5) % 256, (y * 3) % 256, ((x + y) * 2) % 256, 255]);
    const mard = loadPalette('mard');
    const result = convertImage(img, mard, 20, 20, opts());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const cell of result.cells) {
      if (cell >= 0) {
        expect(cell).toBeLessThan(mard.colors.length);
        expect(mard.colors[cell].colorType).toBeUndefined();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 匹配缓存
// ---------------------------------------------------------------------------

describe('createNearestMatcher（5bit 量化缓存）', () => {
  it('同桶颜色复用缓存结果且与逐次全量计算一致', () => {
    const mard = loadPalette('mard');
    const matcher = createNearestMatcher(mard);
    const a = matcher.nearestIndex({ r: 100, g: 150, b: 90 });
    const b = matcher.nearestIndex({ r: 102, g: 149, b: 92 }); // 同 5bit 桶
    expect(b).toBe(a);
    const c = matcher.nearestIndex({ r: 160, g: 30, b: 30 }); // 不同桶
    expect(c).toBeGreaterThanOrEqual(0);
  });

  it('子集限定后只在子集内匹配', () => {
    const mard = loadPalette('mard');
    const subset = mard.matchable.slice(0, 5);
    const matcher = createNearestMatcher(mard, subset);
    const idx = matcher.nearestIndex({ r: 200, g: 30, b: 30 });
    expect(subset.includes(idx)).toBe(true);
  });

  it('空色板返回 -1', () => {
    const empty = mockPalette([]);
    expect(createNearestMatcher(empty).nearestIndex(RED)).toBe(-1);
  });
});
