/**
 * 烫染效果渲染管线（需求 §4.6.5，M4 design §1）：纯函数、无 DOM、无 React。
 *
 * 六阶段：meltBase（熔融基底）→ heightField（高度场）→ normalFromHeight（中心差分法线）
 * → lighting（漫反射 + Blinn-Phong 高光）→ presetFx（烫法特效层）→ tonemap（色调映射）。
 *
 * 契约要点：
 * - 零副作用：不修改输入 cells；同输入同输出（内部噪声全部为整数哈希驱动的确定性噪声）。
 * - 强度插值：结构幅度 / 色彩偏移 / 光泽强度统一乘 `intensity/100`；
 *   intensity=0 时输出近似原始色板色（缝/孔/光照/色调全部退化为恒等）。
 * - 预设参数与管线解耦：全部数值集中在 {@link PRESET_PARAMS}，可独立调优。
 * - 大图渲染（>50ms）由调用方放 Worker（见 finish.worker.ts / finishClient.ts）。
 */

import type { FinishPreset } from './types';

// ---------------------------------------------------------------------------
// 预设键
// ---------------------------------------------------------------------------

/** M4 交付的六种烫染预设键（P2 的 noflap/wrinkle 不在本管线内）。 */
export type FinishPresetKey = Extract<FinishPreset, 'normal' | 'towel' | 'glitter' | 'sequin' | 'waffle' | 'loofah'>;

/** 六预设有序清单（经典 / 质感 / 闪亮分组内的展示顺序）。 */
export const FINISH_PRESET_KEYS: readonly FinishPresetKey[] = [
  'normal',
  'towel',
  'waffle',
  'loofah',
  'glitter',
  'sequin',
];

/** 工程 finish.preset → 渲染键归一（P2 预设回退 normal）。 */
export function toPresetKey(preset: FinishPreset): FinishPresetKey {
  return (FINISH_PRESET_KEYS as readonly string[]).includes(preset) ? (preset as FinishPresetKey) : 'normal';
}

// ---------------------------------------------------------------------------
// 输入 / 输出
// ---------------------------------------------------------------------------

/** 色板渲染数据（与 CanvasStage 的 paletteData 同源，Worker 可结构化克隆）。 */
export interface FinishPaletteData {
  /** 色板 RGB 平铺三元组（r0,g0,b0,r1,g1,b1,…），下标与 cells 对应。 */
  rgbs: readonly number[];
  /** 每色亮度（0–255）。 */
  lum: readonly number[];
}

/** 烫染渲染输入。 */
export interface FinishInput {
  /** 色板下标数组（行优先，-1 = 空格；只读，不会被修改）。 */
  cells: Int16Array | readonly number[];
  w: number;
  h: number;
  paletteData: FinishPaletteData;
  preset: FinishPreset;
  /** 强度 0–100。 */
  intensity: number;
  /** 每格输出像素（1–24，默认 8）；预览降级时由调用方传更小值。 */
  pxPerCell?: number;
}

/** 烫染渲染输出（rgba 可直接 putImageData / 构造 ImageData）。 */
export interface FinishOutput {
  rgba: Uint8ClampedArray;
  w: number;
  h: number;
}

// ---------------------------------------------------------------------------
// 预设参数集（design §2：与管线解耦，便于调优）
// ---------------------------------------------------------------------------

/** 表面结构参数（未用的字段在各预设置 0）。 */
export interface SurfaceParams {
  /** 豆圆顶高度幅度（0–1.5）。 */
  domeAmp: number;
  /** 细颗粒噪声幅度 / 频率（频率单位：周期/格）。 */
  grainAmp: number;
  grainFreq: number;
  /** 毛巾烫：低频簇 / 纤维束幅度与频率。 */
  fuzzClumpAmp: number;
  fuzzClumpFreq: number;
  fuzzFiberAmp: number;
  fuzzFiberFreq: number;
  /** 毛巾烫：单丝逐像素抖动幅度（高度）。 */
  fuzzFilamentAmp: number;
  /** 毛巾烫：绒毛白化光泽（0–1）。 */
  fuzzSheen: number;
  /** 格利特烫：大颗星芒密度（每格期望颗数 0–1）与亮度。 */
  starDensity: number;
  starAmp: number;
  /** 格利特烫：细闪糖霜密度（0–1）与亮度。 */
  frostDensity: number;
  frostAmp: number;
  /** 亮片烫：片半径（格）、倾角幅度（高度）、斜向反光带强度、片缘暗线强度。 */
  sequinRadius: number;
  sequinTiltAmp: number;
  sequinBandAmp: number;
  sequinRingDark: number;
  /** 华夫格烫：凹槽深度（高度）与沟宽（格）。 */
  grooveDepth: number;
  grooveWidth: number;
  /** 搓澡巾烫：网眼阈值（0–1）、网丝幅度、经纬微纹理幅度。 */
  meshThreshold: number;
  meshStrandAmp: number;
  meshMicroAmp: number;
  /** 搓澡巾烫：网眼频率（周期/格）。 */
  meshFreq: number;
}

/** 光照参数。 */
export interface LightParams {
  /** 坡向漫反射强度（平面上恒等，仅坡度产生明暗）。 */
  diffuse: number;
  /** 高光强度（0–2）。 */
  specStrength: number;
  /** 粗糙度 0–1（越大高光越钝）。 */
  roughness: number;
  /** 法线坡度增益（分辨率无关）。 */
  normalStrength: number;
}

/** 色调参数（intensity=100 时的目标值；0 为恒等）。 */
export interface ToneParams {
  /** 饱和度倍率（1 = 保持）。 */
  saturation: number;
  /** 明度偏移（-100–100，8bit 单位）。 */
  brightness: number;
  /** 暖偏（-100–100，r+ / b-）。 */
  warmth: number;
  /** 对比度倍率（1 = 保持）。 */
  contrast: number;
}

/** 单预设完整参数。 */
export interface PresetParams {
  surface: SurfaceParams;
  light: LightParams;
  tone: ToneParams;
}

/** 六预设参数集。视觉基线为需求 §4.6.3 实现参考，最终以实物照片对照调优。 */
export const PRESET_PARAMS: Readonly<Record<FinishPresetKey, PresetParams>> = {
  // 正常烫：平整致密、柔和哑光、色彩保真基准
  normal: {
    surface: {
      domeAmp: 1.0, grainAmp: 0.05, grainFreq: 6,
      fuzzClumpAmp: 0, fuzzClumpFreq: 0, fuzzFiberAmp: 0, fuzzFiberFreq: 0, fuzzFilamentAmp: 0, fuzzSheen: 0,
      starDensity: 0, starAmp: 0, frostDensity: 0, frostAmp: 0,
      sequinRadius: 0, sequinTiltAmp: 0, sequinBandAmp: 0, sequinRingDark: 0,
      grooveDepth: 0, grooveWidth: 0, meshThreshold: 0, meshStrandAmp: 0, meshMicroAmp: 0, meshFreq: 0,
    },
    light: { diffuse: 0.3, specStrength: 0.1, roughness: 0.75, normalStrength: 0.9 },
    tone: { saturation: 1.0, brightness: 0, warmth: 0, contrast: 1.0 },
  },
  // 毛巾烫：三层绒毛（低频簇+纤维束+单丝），强漫反射，偏暖降饱和
  towel: {
    surface: {
      domeAmp: 0.7, grainAmp: 0.03, grainFreq: 5,
      fuzzClumpAmp: 0.28, fuzzClumpFreq: 1.4, fuzzFiberAmp: 0.18, fuzzFiberFreq: 4.5, fuzzFilamentAmp: 0.1, fuzzSheen: 0.12,
      starDensity: 0, starAmp: 0, frostDensity: 0, frostAmp: 0,
      sequinRadius: 0, sequinTiltAmp: 0, sequinBandAmp: 0, sequinRingDark: 0,
      grooveDepth: 0, grooveWidth: 0, meshThreshold: 0, meshStrandAmp: 0, meshMicroAmp: 0, meshFreq: 0,
    },
    light: { diffuse: 0.18, specStrength: 0.05, roughness: 0.95, normalStrength: 0.7 },
    tone: { saturation: 0.84, brightness: 4, warmth: 16, contrast: 0.93 },
  },
  // 格利特烫：双层闪粉（大颗星芒十字臂 + 细闪糖霜），虹彩抖动
  glitter: {
    surface: {
      domeAmp: 0.8, grainAmp: 0.02, grainFreq: 4,
      fuzzClumpAmp: 0, fuzzClumpFreq: 0, fuzzFiberAmp: 0, fuzzFiberFreq: 0, fuzzFilamentAmp: 0, fuzzSheen: 0,
      starDensity: 0.3, starAmp: 0.9, frostDensity: 0.16, frostAmp: 0.3,
      sequinRadius: 0, sequinTiltAmp: 0, sequinBandAmp: 0, sequinRingDark: 0,
      grooveDepth: 0, grooveWidth: 0, meshThreshold: 0, meshStrandAmp: 0, meshMicroAmp: 0, meshFreq: 0,
    },
    light: { diffuse: 0.3, specStrength: 0.9, roughness: 0.25, normalStrength: 0.8 },
    tone: { saturation: 1.06, brightness: 2, warmth: 0, contrast: 1.05 },
  },
  // 亮片烫：大颗亮片阵列 + 片间暗线 + 斜向反光带，镜面高光
  sequin: {
    surface: {
      domeAmp: 0.35, grainAmp: 0.01, grainFreq: 3,
      fuzzClumpAmp: 0, fuzzClumpFreq: 0, fuzzFiberAmp: 0, fuzzFiberFreq: 0, fuzzFilamentAmp: 0, fuzzSheen: 0,
      starDensity: 0, starAmp: 0, frostDensity: 0, frostAmp: 0,
      sequinRadius: 0.43, sequinTiltAmp: 0.55, sequinBandAmp: 0.3, sequinRingDark: 0.18,
      grooveDepth: 0, grooveWidth: 0, meshThreshold: 0, meshStrandAmp: 0, meshMicroAmp: 0, meshFreq: 0,
    },
    light: { diffuse: 0.32, specStrength: 1.1, roughness: 0.12, normalStrength: 1.1 },
    tone: { saturation: 1.04, brightness: 3, warmth: 5, contrast: 1.04 },
  },
  // 华夫格烫：规则方格凹凸压痕，坑壁迎光面亮
  waffle: {
    surface: {
      domeAmp: 0.25, grainAmp: 0.03, grainFreq: 5,
      fuzzClumpAmp: 0, fuzzClumpFreq: 0, fuzzFiberAmp: 0, fuzzFiberFreq: 0, fuzzFilamentAmp: 0, fuzzSheen: 0,
      starDensity: 0, starAmp: 0, frostDensity: 0, frostAmp: 0,
      sequinRadius: 0, sequinTiltAmp: 0, sequinBandAmp: 0, sequinRingDark: 0,
      grooveDepth: 0.9, grooveWidth: 0.18, meshThreshold: 0, meshStrandAmp: 0, meshMicroAmp: 0, meshFreq: 0,
    },
    light: { diffuse: 0.34, specStrength: 0.28, roughness: 0.5, normalStrength: 1.2 },
    tone: { saturation: 0.96, brightness: 1, warmth: 4, contrast: 1.0 },
  },
  // 搓澡巾烫：细密不规则网眼 + 织物经纬微纹理，偏灰做旧
  loofah: {
    surface: {
      domeAmp: 0.6, grainAmp: 0.03, grainFreq: 6,
      fuzzClumpAmp: 0, fuzzClumpFreq: 0, fuzzFiberAmp: 0, fuzzFiberFreq: 0, fuzzFilamentAmp: 0, fuzzSheen: 0,
      starDensity: 0, starAmp: 0, frostDensity: 0, frostAmp: 0,
      sequinRadius: 0, sequinTiltAmp: 0, sequinBandAmp: 0, sequinRingDark: 0,
      grooveDepth: 0, grooveWidth: 0, meshThreshold: 0.55, meshStrandAmp: 0.5, meshMicroAmp: 0.07, meshFreq: 2.6,
    },
    light: { diffuse: 0.26, specStrength: 0.1, roughness: 0.85, normalStrength: 0.9 },
    tone: { saturation: 0.74, brightness: -6, warmth: -6, contrast: 0.92 },
  },
};

// ---------------------------------------------------------------------------
// 确定性噪声（整数哈希 → 值噪声 → fbm；同输入同输出）
// ---------------------------------------------------------------------------

/** 2D 整数哈希 → [0,1)。 */
function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** 平滑值噪声（双线性 + smoothstep 插值）。 */
function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const v00 = hash2(x0, y0, seed);
  const v10 = hash2(x0 + 1, y0, seed);
  const v01 = hash2(x0, y0 + 1, seed);
  const v11 = hash2(x0 + 1, y0 + 1, seed);
  const top = v00 + (v10 - v00) * sx;
  const bottom = v01 + (v11 - v01) * sx;
  return top + (bottom - top) * sy;
}

/** 双倍频 fbm（两 octave 足够表面结构用，性能优先）。 */
function fbm2(x: number, y: number, seed: number): number {
  const a = valueNoise(x, y, seed);
  const b = valueNoise(x * 2 + 31.4, y * 2 + 17.7, seed ^ 0x5bd1);
  return a * 0.68 + b * 0.32;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0 || 1e-6));
  return t * t * (3 - 2 * t);
}

/** 预设固定种子（保证六预设的确定性噪声互不相干）。 */
const PRESET_SEED: Readonly<Record<FinishPresetKey, number>> = {
  normal: 101,
  towel: 202,
  glitter: 303,
  sequin: 404,
  waffle: 505,
  loofah: 606,
};

// ---------------------------------------------------------------------------
// 常量（几何口径，格单位）
// ---------------------------------------------------------------------------

/** 豆半径（格）。 */
const BEAD_RADIUS = 0.47;
/** 中心孔半径（格）。 */
const HOLE_RADIUS = 0.13;
/** 十字缝半宽（格）。 */
const SEAM_HALF_WIDTH = 0.05;
/** 豆间缝隙暗度（0–1，越大缝越暗）。 */
const GAP_DARK = 0.45;
/** 中孔暗度。 */
const HOLE_DARK = 0.28;
/** 十字缝暗度。 */
const SEAM_DARK = 0.12;

/** 光源方向（固定左上，已归一）。 */
const LIGHT_DIR: Readonly<{ x: number; y: number; z: number }> = { x: -0.4363, y: -0.5236, z: 0.7326 };
/** 平面法线的漫反射基线（shade 恒等化的减数）。 */
const FLAT_DIFFUSE = LIGHT_DIR.z;

// ---------------------------------------------------------------------------
// 阶段 1：熔融基底
// ---------------------------------------------------------------------------

/** 熔融基底输出：线性工作色（0–255）+ 豆占位遮罩。 */
export interface MeltBaseOutput {
  rgb: Float32Array;
  alpha: Uint8Array;
}

/**
 * 熔融基底：豆格色块 + 隐约十字缝 + 中孔浅痕 + 轻微熔融模糊（盒滤）。
 * 结构性暗化（缝/孔/缘）与模糊幅度均随 k 插值，k=0 时输出纯色板色。
 */
export function meltBase(
  cells: Int16Array | readonly number[],
  w: number,
  h: number,
  palette: FinishPaletteData,
  s: number,
  k: number,
): MeltBaseOutput {
  const W = w * s;
  const H = h * s;
  const rgb = new Float32Array(W * H * 3);
  const alpha = new Uint8Array(W * H);
  const colorCount = palette.rgbs.length / 3;

  for (let cy = 0; cy < h; cy++) {
    for (let cx = 0; cx < w; cx++) {
      const value = cells[cy * w + cx];
      if (value < 0 || value >= colorCount) continue;
      const r0 = palette.rgbs[value * 3];
      const g0 = palette.rgbs[value * 3 + 1];
      const b0 = palette.rgbs[value * 3 + 2];
      const px0 = cx * s;
      const py0 = cy * s;
      for (let py = 0; py < s; py++) {
        const y = py0 + py;
        const v = (py + 0.5) / s - 0.5;
        for (let px = 0; px < s; px++) {
          const x = px0 + px;
          const u = (px + 0.5) / s - 0.5;
          const d = Math.sqrt(u * u + v * v);

          // 结构暗化因子（k=0 全部为 1 → 纯色）
          let f = 1;
          // 豆缘 → 豆间缝隙
          const edge = smoothstep(BEAD_RADIUS - 0.07, BEAD_RADIUS + 0.02, d);
          f *= 1 - GAP_DARK * k * edge;
          // 隐约十字缝（沿格中心十字线的浅压痕）
          const au = Math.abs(u);
          const av = Math.abs(v);
          const seam = d < BEAD_RADIUS ? Math.max(1 - smoothstep(0, SEAM_HALF_WIDTH, au), 1 - smoothstep(0, SEAM_HALF_WIDTH, av)) : 0;
          f *= 1 - SEAM_DARK * k * seam;
          // 中孔浅痕
          const hole = 1 - smoothstep(HOLE_RADIUS, HOLE_RADIUS + 0.05, d);
          f *= 1 - HOLE_DARK * k * hole;

          const o = (y * W + x) * 3;
          rgb[o] = r0 * f;
          rgb[o + 1] = g0 * f;
          rgb[o + 2] = b0 * f;
          alpha[y * W + x] = 255;
        }
      }
    }
  }

  // 轻微熔融模糊：3×3 盒滤（只在豆占位内混合，k=0 跳过）
  if (k > 0.02) {
    const amount = 0.45 * k;
    const blurred = new Float32Array(rgb.length);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (alpha[i] === 0) continue;
        let sr = 0;
        let sg = 0;
        let sb = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= H) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= W) continue;
            const j = yy * W + xx;
            if (alpha[j] === 0) continue;
            sr += rgb[j * 3];
            sg += rgb[j * 3 + 1];
            sb += rgb[j * 3 + 2];
            n++;
          }
        }
        if (n === 0) continue;
        const o = i * 3;
        blurred[o] = rgb[o] + (sr / n - rgb[o]) * amount;
        blurred[o + 1] = rgb[o + 1] + (sg / n - rgb[o + 1]) * amount;
        blurred[o + 2] = rgb[o + 2] + (sb / n - rgb[o + 2]) * amount;
      }
    }
    return { rgb: blurred, alpha };
  }
  return { rgb, alpha };
}

// ---------------------------------------------------------------------------
// 烫法离散结构（星芒位点 / 亮片阵列；确定性生成）
// ---------------------------------------------------------------------------

/** 大颗星芒位点。 */
interface SparkleSite {
  x: number;
  y: number;
  /** 十字臂长（px）。 */
  len: number;
  amp: number;
  /** 虹彩相位（0–2π）。 */
  hue: number;
}

/** 亮片圆盘。 */
interface SequinDisc {
  cx: number;
  cy: number;
  /** 半径（px）。 */
  r: number;
  /** 倾斜方向（单位向量）。 */
  tx: number;
  ty: number;
  hue: number;
}

/** 预设离散结构集合（discIndex 为格 → discs 下标的映射，-1 = 无片）。 */
export interface PresetStructures {
  sparkles: SparkleSite[];
  discs: SequinDisc[];
  discIndex: Int32Array;
}

/** 三相余弦虹彩（hue → rgb 增益三元组）。 */
function iridescent(hue: number): [number, number, number] {
  return [0.82 + 0.5 * Math.cos(hue), 0.82 + 0.5 * Math.cos(hue - 2.094), 0.82 + 0.5 * Math.cos(hue - 4.188)];
}

/**
 * 生成预设离散结构（星芒 / 亮片）。只落在有色豆上（以 alpha 掩码过滤）。
 */
function buildStructures(
  preset: FinishPresetKey,
  cells: Int16Array | readonly number[],
  w: number,
  h: number,
  s: number,
  alpha: Uint8Array,
  W: number,
): PresetStructures {
  const params = PRESET_PARAMS[preset].surface;
  const seed = PRESET_SEED[preset];
  const sparkles: SparkleSite[] = [];
  const discs: SequinDisc[] = [];
  const discIndex = new Int32Array(w * h).fill(-1);

  for (let cy = 0; cy < h; cy++) {
    for (let cx = 0; cx < w; cx++) {
      const value = cells[cy * w + cx];
      if (value < 0) continue;
      const r1 = hash2(cx, cy, seed);
      const r2 = hash2(cx, cy, seed ^ 0x1f2e);
      const r3 = hash2(cx, cy, seed ^ 0x3d4c);

      if (preset === 'glitter' && r1 < params.starDensity) {
        const px = (cx + 0.2 + r2 * 0.6) * s;
        const py = (cy + 0.2 + r3 * 0.6) * s;
        const ix = Math.min(W - 1, Math.max(0, Math.round(px)));
        const iy = Math.min(Math.round(py), (h * s) - 1);
        if (alpha[iy * W + ix] === 0) continue;
        sparkles.push({
          x: px,
          y: py,
          len: s * (0.55 + r2 * 0.5),
          amp: params.starAmp * (0.6 + r3 * 0.4),
          hue: r1 * 6.2832,
        });
      }
      if (preset === 'sequin') {
        const px = (cx + 0.5 + (r1 - 0.5) * 0.12) * s;
        const py = (cy + 0.5 + (r2 - 0.5) * 0.12) * s;
        const theta = r3 * 6.2832;
        discIndex[cy * w + cx] = discs.length;
        discs.push({
          cx: px,
          cy: py,
          r: params.sequinRadius * s,
          tx: Math.cos(theta),
          ty: Math.sin(theta),
          hue: hash2(cx, cy, seed ^ 0x7a11) * 6.2832,
        });
      }
    }
  }
  return { sparkles, discs, discIndex };
}

// ---------------------------------------------------------------------------
// 阶段 2：高度场
// ---------------------------------------------------------------------------

/**
 * 高度场：豆圆顶（每格径向凸起）+ 烫法专属表面结构（绒毛/星芒/亮片/格纹/网眼）。
 * 幅度统一乘 k；坐标用格单位保证分辨率无关。
 */
export function heightField(
  preset: FinishPresetKey,
  cells: Int16Array | readonly number[],
  w: number,
  h: number,
  s: number,
  k: number,
  alpha: Uint8Array,
  structures: PresetStructures,
): Float32Array {
  const W = w * s;
  const H = h * s;
  const p = PRESET_PARAMS[preset].surface;
  const seed = PRESET_SEED[preset];
  const height = new Float32Array(W * H);
  const domeAmp = p.domeAmp * k;

  for (let cy = 0; cy < h; cy++) {
    for (let cx = 0; cx < w; cx++) {
      if (cells[cy * w + cx] < 0) continue;
      const px0 = cx * s;
      const py0 = cy * s;
      for (let py = 0; py < s; py++) {
        const y = py0 + py;
        const gy = cy + (py + 0.5) / s;
        const row = y * W;
        for (let px = 0; px < s; px++) {
          const x = px0 + px;
          if (alpha[row + x] === 0) continue;
          const gx = cx + (px + 0.5) / s;
          const u = gx - cx - 0.5;
          const v = gy - cy - 0.5;
          const d = Math.sqrt(u * u + v * v);

          // 豆圆顶（半球）
          let z = domeAmp * Math.sqrt(Math.max(0, 1 - (d / BEAD_RADIUS) ** 2));

          // 通用细颗粒
          if (p.grainAmp > 0) {
            z += (fbm2(gx * p.grainFreq, gy * p.grainFreq, seed) - 0.5) * p.grainAmp * k * 2;
          }

          // 预设专属结构
          switch (preset) {
            case 'towel': {
              // 三层绒毛：低频簇 + 纤维束 + 单丝
              z =
                domeAmp * 0.55 +
                (fbm2(gx * p.fuzzClumpFreq, gy * p.fuzzClumpFreq, seed ^ 0x11) - 0.5) * p.fuzzClumpAmp * 2 * k +
                (fbm2(gx * p.fuzzFiberFreq, gy * p.fuzzFiberFreq, seed ^ 0x22) - 0.5) * p.fuzzFiberAmp * 2 * k +
                hash2(x, y, seed ^ 0x33) * p.fuzzFilamentAmp * k;
              break;
            }
            case 'waffle': {
              // 方格凹槽：格边凹、格心平台（坑壁迎光由法线自然产生）
              const e = Math.min(0.5 - Math.abs(u), 0.5 - Math.abs(v));
              const t = 1 - smoothstep(p.grooveWidth * 0.35, p.grooveWidth, e);
              z = p.domeAmp * k * 0.9 - p.grooveDepth * k * t;
              break;
            }
            case 'loofah': {
              // 不规则网眼（fbm 阈值成网丝）+ 经纬微纹理
              const n = fbm2(gx * p.meshFreq, gy * p.meshFreq, seed ^ 0x44);
              const strand = smoothstep(p.meshThreshold - 0.06, p.meshThreshold + 0.06, n);
              const weave = valueNoise(gx * 7, gy * 2.2, seed ^ 0x55) * 0.5 + valueNoise(gx * 2.2, gy * 7, seed ^ 0x66) * 0.5;
              z = p.domeAmp * k * 0.5 + strand * p.meshStrandAmp * k + (weave - 0.5) * p.meshMicroAmp * 2 * k;
              break;
            }
            case 'sequin': {
              // 亮片阵列：每格一片，片内按倾斜方向线性起伏，片外为低谷
              const discIdx = structures.discIndex[cy * w + cx];
              const disc = discIdx >= 0 ? structures.discs[discIdx] : undefined;
              if (disc) {
                const dx = x - disc.cx;
                const dy = y - disc.cy;
                const dd = Math.sqrt(dx * dx + dy * dy);
                const mask = 1 - smoothstep(disc.r - 1.5, disc.r, dd);
                const tilt = ((dx * disc.tx + dy * disc.ty) / s) * p.sequinTiltAmp * k;
                z = p.domeAmp * k * 0.4 + tilt * mask + 0.06 * k * mask;
              } else {
                z = p.domeAmp * k * 0.15;
              }
              break;
            }
            default:
              break;
          }
          height[row + x] = z;
        }
      }
    }
  }

  // 格利特：星芒位点处加凸起（糖霜颗）
  if (preset === 'glitter' && p.starDensity > 0) {
    for (const site of structures.sparkles) {
      const r = Math.max(1, site.len * 0.28);
      const x0 = Math.max(0, Math.floor(site.x - r));
      const x1 = Math.min(W - 1, Math.ceil(site.x + r));
      const y0 = Math.max(0, Math.floor(site.y - r));
      const y1 = Math.min(H - 1, Math.ceil(site.y + r));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = y * W + x;
          if (alpha[i] === 0) continue;
          const dx = x - site.x;
          const dy = y - site.y;
          const g = Math.exp(-(dx * dx + dy * dy) / (r * r * 0.5));
          height[i] += g * 0.22 * k * site.amp;
        }
      }
    }
  }
  return height;
}

// ---------------------------------------------------------------------------
// 阶段 3：法线
// ---------------------------------------------------------------------------

/** 法线场。 */
export interface NormalField {
  nx: Float32Array;
  ny: Float32Array;
  nz: Float32Array;
}

/** 中心差分求法线；slope 随分辨率（pxPerCell）补偿，保证视觉尺度一致。 */
export function normalFromHeight(height: Float32Array, W: number, H: number, slope: number): NormalField {
  const nx = new Float32Array(W * H);
  const ny = new Float32Array(W * H);
  const nz = new Float32Array(W * H);
  const gain = slope;
  for (let y = 0; y < H; y++) {
    const yUp = y > 0 ? y - 1 : y;
    const yDown = y < H - 1 ? y + 1 : y;
    for (let x = 0; x < W; x++) {
      const xLeft = x > 0 ? x - 1 : x;
      const xRight = x < W - 1 ? x + 1 : x;
      const i = y * W + x;
      let dx = (height[y * W + xLeft] - height[y * W + xRight]) * gain;
      let dy = (height[yUp * W + x] - height[yDown * W + x]) * gain;
      // 哈希型逐像素噪声（毛巾单丝）会产生碎法线，限制单步坡度防爆点
      const m = Math.abs(dx) + Math.abs(dy);
      if (m > 2.5) {
        const c = 2.5 / m;
        dx *= c;
        dy *= c;
      }
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      nx[i] = dx * inv;
      ny[i] = dy * inv;
      nz[i] = inv;
    }
  }
  return { nx, ny, nz };
}

// ---------------------------------------------------------------------------
// 阶段 4：光照
// ---------------------------------------------------------------------------

/**
 * 漫反射 + Blinn-Phong 高光（光源固定左上）。平面（法线朝屏幕外）恒等：
 * shade = 1 + diffuse×k×(dot − Lz)，spec 以平面基线扣除，平坦处零高光。
 * 原地写回 rgb（乘 shade、加白色高光）。
 */
export function lightingStage(
  base: MeltBaseOutput,
  normals: NormalField,
  W: number,
  H: number,
  params: LightParams,
  k: number,
): Float32Array {
  const rgb = new Float32Array(base.rgb);
  const shininess = 8 + (1 - params.roughness) * 112;
  const hx = LIGHT_DIR.x;
  const hy = LIGHT_DIR.y;
  const hz = LIGHT_DIR.z + 1;
  const hLen = Math.sqrt(hx * hx + hy * hy + hz * hz);
  const hzx = hx / hLen;
  const hzy = hy / hLen;
  const hzz = hz / hLen;
  const flatSpecBase = hzz ** shininess;
  const diffuseK = params.diffuse * k;
  const specK = params.specStrength * k;

  for (let i = 0; i < W * H; i++) {
    if (base.alpha[i] === 0) continue;
    const dot = normals.nx[i] * LIGHT_DIR.x + normals.ny[i] * LIGHT_DIR.y + normals.nz[i] * LIGHT_DIR.z;
    const shade = 1 + diffuseK * (dot - FLAT_DIFFUSE);
    const dotH = normals.nx[i] * hzx + normals.ny[i] * hzy + normals.nz[i] * hzz;
    const sp = Math.max(0, Math.max(dotH, 0) ** shininess - flatSpecBase) * specK;
    const o = i * 3;
    const sh = shade < 0 ? 0 : shade;
    rgb[o] = rgb[o] * sh + sp * 235;
    rgb[o + 1] = rgb[o + 1] * sh + sp * 238;
    rgb[o + 2] = rgb[o + 2] * sh + sp * 245;
  }
  return rgb;
}

// ---------------------------------------------------------------------------
// 阶段 5：烫法特效层
// ---------------------------------------------------------------------------

/**
 * 烫法特效层：绒毛白化 / 星芒十字臂 + 虹彩糖霜 / 亮片反光带 + 片缘暗线 /
 * 华夫格坑壁阴影 / 搓澡巾网眼阴影。原地在 rgb 上叠加。
 */
export function presetFxStage(
  preset: FinishPresetKey,
  rgb: Float32Array,
  base: MeltBaseOutput,
  normals: NormalField,
  cells: Int16Array | readonly number[],
  w: number,
  h: number,
  s: number,
  k: number,
  palette: FinishPaletteData,
  structures: PresetStructures,
): void {
  const W = w * s;
  const H = h * s;
  const p = PRESET_PARAMS[preset].surface;
  const seed = PRESET_SEED[preset];

  switch (preset) {
    case 'towel': {
      // 绒毛白化光泽：单丝噪声高值处提亮（深色豆更明显）
      const colorCount = palette.rgbs.length / 3;
      for (let cy = 0; cy < h; cy++) {
        for (let cx = 0; cx < w; cx++) {
          const value = cells[cy * w + cx];
          const lum = value >= 0 && value < colorCount ? palette.lum[value] : 128;
          const boost = p.fuzzSheen * k * (0.45 + (255 - lum) / 340);
          if (boost <= 0) continue;
          for (let py = 0; py < s; py++) {
            const y = cy * s + py;
            for (let px = 0; px < s; px++) {
              const x = cx * s + px;
              const i = y * W + x;
              if (base.alpha[i] === 0) continue;
              const f = hash2(x, y, seed ^ 0x33);
              const sheen = f * f * f * boost * 255;
              rgb[i * 3] += sheen;
              rgb[i * 3 + 1] += sheen * 0.98;
              rgb[i * 3 + 2] += sheen * 0.9;
            }
          }
        }
      }
      break;
    }
    case 'glitter': {
      // 大颗星芒：十字臂 + 核心，虹彩三相色
      for (const site of structures.sparkles) {
        const [tr, tg, tb] = iridescent(site.hue);
        const armW = Math.max(0.8, site.len * 0.14);
        const coreR = Math.max(0.8, site.len * 0.2);
        const x0 = Math.max(0, Math.floor(site.x - site.len));
        const x1 = Math.min(W - 1, Math.ceil(site.x + site.len));
        const y0 = Math.max(0, Math.floor(site.y - site.len));
        const y1 = Math.min(H - 1, Math.ceil(site.y + site.len));
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const i = y * W + x;
            if (base.alpha[i] === 0) continue;
            const dx = x - site.x;
            const dy = y - site.y;
            const armX = Math.exp(-((dy * dy) / (armW * armW))) * Math.exp(-((dx * dx) / (site.len * site.len)));
            const armY = Math.exp(-((dx * dx) / (armW * armW))) * Math.exp(-((dy * dy) / (site.len * site.len)));
            const core = Math.exp(-((dx * dx + dy * dy) / (coreR * coreR)));
            const g = (Math.max(armX, armY) + core * 1.2) * site.amp * k;
            if (g <= 0.002) continue;
            rgb[i * 3] += g * tr * 255;
            rgb[i * 3 + 1] += g * tg * 255;
            rgb[i * 3 + 2] += g * tb * 255;
          }
        }
      }
      // 细闪糖霜：逐像素稀疏亮点 + 轻微虹彩
      for (let i = 0; i < W * H; i++) {
        if (base.alpha[i] === 0) continue;
        const x = i % W;
        const y = (i / W) | 0;
        const r = hash2(x, y, seed ^ 0x77);
        if (r >= p.frostDensity) continue;
        const strength = (1 - r / p.frostDensity) ** 1.6 * p.frostAmp * k;
        const [tr, tg, tb] = iridescent(r * 41.3);
        rgb[i * 3] += strength * tr * 255;
        rgb[i * 3 + 1] += strength * tg * 255;
        rgb[i * 3 + 2] += strength * tb * 255;
      }
      break;
    }
    case 'sequin': {
      // 斜向反光带（跨整图的周期亮带）+ 片缘暗线 + 虹彩偏色
      const period = s * 2.4;
      for (let cy = 0; cy < h; cy++) {
        for (let cx = 0; cx < w; cx++) {
          const discIdx = structures.discIndex[cy * w + cx];
          const disc = discIdx >= 0 ? structures.discs[discIdx] : undefined;
          if (!disc) continue;
          const [tr, tg, tb] = iridescent(disc.hue);
          const x0 = Math.max(0, Math.floor(disc.cx - disc.r - 1));
          const x1 = Math.min(W - 1, Math.ceil(disc.cx + disc.r + 1));
          const y0 = Math.max(0, Math.floor(disc.cy - disc.r - 1));
          const y1 = Math.min(H - 1, Math.ceil(disc.cy + disc.r + 1));
          for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
              const i = y * W + x;
              if (base.alpha[i] === 0) continue;
              const dx = x - disc.cx;
              const dy = y - disc.cy;
              const dd = Math.sqrt(dx * dx + dy * dy);
              const mask = 1 - smoothstep(disc.r - 1.2, disc.r, dd);
              if (mask <= 0) continue;
              // 片缘暗线
              const ring = smoothstep(disc.r - 1.6, disc.r - 0.4, dd);
              const dark = 1 - p.sequinRingDark * k * ring;
              // 斜向反光带
              const phase = (((x + y) % period) + period) % period / period;
              const band = smoothstep(0.3, 0.5, phase) * smoothstep(0.7, 0.5, phase);
              const o = i * 3;
              rgb[o] = rgb[o] * dark + band * p.sequinBandAmp * k * tr * 190;
              rgb[o + 1] = rgb[o + 1] * dark + band * p.sequinBandAmp * k * tg * 190;
              rgb[o + 2] = rgb[o + 2] * dark + band * p.sequinBandAmp * k * tb * 190;
            }
          }
        }
      }
      break;
    }
    case 'waffle': {
      // 坑壁变暗：格纹压痕的阴影侧收暗，迎光侧由光照层提亮
      applyConcaveAo(rgb, base, normals, W, H, k, 0.22, 0.62);
      break;
    }
    case 'loofah': {
      // 网眼阴影：网丝侧翼收暗，做旧感
      applyConcaveAo(rgb, base, normals, W, H, k, 0.3, 0.55);
      break;
    }
    default:
      break;
  }
}

/** 陡峭处变暗（法线 z 分量近似环境光遮蔽：坑壁 / 网眼侧翼收暗，做旧与压痕感）。 */
function applyConcaveAo(
  rgb: Float32Array,
  base: MeltBaseOutput,
  normals: NormalField,
  W: number,
  H: number,
  k: number,
  strength: number,
  nzFloor: number,
): void {
  for (let i = 0; i < W * H; i++) {
    if (base.alpha[i] === 0) continue;
    // nz≈1 平坦；越陡（坑壁/网丝侧翼）nz 越低 → 越暗
    const steep = 1 - smoothstep(nzFloor, 0.97, normals.nz[i]);
    const ao = 1 - strength * k * steep;
    const o = i * 3;
    rgb[o] *= ao;
    rgb[o + 1] *= ao;
    rgb[o + 2] *= ao;
  }
}

// ---------------------------------------------------------------------------
// 阶段 6：色调映射
// ---------------------------------------------------------------------------

/**
 * 色调映射：饱和 / 明度 / 暖偏 / 对比按 intensity 同系数插值后输出 RGBA。
 * k=0 时全部恒等。
 */
export function tonemapStage(
  rgb: Float32Array,
  alpha: Uint8Array,
  W: number,
  H: number,
  tone: ToneParams,
  k: number,
): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(W * H * 4);
  const sat = 1 + (tone.saturation - 1) * k;
  const bright = tone.brightness * k;
  const warm = tone.warmth * k * 0.3;
  const contrast = 1 + (tone.contrast - 1) * k;
  for (let i = 0; i < W * H; i++) {
    const o4 = i * 4;
    if (alpha[i] === 0) {
      rgba[o4 + 3] = 0;
      continue;
    }
    const o3 = i * 3;
    let r = rgb[o3];
    let g = rgb[o3 + 1];
    let b = rgb[o3 + 2];
    // 饱和
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    r = l + (r - l) * sat;
    g = l + (g - l) * sat;
    b = l + (b - l) * sat;
    // 明度 / 暖偏 / 对比
    r = r + bright + warm;
    g = g + bright;
    b = b + bright - warm;
    r = 128 + (r - 128) * contrast;
    g = 128 + (g - 128) * contrast;
    b = 128 + (b - 128) * contrast;
    rgba[o4] = r;
    rgba[o4 + 1] = g;
    rgba[o4 + 2] = b;
    rgba[o4 + 3] = 255;
  }
  return rgba;
}

// ---------------------------------------------------------------------------
// 顶层编排
// ---------------------------------------------------------------------------

/**
 * 执行完整烫染渲染管线。
 *
 * @param input 渲染输入（cells 只读；intensity 0–100；pxPerCell 默认 8）
 * @returns RGBA 像素 + 尺寸
 * @throws w/h 与 cells 长度不符或色板数据非法时抛出
 */
export function renderFinish(input: FinishInput): FinishOutput {
  const { w, h, paletteData } = input;
  if (!Number.isInteger(w) || !Number.isInteger(h) || w <= 0 || h <= 0) throw new Error(`非法网格尺寸 ${w}×${h}`);
  if (input.cells.length < w * h) throw new Error(`cells 长度 ${input.cells.length} 小于 ${w}×${h}`);
  if (paletteData.rgbs.length % 3 !== 0) throw new Error('paletteData.rgbs 必须为 RGB 三元组平铺');
  const s = Math.min(24, Math.max(1, Math.round(input.pxPerCell ?? 8)));
  const k = Math.min(1, Math.max(0, input.intensity / 100));
  const preset = toPresetKey(input.preset);
  const params = PRESET_PARAMS[preset];
  const W = w * s;
  const H = h * s;

  // 1. 熔融基底
  const base = meltBase(input.cells, w, h, paletteData, s, k);
  // 2. 离散结构 + 高度场
  const structures = buildStructures(preset, input.cells, w, h, s, base.alpha, W);
  const height = heightField(preset, input.cells, w, h, s, k, base.alpha, structures);
  // 3. 法线（slope 随 pxPerCell 补偿）
  const normals = normalFromHeight(height, W, H, params.light.normalStrength * s * 0.35);
  // 4. 光照
  const rgb = lightingStage(base, normals, W, H, params.light, k);
  // 5. 烫法特效
  presetFxStage(preset, rgb, base, normals, input.cells, w, h, s, k, paletteData, structures);
  // 6. 色调映射
  const rgba = tonemapStage(rgb, base.alpha, W, H, params.tone, k);
  return { rgba, w: W, h: H };
}
