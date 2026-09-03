import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { ciede2000 } from './color';
import { applyDiff, denoise, denoiseStats, floodFill, getConnectedRegions, mapCellsToPalette } from './cellOps';
import { createNearestMatcher, convertImage, type PixelImage } from './converter';
import { FINISH_PRESET_KEYS, renderFinish, type FinishPaletteData } from './finish';
import { loadAllPalettes, loadPalette, type Palette } from './palettes';
import { BRAND_KEYS } from './types';
import {
  DEFAULT_SHEET_OPTIONS,
  computeBom,
  computeSheetLayout,
  renderPatternSheet,
  type Canvas2DLike,
} from './patternSheet';

/**
 * M6 P0 验收套件（.trellis/tasks/09-04-m6-acceptance）。
 *
 * 与既有 perf/bench 用例的分工：bench 用例断言 CI 安全线防退化；本套件是
 * 验收证据采集——Q1/Q2/Q3/Q6 逐项断言 + 性能合并实测，并把实测表落盘到
 * `.trellis/tasks/09-04-m6-acceptance/perf-results.md` 供验收报告引用。
 *
 * 确定性要求：全部正确性断言基于固定种子与解析结果，不含时间敏感判断；
 * 性能数字只记录不设验收阈值（阈值判定由报告人工对照 §4.10 给出），
 * 仅设远离常态的病理性上限防止管线劣化时静默通过。
 */

/** 病理性上限（ms）：只捕捉管线级劣化，不做性能验收判定。 */
const SANITY_MS = 30_000;

// ---------------------------------------------------------------------------
// 公共构造器（固定种子，可复现）
// ---------------------------------------------------------------------------

/** 线性同余伪随机（与 cellOps/patternSheet perf 用例同款）。 */
function makeRand(seed: number): () => number {
  let s = seed;
  return (): number => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/** 典型素材：照片式渐变 + 色块主体 + 高频纹理（与 converter.bench 同构）。 */
function makeTypicalImage(size: number): PixelImage {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const o = (y * size + x) * 4;
      const gx = x / size;
      const gy = y / size;
      const inSubject = x > size * 0.3 && x < size * 0.7 && y > size * 0.25 && y < size * 0.85;
      const n = ((x * 13 + y * 7) % 17) / 17 - 0.5;
      if (inSubject) {
        data[o] = 200 + n * 40;
        data[o + 1] = 120 + gy * 60 + n * 30;
        data[o + 2] = 90 + gx * 50 + n * 30;
      } else {
        data[o] = 200 + gx * 40 + n * 20;
        data[o + 1] = 210 + gy * 30 + n * 20;
        data[o + 2] = 235 + n * 20;
      }
      data[o + 3] = 255;
    }
  }
  return { width: size, height: size, data };
}

/** 色块马赛克素材：blockPx 整数倍对齐的纯色块棋盘（Q2 无抖动行为验证用）。 */
function makeMosaicImage(blockColors: readonly number[], palette: Palette, blockPx: number): PixelImage {
  const side = blockColors.length * blockPx;
  const data = new Uint8ClampedArray(side * side * 4);
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const o = (y * side + x) * 4;
      const row = Math.floor(y / blockPx);
      const col = Math.floor(x / blockPx);
      const block = blockColors[(row + col) % blockColors.length];
      const rgb = palette.colors[block].rgb;
      data[o] = rgb.r;
      data[o + 1] = rgb.g;
      data[o + 2] = rgb.b;
      data[o + 3] = 255;
    }
  }
  return { width: side, height: side, data };
}

/** 卡通类素材：大面积平涂色块 + 硬边（Q3 卡通类孤立格占比的代表性输入）。 */
function makeCartoonImage(size: number): PixelImage {
  const data = new Uint8ClampedArray(size * size * 4);
  const put = (x: number, y: number, r: number, g: number, b: number): void => {
    const o = (y * size + x) * 4;
    data[o] = r;
    data[o + 1] = g;
    data[o + 2] = b;
    data[o + 3] = 255;
  };
  const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean =>
    ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      // 天空背景 / 头发（大椭圆）/ 脸（内椭圆）/ 眼睛 / 腮红 / 嘴 / 衣领
      let c: [number, number, number] = [135, 206, 250];
      if (inEllipse(u, v, 0.5, 0.42, 0.3, 0.36)) c = [110, 75, 60]; // 头发
      if (inEllipse(u, v, 0.5, 0.5, 0.22, 0.24)) c = [255, 228, 205]; // 脸
      if (inEllipse(u, v, 0.42, 0.47, 0.05, 0.06) || inEllipse(u, v, 0.58, 0.47, 0.05, 0.06)) c = [70, 50, 45]; // 眼
      if (inEllipse(u, v, 0.38, 0.56, 0.05, 0.03) || inEllipse(u, v, 0.62, 0.56, 0.05, 0.03)) c = [255, 160, 160]; // 腮红
      if (inEllipse(u, v, 0.5, 0.62, 0.06, 0.025)) c = [210, 90, 90]; // 嘴
      if (v > 0.78 && u > 0.3 && u < 0.7) c = [240, 150, 170]; // 衣服
      if (v > 0.9) c = [90, 90, 110]; // 下摆
      put(x, y, c[0], c[1], c[2]);
    }
  }
  return { width: size, height: size, data };
}

/** 固定种子随机场（值为色板下标，约 12% 空格）。 */
function makeRandomField(seed: number, w: number, h: number, colorCount: number): Int16Array {
  const rand = makeRand(seed);
  const cells = new Int16Array(w * h);
  for (let i = 0; i < cells.length; i++) {
    cells[i] = rand() < 0.12 ? -1 : Math.floor(rand() * colorCount);
  }
  return cells;
}

/** Lab 空间贪心最远点采样：取彼此色差最大的 k 个可匹配色下标。 */
function pickSeparatedColors(palette: Palette, k: number): number[] {
  const labs = palette.matchable.map((i) => palette.labs[i]);
  const picked: number[] = [palette.matchable[0]];
  while (picked.length < k) {
    let bestIdx = -1;
    let bestMinD = -1;
    for (let c = 0; c < palette.matchable.length; c++) {
      if (picked.includes(palette.matchable[c])) continue;
      let minD = Infinity;
      for (const p of picked) {
        const d = ciede2000(labs[c], palette.labs[p]);
        if (d < minD) minD = d;
      }
      if (minD > bestMinD) {
        bestMinD = minD;
        bestIdx = c;
      }
    }
    picked.push(palette.matchable[bestIdx]);
  }
  return picked;
}

/** 计时工具：返回 [结果, 毫秒]。 */
function time<T>(fn: () => T): [T, number] {
  const t0 = performance.now();
  const result = fn();
  return [result, performance.now() - t0];
}

// ---------------------------------------------------------------------------
// Q1 色号可追溯：BOM 全量色号 ∈ 色板库（全品牌）
// ---------------------------------------------------------------------------

describe('验收 Q1 色号可追溯', () => {
  const all = loadAllPalettes();

  it('五品牌色板规模与 §4.5 一致（1,386 色总量级）', () => {
    const sizes = BRAND_KEYS.map((k) => ({ brand: k, count: all[k].colors.length }));
    const total = sizes.reduce((acc, s) => acc + s.count, 0);
    // 记录规模供报告引用；总量级断言防色板数据被误删
    console.info(`[acceptance] palette sizes: ${sizes.map((s) => `${s.brand}=${s.count}`).join(', ')}; total=${total}`);
    expect(total).toBeGreaterThan(1000);
    for (const key of BRAND_KEYS) {
      expect(all[key].colors.length).toBeGreaterThan(50);
    }
  });

  for (const brand of BRAND_KEYS) {
    it(`[${brand}] 随机场工程 BOM 全量色号可追溯`, () => {
      const palette = all[brand];
      const cells = makeRandomField(20260904, 52, 52, 40);
      const bom = computeBom(cells, 52, 52, palette);
      expect(bom.length).toBeGreaterThan(0);
      const known = new Set(palette.colors.map((c) => c.code));
      let counted = 0;
      const seen = new Set<string>();
      for (const row of bom) {
        expect(known.has(row.code), `色号 ${row.code} 不在 ${brand} 色板`).toBe(true);
        expect(row.brand).toBe(brand);
        expect(seen.has(row.code), `BOM 色号重复：${row.code}`).toBe(false);
        seen.add(row.code);
        counted += row.count;
      }
      const filled = [...cells].filter((v) => v >= 0).length;
      expect(counted).toBe(filled);
    });

    it(`[${brand}] 真实转换产物 BOM 全量色号可追溯`, () => {
      const palette = all[brand];
      const result = convertImage(makeTypicalImage(400), palette, 52, 52, {
        mode: 'cartoon',
        targetColors: 24,
        background: { remove: false, tolerance: 10 },
        alphaThreshold: 128,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const bom = computeBom(result.cells, 52, 52, palette);
      const known = new Set(palette.colors.map((c) => c.code));
      expect(bom.length).toBeGreaterThan(0);
      expect(bom.length).toBeLessThanOrEqual(24);
      for (const row of bom) {
        expect(known.has(row.code), `色号 ${row.code} 不在 ${brand} 色板`).toBe(true);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Q2 无抖动：管线代码断言 + 色数统计证据
// ---------------------------------------------------------------------------

describe('验收 Q2 无抖动', () => {
  it('转换管线源码无抖动实现路径（区域平均 + 最近色直映）', () => {
    const source = readFileSync(fileURLToPath(new URL('./converter.ts', import.meta.url)), 'utf-8');
    expect(/dither/i.test(source), '转换管线出现 dither 相关实现').toBe(false);
    // 管线主干存在：阶梯减半 → 区域平均代表色 → CIEDE2000 最近色直映
    for (const fn of ['halveToNear', 'computeRepresentatives', 'createNearestMatcher', 'convertImage']) {
      expect(source).toContain(fn);
    }
  });

  it('纯色块素材逐格直映（块内无扩散、无邻域耦合），色数统计 = 源色块数上限', () => {
    const palette = loadPalette('mard');
    const blocks = pickSeparatedColors(palette, 4);
    // 512px 源（4×4 色块，每块 128px=2^7）：阶梯减半全程整除，色块均匀性逐步保持，
    // 最终 8×8 网格中每块覆盖 2×2 格——任何边界混色/扩散都会破坏块内一致性
    const result = convertImage(makeMosaicImage(blocks, palette, 128), palette, 8, 8, {
      mode: 'cartoon',
      targetColors: 0,
      background: { remove: false, tolerance: 10 },
      alphaThreshold: 128,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const matcher = createNearestMatcher(palette);
    const seen = new Set<number>();
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const bRow = Math.floor(y / 2);
        const bCol = Math.floor(x / 2);
        const blockIdx = blocks[(bRow + bCol) % blocks.length];
        const i = y * 8 + x;
        const got = result.cells[i];
        // 行为断言一：输出 = 该格代表色对全色板的最近色直映（无抖动叠加）
        expect(got).toBe(matcher.nearestIndex(palette.colors[blockIdx].rgb));
        // 行为断言二：与所在色块色差极小（块内无扩散出的中间色）
        expect(ciede2000(palette.labs[got], palette.labs[blockIdx])).toBeLessThan(5);
        seen.add(got);
      }
    }
    // 行为断言三：色数统计 = 色块数（无额外颜色被引入）
    expect(seen.size).toBe(blocks.length);
    expect(result.usedCodes).toBe(blocks.length);
  });

  it('targetColors=16 转换的色数统计不超过上限（子集聚类约束生效）', () => {
    const palette = loadPalette('mard');
    const result = convertImage(makeTypicalImage(600), palette, 29, 29, {
      mode: 'cartoon',
      targetColors: 16,
      background: { remove: true, tolerance: 10 },
      alphaThreshold: 128,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.usedCodes).toBeLessThanOrEqual(16);
    console.info(`[acceptance] Q2 色数统计: 29×29 cartoon targetColors=16 → usedCodes=${result.usedCodes}`);
  });
});

// ---------------------------------------------------------------------------
// Q3 孤立单格：合成图案 denoiseStats 精确断言 + 真实转换产物占比
// ---------------------------------------------------------------------------

describe('验收 Q3 孤立单格', () => {
  it('合成图案（含 3 个已知孤立格）denoiseStats 精确统计', () => {
    // 12×8 满幅：3×2 色块阵列（每域 6 格）+ 3 个孤立单格
    const w = 12;
    const h = 8;
    const cells = new Int16Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        cells[y * w + x] = Math.floor(y / 2) * 4 + Math.floor(x / 3);
      }
    }
    // 已知孤立格：值与四邻均不同
    cells[2 * w + 2] = 99;
    cells[5 * w + 7] = 98;
    cells[7 * w + 10] = 97;

    const stats = denoiseStats(cells, w, h, 1);
    expect(stats).toEqual({ regions: 3, cells: 3 });

    const diff = denoise(cells, w, h, 1);
    expect(diff.indices).toEqual([2 * w + 2, 5 * w + 7, 7 * w + 10]);
    expect(denoiseStats(applyDiff(cells, diff), w, h, 1)).toEqual({ regions: 0, cells: 0 });

    // 阈值扫描：threshold=4 仍只清 3 个单格（色块域面积 5–6）；threshold=6 清空全图
    expect(denoiseStats(cells, w, h, 4)).toEqual({ regions: 3, cells: 3 });
    expect(denoiseStats(cells, w, h, 6)).toEqual({ regions: 19, cells: 96 });
  });

  it('真实转换产物（104×104 卡通类）孤立单格占比 < 5%', () => {
    const palette = loadPalette('mard');
    const result = convertImage(makeCartoonImage(800), palette, 104, 104, {
      mode: 'cartoon',
      targetColors: 0,
      background: { remove: false, tolerance: 10 },
      alphaThreshold: 128,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stats = denoiseStats(result.cells, 104, 104, 1);
    const filled = [...result.cells].filter((v) => v >= 0).length;
    const ratio = filled === 0 ? 1 : stats.cells / filled;
    // 对照组：照片式高频素材（非卡通类）不在 Q3 约束内，仅记录供报告引用
    const photoResult = convertImage(makeTypicalImage(800), palette, 104, 104, {
      mode: 'cartoon',
      targetColors: 0,
      background: { remove: false, tolerance: 10 },
      alphaThreshold: 128,
    });
    const photoStats = photoResult.ok ? denoiseStats(photoResult.cells, 104, 104, 1) : null;
    console.info(
      `[acceptance] Q3 孤立单格: 卡通类 ${stats.cells}/${filled} 格（${(ratio * 100).toFixed(2)}%），阈值 <5%` +
        (photoStats ? `；照片式高频素材对照 ${photoStats.cells} 格（不受 Q3 约束）` : ''),
    );
    expect(ratio).toBeLessThan(0.05);
  });
});

// ---------------------------------------------------------------------------
// Q6 色彩还原守护：三品牌各 5 色 CSV ↔ loadPalette 一致性
// ---------------------------------------------------------------------------

describe('验收 Q6 色板加载一致性抽查（三品牌 × 5 色）', () => {
  /** 独立 mini 解析器：不依赖 parsePaletteCsv，双重解析交叉验证。 */
  function csvRgbMap(csv: string): Map<string, { name: string; r: number; g: number; b: number }> {
    const map = new Map<string, { name: string; r: number; g: number; b: number }>();
    for (const rawLine of csv.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (line === '' || line.startsWith('#')) continue;
      const parts = line.split(',');
      if (parts[0] === 'code') continue;
      map.set(parts[0], { name: parts[1], r: Number(parts[2]), g: Number(parts[3]), b: Number(parts[4]) });
    }
    return map;
  }

  const CASES: readonly { brand: 'mard' | 'coco' | 'perler'; csvs: readonly string[] }[] = [
    { brand: 'mard', csvs: ['../data/mard.csv'] },
    { brand: 'coco', csvs: ['../data/coco.csv'] },
    { brand: 'perler', csvs: ['../data/perler.csv'] },
  ];

  for (const { brand, csvs } of CASES) {
    it(`[${brand}] 5 个抽查色的 rgb/name 与 CSV 源数据一致`, () => {
      const palette = loadPalette(brand);
      const byCode = new Map(palette.colors.map((c) => [c.code, c]));
      // 均匀抽样 5 个下标（首/四分位/尾），确定性
      const n = palette.colors.length;
      const picks = [0, Math.floor(n * 0.25), Math.floor(n * 0.5), Math.floor(n * 0.75), n - 1].map(
        (i) => palette.colors[i].code,
      );
      expect(new Set(picks).size).toBe(5);
      for (const csv of csvs) {
        const source = csvRgbMap(readFileSync(fileURLToPath(new URL(csv, import.meta.url)), 'utf-8'));
        for (const code of picks) {
          const loaded = byCode.get(code);
          const raw = source.get(code);
          expect(loaded, `色板缺少抽查色 ${code}`).toBeDefined();
          expect(raw, `CSV 缺少抽查色 ${code}`).toBeDefined();
          if (!loaded || !raw) continue;
          expect(loaded.rgb).toEqual({ r: raw.r, g: raw.g, b: raw.b });
          expect(loaded.name).toBe(raw.name);
        }
      }
      console.info(`[acceptance] Q6 [${brand}] 抽查色 ${picks.join('/')} 与 CSV 一致`);
    });
  }
});

// ---------------------------------------------------------------------------
// 性能合并实测 → perf-results.md
// ---------------------------------------------------------------------------

/** 只记指令数不落像素的接收端（绘制调度开销下界，与 patternSheet.perf 同款）。 */
class CountingCanvas implements Canvas2DLike {
  fillStyle = '';
  strokeStyle = '';
  lineWidth = 1;
  font = '';
  textAlign = 'left';
  textBaseline = 'alphabetic';
  fillRect(): void {}
  strokeRect(): void {}
  fillText(): void {}
  measureText(text: string): { width: number } {
    return { width: text.length * 7 };
  }
}

interface PerfRow {
  group: string;
  scene: string;
  ms: number;
  target: string;
}

describe('验收 性能合并实测（§4.10）', () => {
  it(
    '转换 / 编辑数据操作 / 图纸渲染 / 烫染渲染 全量实测并落盘 perf-results.md',
    () => {
      const rows: PerfRow[] = [];
      const record = (group: string, scene: string, target: string, ms: number): void => {
        rows.push({ group, scene, target, ms });
        console.info(`[perf] ${group} / ${scene}: ${ms.toFixed(1)}ms`);
      };

      // ---- 转换管线：104×104×291 冷/热缓存 --------------------------------
      const mard = loadPalette('mard');
      const bigImage = makeTypicalImage(800);
      const options = {
        mode: 'cartoon' as const,
        targetColors: 0,
        background: { remove: false, tolerance: 10 },
        alphaThreshold: 128,
      };
      const [coldResult, coldMs] = time(() => convertImage(bigImage, mard, 104, 104, options));
      expect(coldResult.ok).toBe(true);
      record('转换管线', '104×104 × MARD 291 色 cartoon（冷缓存，含 JIT 预热）', '≤2s', coldMs);
      let hotMs = Infinity;
      for (let run = 0; run < 3; run++) {
        const [, ms] = time(() => convertImage(bigImage, mard, 104, 104, options));
        hotMs = Math.min(hotMs, ms);
      }
      record('转换管线', '104×104 × MARD 291 色 cartoon（热缓存，3 次取最优）', '≤2s', hotMs);
      const [qResult, qMs] = time(() =>
        convertImage(makeTypicalImage(600), mard, 29, 29, {
          ...options,
          targetColors: 16,
          background: { remove: true, tolerance: 10 },
        }),
      );
      expect(qResult.ok).toBe(true);
      record('转换管线', '29×29 targetColors=16 + 背景移除（Q 版场景）', '≤2s', qMs);
      expect(coldMs, '转换冷耗时病理性劣化').toBeLessThan(SANITY_MS);

      // ---- 编辑器数据操作（104×104，绘制响应的纯数据路径） ----------------
      const field = makeRandomField(20260904, 104, 104, 24);
      const [, regionsMs] = time(() => {
        const regions = getConnectedRegions(field, 104, 104);
        expect(regions.length).toBeGreaterThan(0);
      });
      record('编辑数据操作', 'getConnectedRegions（104×104 随机场）', '≤50ms', regionsMs);
      const [, statsMs] = time(() => denoiseStats(field, 104, 104, 2));
      record('编辑数据操作', 'denoiseStats(threshold=2)', '≤50ms', statsMs);
      const [, denoiseMs] = time(() => denoise(field, 104, 104, 2));
      record('编辑数据操作', 'denoise(threshold=2)', '≤50ms', denoiseMs);
      const empty = new Int16Array(104 * 104).fill(-1);
      const [, floodMs] = time(() => floodFill(empty, 104, 104, 0, 0, 5));
      record('编辑数据操作', 'floodFill（全图空格填充）', '≤50ms', floodMs);
      const [, mapMs] = time(() => mapCellsToPalette(field, loadPalette('coco'), mard));
      record('编辑数据操作', 'mapCellsToPalette（24 色 → MARD 291 一键映射）', '≤50ms', mapMs);

      // ---- 图纸渲染（104×104 指令路径） ------------------------------------
      const bom = computeBom(field, 104, 104, mard);
      const [, bomMs] = time(() => computeBom(field, 104, 104, mard));
      record('图纸渲染', `computeBom（104×104，${bom.length} 色）`, '≤50ms', bomMs);
      const [, layoutMs] = time(() => computeSheetLayout(104, 104, bom.length, DEFAULT_SHEET_OPTIONS));
      record('图纸渲染', 'computeSheetLayout（sheet 完整版式）', '≤50ms', layoutMs);
      const ctx = new CountingCanvas();
      const [, sheetMs] = time(() =>
        renderPatternSheet(ctx, { cells: field, w: 104, h: 104, palette: mard }, { ...DEFAULT_SHEET_OPTIONS, title: 'M6 验收' }),
      );
      record('图纸渲染', 'renderPatternSheet（完整版式 + 图例，指令计数端）', '≤100ms', sheetMs);
      const labeled = new Int16Array(104 * 104);
      for (let i = 0; i < labeled.length; i++) labeled[i] = i % 9;
      const labeledCtx = new CountingCanvas();
      const [, labelMs] = time(() =>
        renderPatternSheet(
          labeledCtx,
          { cells: labeled, w: 104, h: 104, palette: mard },
          { ...DEFAULT_SHEET_OPTIONS, cellLabels: true, cellPx: 24 },
        ),
      );
      record('图纸渲染', 'renderPatternSheet（cellLabels 全开最重路径）', '≤100ms', labelMs);

      // ---- 烫染渲染（55×63 六预设循环 + 104×104 预览降级） ----------------
      const rgbs: number[] = [];
      const lum: number[] = [];
      for (const c of mard.colors) {
        rgbs.push(c.rgb.r, c.rgb.g, c.rgb.b);
        lum.push(0.299 * c.rgb.r + 0.587 * c.rgb.g + 0.114 * c.rgb.b);
      }
      const paletteData: FinishPaletteData = { rgbs, lum };
      const [finishSource] = time(() => convertImage(makeTypicalImage(800), mard, 63, 55, options));
      expect(finishSource.ok).toBe(true);
      if (!finishSource.ok) throw new Error('55×63 转换失败');
      let presetTotalMs = 0;
      for (const preset of FINISH_PRESET_KEYS) {
        const [, ms] = time(() => renderFinish({ cells: finishSource.cells, w: 63, h: 55, paletteData, preset, intensity: 100, pxPerCell: 8 }));
        presetTotalMs += ms;
        record('烫染渲染', `55×63 @8px ${preset}（单预设切换成本）`, '≤1s', ms);
      }
      record('烫染渲染', '55×63 六预设全循环累计', '—', presetTotalMs);
      const [, seqMs] = time(() =>
        renderFinish({ cells: field, w: 104, h: 104, paletteData, preset: 'sequin', intensity: 100, pxPerCell: 4 }),
      );
      record('烫染渲染', '104×104 @4px sequin（预览降级口径）', '≤1s', seqMs);
      expect(presetTotalMs, '烫染六预设累计病理性劣化').toBeLessThan(SANITY_MS);

      writePerfResults(rows);
    },
    300_000,
  );
});

// ---------------------------------------------------------------------------
// perf-results.md 落盘
// ---------------------------------------------------------------------------

function writePerfResults(rows: readonly PerfRow[]): void {
  const dir = findTaskDir();
  if (!dir) {
    console.warn('[acceptance] 未找到 .trellis/tasks/09-04-m6-acceptance，跳过 perf-results.md 落盘');
    return;
  }
  const date = new Date().toLocaleDateString('sv-SE');
  const lines: string[] = [
    '# M6 性能合并实测（自动生成，勿手改）',
    '',
    `> 生成：${date} · 环境：Node ${process.version} / ${process.platform} · 套件：px-creat-web \`src/lib/acceptance.test.ts\``,
    '> 指令计数端（无真实光栅化）；浏览器端项目（绘制帧、自动保存、封面 ≤500ms）见 manual-checklist.md 主会话复测。',
    '',
  ];
  let lastGroup = '';
  for (const row of rows) {
    if (row.group !== lastGroup) {
      lines.push(`## ${row.group}`, '', '| 场景 | 实测 | 指标 |', '| --- | ---: | --- |');
      lastGroup = row.group;
    }
    lines.push(`| ${row.scene} | ${row.ms.toFixed(1)}ms | ${row.target} |`);
  }
  const out = `${lines.join('\n')}\n`;
  writeFileSync(join(dir, 'perf-results.md'), out, 'utf-8');
  console.info(`[acceptance] perf-results.md 已写入 ${join(dir, 'perf-results.md')}`);
}

/** 从本文件所在目录逐级向上找 `.trellis/tasks/09-04-m6-acceptance`。 */
function findTaskDir(): string | null {
  let dir = fileURLToPath(new URL('./', import.meta.url));
  for (let depth = 0; depth < 8; depth++) {
    const candidate = join(dir, '.trellis', 'tasks', '09-04-m6-acceptance');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
