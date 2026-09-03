import { describe, expect, it } from 'vitest';

import {
  FINISH_PRESET_KEYS,
  PRESET_PARAMS,
  renderFinish,
  toPresetKey,
  type FinishInput,
  type FinishPaletteData,
} from './finish';

/**
 * 烫染管线纯函数单测（design §6）：确定性 / 零副作用 / intensity=0 色彩近似 /
 * 六预设互异 / 预设参数结构 / 非法输入。
 */

/** 三色测试色板：红 / 绿 / 蓝。 */
const PALETTE: FinishPaletteData = {
  rgbs: [225, 40, 48, 46, 190, 90, 40, 96, 200],
  lum: [88, 141, 91],
};

/** 构造 4×4 测试网格（棋盘 + 空格）。 */
function makeCells(w: number, h: number): Int16Array {
  const cells = new Int16Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      cells[y * w + x] = (x + y) % 5 === 4 ? -1 : (x + y) % 3;
    }
  }
  return cells;
}

function makeInput(preset: FinishInput['preset'], intensity = 100, pxPerCell = 6): FinishInput {
  const w = 12;
  const h = 10;
  return { cells: makeCells(w, h), w, h, paletteData: PALETTE, preset, intensity, pxPerCell };
}

/** 输出统计：均值 + 标准差（区分度断言用）。 */
function stats(rgba: Uint8ClampedArray): { mean: number; std: number } {
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] === 0) continue;
    const l = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
    sum += l;
    sumSq += l * l;
    n++;
  }
  const mean = sum / n;
  return { mean, std: Math.sqrt(Math.max(0, sumSq / n - mean * mean)) };
}

/** 两输出的平均绝对差（只比有色像素）。 */
function meanAbsDiff(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] === 0 || b[i + 3] === 0) continue;
    sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    n++;
  }
  return n === 0 ? 0 : sum / n;
}

describe('finish.renderFinish', () => {
  it('同输入同输出（确定性，缓存指纹可用）', () => {
    const input = makeInput('towel');
    const a = renderFinish(input);
    const b = renderFinish({ ...input, cells: new Int16Array(input.cells) });
    expect(b.w).toBe(a.w);
    expect(b.h).toBe(a.h);
    expect(Buffer.from(b.rgba.buffer, b.rgba.byteOffset, b.rgba.byteLength).equals(
      Buffer.from(a.rgba.buffer, a.rgba.byteOffset, a.rgba.byteLength),
    )).toBe(true);
  });

  it('零副作用：cells 不被修改', () => {
    const input = makeInput('glitter');
    const before = new Int16Array(input.cells);
    renderFinish(input);
    expect(Array.from(input.cells)).toEqual(Array.from(before));
  });

  it('intensity=0 输出近似原色板色（豆心处恒等）', () => {
    const input = makeInput('normal', 0, 8);
    const out = renderFinish(input);
    const { w, h, cells } = input;
    // 逐格取豆心像素，应严格等于色板色（结构/光照/色调全部退化为恒等）
    for (let cy = 0; cy < h; cy++) {
      for (let cx = 0; cx < w; cx++) {
        const value = cells[cy * w + cx];
        if (value < 0) continue;
        const px = cx * 8 + 4;
        const py = cy * 8 + 4;
        const o = (py * out.w + px) * 4;
        expect(out.rgba[o]).toBeCloseTo(PALETTE.rgbs[value * 3], 0);
        expect(out.rgba[o + 1]).toBeCloseTo(PALETTE.rgbs[value * 3 + 1], 0);
        expect(out.rgba[o + 2]).toBeCloseTo(PALETTE.rgbs[value * 3 + 2], 0);
      }
    }
  });

  it('六预设输出互异（统计差异）', () => {
    const outputs = FINISH_PRESET_KEYS.map((key) => renderFinish(makeInput(key, 100, 6)).rgba);
    for (let i = 0; i < outputs.length; i++) {
      for (let j = i + 1; j < outputs.length; j++) {
        const diff = meanAbsDiff(outputs[i], outputs[j]);
        expect(diff, `${FINISH_PRESET_KEYS[i]} vs ${FINISH_PRESET_KEYS[j]} 差异 ${diff}`).toBeGreaterThan(2);
      }
    }
    // 六预设与强度 0（原图）也互异
    const flat = renderFinish(makeInput('normal', 0, 6)).rgba;
    for (let i = 0; i < outputs.length; i++) {
      // normal@100 与原图的差来自熔融结构（较弱），其余预设来自色调偏移
      const diff = meanAbsDiff(outputs[i], flat);
      expect(diff, `${FINISH_PRESET_KEYS[i]}@100 vs 原图 差异 ${diff}`).toBeGreaterThan(1.5);
    }
  });

  it('强度单调插值：k=0 与 k=100 之间，中间强度居中', () => {
    const lo = stats(renderFinish(makeInput('towel', 0, 6)).rgba);
    const hi = stats(renderFinish(makeInput('towel', 100, 6)).rgba);
    const mid = stats(renderFinish(makeInput('towel', 50, 6)).rgba);
    const span = Math.abs(hi.mean - lo.mean);
    if (span > 1) {
      const midOffset = Math.abs(mid.mean - lo.mean);
      expect(midOffset).toBeGreaterThan(span * 0.15);
      expect(midOffset).toBeLessThan(span * 0.85);
    }
  });

  it('空格透明：alpha=0', () => {
    const out = renderFinish(makeInput('waffle'));
    const { w, h, cells } = makeInput('waffle');
    for (let cy = 0; cy < h; cy++) {
      for (let cx = 0; cx < w; cx++) {
        if (cells[cy * w + cx] >= 0) continue;
        const px = cx * 6 + 3;
        const py = cy * 6 + 3;
        expect(out.rgba[(py * out.w + px) * 4 + 3]).toBe(0);
      }
    }
  });

  it('pxPerCell 决定输出尺寸，越界钳制', () => {
    expect(renderFinish(makeInput('normal', 100, 4)).w).toBe(12 * 4);
    expect(renderFinish(makeInput('normal', 100, 99)).w).toBe(12 * 24);
  });

  it('非法输入抛出（尺寸不符 / 色板三元组不齐）', () => {
    expect(() => renderFinish({ ...makeInput('normal'), cells: new Int16Array(3) })).toThrow();
    expect(() =>
      renderFinish({ ...makeInput('normal'), paletteData: { rgbs: [1, 2], lum: [0] } }),
    ).toThrow();
    expect(() => renderFinish({ ...makeInput('normal'), w: 0 })).toThrow();
  });

  it('toPresetKey：P2 预设回退 normal', () => {
    expect(toPresetKey('towel')).toBe('towel');
    expect(toPresetKey('noflap')).toBe('normal');
    expect(toPresetKey('wrinkle')).toBe('normal');
    // 回退后管线可正常出图
    expect(renderFinish(makeInput('noflap')).w).toBe(12 * 6);
  });
});

describe('finish.PRESET_PARAMS 结构', () => {
  it('六 key 齐全', () => {
    expect(Object.keys(PRESET_PARAMS).sort()).toEqual([...FINISH_PRESET_KEYS].sort());
    expect(FINISH_PRESET_KEYS).toHaveLength(6);
  });

  it('参数范围合法（有限、非负、频率/密度有界）', () => {
    for (const key of FINISH_PRESET_KEYS) {
      const { surface, light, tone } = PRESET_PARAMS[key];
      const all = [
        ...Object.values(surface),
        ...Object.values(light),
        ...Object.values(tone),
      ];
      for (const v of all) {
        expect(Number.isFinite(v), `${key} 参数非有限数`).toBe(true);
      }
      expect(surface.domeAmp).toBeGreaterThanOrEqual(0);
      expect(surface.domeAmp).toBeLessThanOrEqual(1.5);
      expect(surface.starDensity).toBeGreaterThanOrEqual(0);
      expect(surface.starDensity).toBeLessThanOrEqual(1);
      expect(surface.frostDensity).toBeGreaterThanOrEqual(0);
      expect(surface.frostDensity).toBeLessThanOrEqual(1);
      expect(surface.sequinRadius).toBeGreaterThanOrEqual(0);
      expect(surface.sequinRadius).toBeLessThanOrEqual(0.5);
      expect(surface.grooveWidth).toBeGreaterThanOrEqual(0);
      expect(surface.grooveWidth).toBeLessThanOrEqual(0.5);
      expect(light.roughness).toBeGreaterThanOrEqual(0);
      expect(light.roughness).toBeLessThanOrEqual(1);
      expect(light.specStrength).toBeGreaterThanOrEqual(0);
      expect(tone.saturation).toBeGreaterThan(0.3);
      expect(tone.saturation).toBeLessThan(2);
      expect(Math.abs(tone.brightness)).toBeLessThanOrEqual(100);
      expect(Math.abs(tone.warmth)).toBeLessThanOrEqual(100);
      expect(tone.contrast).toBeGreaterThan(0.3);
      expect(tone.contrast).toBeLessThan(2);
    }
  });

  it('六预设色调互不相同（视觉可区分的色彩基线）', () => {
    const tones = FINISH_PRESET_KEYS.map((k) => JSON.stringify(PRESET_PARAMS[k].tone));
    expect(new Set(tones).size).toBe(6);
  });
});

describe('finish 性能基准（55×63 基准用例，CI 安全线放宽，m6 实测回填）', () => {
  it('55×63 @8px 单预设渲染在安全线内', () => {
    const w = 55;
    const h = 63;
    const cells = new Int16Array(w * h);
    for (let i = 0; i < cells.length; i++) cells[i] = i % 7 === 3 ? -1 : i % 3;
    const input: FinishInput = { cells, w, h, paletteData: PALETTE, preset: 'glitter', intensity: 100, pxPerCell: 8 };
    const start = performance.now();
    const out = renderFinish(input);
    const elapsed = performance.now() - start;
    console.log(`[finish bench] 55×63 glitter @8px: ${elapsed.toFixed(0)}ms (${out.w}×${out.h})`);
    expect(elapsed).toBeLessThan(5000);
  });

  it('104×104 @4px（预览降级口径）在安全线内', () => {
    const w = 104;
    const h = 104;
    const cells = new Int16Array(w * h);
    for (let i = 0; i < cells.length; i++) cells[i] = i % 2;
    const input: FinishInput = { cells, w, h, paletteData: PALETTE, preset: 'sequin', intensity: 100, pxPerCell: 4 };
    const start = performance.now();
    renderFinish(input);
    const elapsed = performance.now() - start;
    console.log(`[finish bench] 104×104 sequin @4px: ${elapsed.toFixed(0)}ms`);
    expect(elapsed).toBeLessThan(5000);
  });
});
