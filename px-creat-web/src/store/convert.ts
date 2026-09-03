import { create } from 'zustand';
import {
  DEFAULT_CONVERT_OPTIONS,
  cropImage,
  estimateIsPhotographic,
  validateSource,
  type ConvertFailure,
  type ConvertMode,
  type ConvertSourceType,
  type ConvertSuccess,
  type PixelImage,
  type PixelRect,
} from '@/lib/converter';
import { runConvertInWorker } from '@/lib/converterClient';
import { getAnalytics } from '@/lib/analytics';
import { diffOf } from '@/lib/cellOps';
import type { BrandKey } from '@/lib/types';
import { useProjectStore } from './project';
import { useEditorStore } from './editor';

/**
 * 转换会话 store（design.md §1–§2）：ImportDialog 的状态机宿主。
 * idle → crop → config → converting → done，任意态可回退上一步；
 * 会话数据不入 project store（只有「进编辑器」才落工程）。
 *
 * Worker 执行经 runner 注入（默认 runConvertInWorker，浏览器专用），
 * 单测注入假 runner 即可全流程走查。
 */

// ---------------------------------------------------------------------------
// 步骤 / 类型 / 预设
// ---------------------------------------------------------------------------

export type ConvertStep = 'idle' | 'crop' | 'config' | 'converting' | 'done';

export type SourceType = ConvertSourceType;

export type GenType = 'q' | 'standard' | 'realistic';

/** 生成类型预设（类型是起点不是约束，全部参数可被覆盖）。 */
export interface GenTypePreset {
  key: GenType;
  label: string;
  tagline: string;
  minSize: number;
  maxSize: number;
  defaultSize: number;
  defaultTargetColors: number;
  mode: ConvertMode;
}

export const GEN_TYPE_PRESETS: readonly GenTypePreset[] = [
  {
    key: 'q',
    label: 'Q版',
    tagline: '小尺寸挂件钥匙扣，16 色起手干净利落',
    minSize: 20,
    maxSize: 29,
    defaultSize: 29,
    defaultTargetColors: 16,
    mode: 'cartoon',
  },
  {
    key: 'standard',
    label: '标准',
    tagline: '主流方板尺寸，色数交给素材自己定',
    minSize: 29,
    maxSize: 58,
    defaultSize: 52,
    defaultTargetColors: 0,
    mode: 'cartoon',
  },
  {
    key: 'realistic',
    label: '写真',
    tagline: '大尺寸还原细节，平滑渐变不糊脸',
    minSize: 58,
    maxSize: 104,
    defaultSize: 87,
    defaultTargetColors: 0,
    mode: 'smooth',
  },
];

export const GEN_TYPE_INFO: Readonly<Record<GenType, GenTypePreset>> = {
  q: GEN_TYPE_PRESETS[0],
  standard: GEN_TYPE_PRESETS[1],
  realistic: GEN_TYPE_PRESETS[2],
};

/** 转换参数（UI 全量可调）。 */
export interface ConvertParams {
  genType: GenType;
  /** 目标边长（7–104 正方形；直映模式下忽略）。 */
  targetSize: number;
  /** 目标色数；0 = 不限。 */
  targetColors: number;
  mode: ConvertMode;
  brightness: number;
  contrast: number;
  saturation: number;
  removeBackground: boolean;
  bgTolerance: number;
}

export const DEFAULT_CONVERT_PARAMS: Readonly<ConvertParams> = Object.freeze({
  genType: 'standard',
  targetSize: 52,
  targetColors: 0,
  mode: 'cartoon',
  brightness: 0,
  contrast: 0,
  saturation: 0,
  removeBackground: false,
  bgTolerance: 10,
});

export const TARGET_COLOR_CHIPS: readonly number[] = [0, 24, 48, 72, 96, 120];
export const TARGET_COLOR_MAX = 291;

/** 主体缩放范围（100% = 裁剪框原样；>100% 在裁剪区内推近主体）。 */
export const SUBJECT_SCALE_MIN = 100;
export const SUBJECT_SCALE_MAX = 400;

// ---------------------------------------------------------------------------
// 会话数据
// ---------------------------------------------------------------------------

/** 上传源图（已在 UI 层完成 ≤2048 预压缩与解码）。 */
export interface ConvertSource {
  name: string;
  width: number;
  height: number;
  /** 预压缩后 dataURL（预览与参考层用；无对象 URL 需要回收）。 */
  dataUrl: string;
  pixels: PixelImage;
}

/** Worker 执行器（注入点；默认浏览器 Worker）。 */
export type ConvertRunner = (
  img: PixelImage,
  brandKey: BrandKey,
  targetW: number,
  targetH: number,
  options?: typeof DEFAULT_CONVERT_OPTIONS,
  sourceType?: SourceType,
) => Promise<ConvertSuccess | ConvertFailure>;

interface ConvertState {
  step: ConvertStep;
  source: ConvertSource | null;
  /** 源图体检结果（低分辨率/近纯色等；仅作提示，权威校验在转换管线内）。 */
  sourceValidation: ConvertFailure | null;
  /** 写实照片启发（Q版 + 写实 → 建议写真）。 */
  photoLike: boolean;
  crop: PixelRect;
  subjectScale: number;
  sourceType: SourceType;
  params: ConvertParams;
  /** 裁剪 + 主体缩放后的实际转换输入（进入 config 步时生成）。 */
  work: PixelImage | null;
  /** work 重建计数（CompareView 依赖触发）。 */
  workVersion: number;
  result: ConvertSuccess | null;
  /** result 对应的参数指纹（命中则跳过重复转换）。 */
  lastRunKey: string | null;
  error: ConvertFailure | null;
  /** 转换执行中（含预览）。 */
  busy: boolean;

  open: () => void;
  close: () => void;
  setSource: (source: ConvertSource) => void;
  setCrop: (rect: PixelRect) => void;
  nudgeCrop: (dx: number, dy: number) => void;
  setSubjectScale: (scale: number) => void;
  setSourceType: (type: SourceType) => void;
  applyGenType: (genType: GenType) => void;
  setParams: (patch: Partial<ConvertParams>) => void;
  enterConfig: () => void;
  backToCrop: () => void;
  /** 执行转换（预览与正式转换共用；key 命中直接复用结果）。 */
  runConvert: (runner?: ConvertRunner) => Promise<ConvertSuccess | ConvertFailure | null>;
  /** config → converting → done。 */
  startConvert: (runner?: ConvertRunner) => Promise<void>;
  backToConfig: () => void;
  /** 结果落工程：cells 一条 undo + 原图挂参考层（透写下置）。 */
  adoptResult: (refDataUrl: string) => void;
}

/** 裁剪框最小边（源图像素；小图按 5% 收敛）。 */
function minCropSide(source: ConvertSource): number {
  return Math.max(8, Math.round(Math.min(source.width, source.height) * 0.05));
}

/** 裁剪矩形钳制：图界内、最小边、整数。 */
function clampCrop(source: ConvertSource, rect: PixelRect): PixelRect {
  const min = minCropSide(source);
  const w = Math.round(Math.min(source.width, Math.max(min, rect.w)));
  const h = Math.round(Math.min(source.height, Math.max(min, rect.h)));
  const x = Math.round(Math.min(Math.max(0, rect.x), source.width - w));
  const y = Math.round(Math.min(Math.max(0, rect.y), source.height - h));
  return { x, y, w, h };
}

/** 主体缩放后的有效源矩形：裁剪框按比例中心收缩（scale%）。 */
export function effectiveRect(crop: PixelRect, subjectScale: number): PixelRect {
  const factor = Math.max(1, subjectScale) / 100;
  const w = crop.w / factor;
  const h = crop.h / factor;
  return { x: crop.x + (crop.w - w) / 2, y: crop.y + (crop.h - h) / 2, w, h };
}

/** 预计豆宽（design.md §1：目标宽度档位 × 裁剪框宽占比）。非法输入返回 0。 */
export function estimateBeadWidth(targetSize: number, cropW: number, sourceW: number): number {
  const n = Math.round((targetSize * cropW) / Math.max(1, sourceW));
  if (!Number.isFinite(n)) return 0;
  return Math.max(1, Math.min(104, n));
}

/** 参数指纹（结果缓存命中判定）。 */
function runKeyOf(workVersion: number, sourceType: SourceType, params: ConvertParams): string {
  return JSON.stringify([workVersion, sourceType, params]);
}

/** 默认执行器：无 Worker 运行时（测试/降级环境）返回可判别错误而非崩溃。 */
const defaultRunner: ConvertRunner = (img, brandKey, targetW, targetH, options, sourceType) => {
  if (typeof Worker === 'undefined') {
    return Promise.resolve({
      ok: false,
      code: 'internal_error',
      message: '当前环境不支持转换线程，请更换浏览器',
    });
  }
  return runConvertInWorker(img, brandKey, targetW, targetH, options, sourceType);
};

/** 运行序号（最新者胜：过期运行的结果丢弃，避免慢的旧结果覆盖新参数结果）。 */
let runSeq = 0;
/** 在途运行计数（busy 归零判定）。 */
let activeRuns = 0;

const initialState = {
  step: 'idle' as ConvertStep,
  source: null as ConvertSource | null,
  sourceValidation: null as ConvertFailure | null,
  photoLike: false,
  crop: { x: 0, y: 0, w: 0, h: 0 },
  subjectScale: 100,
  sourceType: 'photo' as SourceType,
  params: { ...DEFAULT_CONVERT_PARAMS },
  work: null as PixelImage | null,
  workVersion: 0,
  result: null as ConvertSuccess | null,
  lastRunKey: null as string | null,
  error: null as ConvertFailure | null,
  busy: false,
};

export const useConvertStore = create<ConvertState>()((set, get) => ({
  ...initialState,

  open: () => set({ ...initialState, params: { ...DEFAULT_CONVERT_PARAMS } }),

  close: () => set({ ...initialState, params: { ...DEFAULT_CONVERT_PARAMS } }),

  setSource: (source) => {
    set({
      ...initialState,
      params: { ...DEFAULT_CONVERT_PARAMS },
      source,
      step: 'crop',
      crop: { x: 0, y: 0, w: source.width, h: source.height },
      // 主线程体检为提示性预检；权威校验仍在转换管线内（错误码驱动提示）
      sourceValidation: validateSource(source.pixels),
      photoLike: estimateIsPhotographic(source.pixels),
    });
  },

  setCrop: (rect) => {
    const source = get().source;
    if (!source) return;
    set({ crop: clampCrop(source, rect) });
  },

  nudgeCrop: (dx, dy) => {
    const { source, crop } = get();
    if (!source) return;
    set({ crop: clampCrop(source, { ...crop, x: crop.x + dx, y: crop.y + dy }) });
  },

  setSubjectScale: (scale) => {
    const value = Math.min(SUBJECT_SCALE_MAX, Math.max(SUBJECT_SCALE_MIN, Math.round(scale)));
    set({ subjectScale: value });
  },

  setSourceType: (type) => {
    // 直映需要网格对齐：主体缩放对像素画/图纸无意义，回中性
    set(type === 'photo' ? { sourceType: type } : { sourceType: type, subjectScale: 100 });
  },

  applyGenType: (genType) => {
    const preset = GEN_TYPE_INFO[genType];
    const params = get().params;
    set({
      params: {
        ...params,
        genType,
        targetSize:
          params.targetSize >= preset.minSize && params.targetSize <= preset.maxSize
            ? params.targetSize
            : preset.defaultSize,
        targetColors: preset.defaultTargetColors,
        mode: preset.mode,
      },
    });
  },

  setParams: (patch) => set((state) => ({ params: { ...state.params, ...patch } })),

  enterConfig: () => {
    const { source, crop, subjectScale, sourceType, workVersion } = get();
    if (!source) return;
    const rect = sourceType === 'photo' ? effectiveRect(crop, subjectScale) : crop;
    set({
      step: 'config',
      work: cropImage(source.pixels, rect),
      workVersion: workVersion + 1,
      result: null,
      lastRunKey: null,
      error: null,
    });
  },

  backToCrop: () => set({ step: 'crop' }),

  runConvert: async (runner = defaultRunner) => {
    const state = get();
    const { work, params, sourceType, workVersion } = state;
    if (!work) return null;
    const key = runKeyOf(workVersion, sourceType, params);
    if (state.lastRunKey === key && state.result) return state.result;

    const myRun = ++runSeq;
    activeRuns += 1;
    set({ busy: true });
    try {
      let result: ConvertSuccess | ConvertFailure;
      try {
        result = await runner(
          work,
          useProjectStore.getState().brandKey,
          params.targetSize,
          params.targetSize,
          {
            ...DEFAULT_CONVERT_OPTIONS,
            mode: params.mode,
            targetColors: params.targetColors,
            background: { remove: params.removeBackground, tolerance: params.bgTolerance },
            adjust: { brightness: params.brightness, contrast: params.contrast, saturation: params.saturation },
          },
          sourceType,
        );
      } catch (err) {
        // Worker 脚本故障/超时会 reject：映射为可展示失败，避免 converting 卡死
        const failure: ConvertFailure = {
          ok: false,
          code: 'internal_error',
          message: err instanceof Error ? err.message : String(err),
        };
        result = failure;
      }
      // 会话已切走（重新裁剪/关闭）或已有更新的运行：丢弃过期结果
      if (get().work !== work || myRun !== runSeq) return null;
      if (result.ok) {
        set({ result, error: null, lastRunKey: key });
      } else {
        set({ error: result, result: null, lastRunKey: null });
      }
      return result;
    } finally {
      activeRuns -= 1;
      if (activeRuns <= 0 && get().work === work) set({ busy: false });
    }
  },

  startConvert: async (runner) => {
    if (get().step !== 'config') return;
    set({ step: 'converting', error: null });
    getAnalytics().record('convert_run', {
      genType: get().params.genType,
      size: get().params.targetSize,
      sourceType: get().sourceType,
    });
    const result = await get().runConvert(runner);
    if (get().step !== 'converting') return; // 期间被取消/回退
    set({ step: result && result.ok ? 'done' : 'config' });
  },

  backToConfig: () => set({ step: 'config' }),

  adoptResult: (refDataUrl) => {
    const { result, source, params, sourceType } = get();
    if (!result || !source) return;
    const project = useProjectStore.getState();
    const brandKey = project.loaded ? project.brandKey : 'mard';
    // 未开工程时按目标尺寸推导规格（52/58 档迷你板 → 2.6mm，其余 5mm）
    const spec = project.loaded ? project.spec : result.w === 52 || result.w === 58 ? '2.6mm' : '5mm';

    const n = result.w * result.h;
    const before = new Int16Array(n).fill(-1);
    const indices = Array.from({ length: n }, (_, i) => i);
    const diff = diffOf(before, indices, Array.from(result.cells));

    // 视图态先复位（resetEditor 会清撤销栈，必须在 loadFrom/applyDiff 之前）
    useEditorStore.getState().resetEditor();
    // 网格尺寸与现工程不一致时整体重建（loadFrom 置空网格），随后一条 undo 落 cells
    useProjectStore.getState().loadFrom(
      {
        v: 1,
        title: source.name.replace(/\.[^.]+$/, '') || `未命名作品（${result.w}×${result.h}）`,
        brandKey,
        w: result.w,
        h: result.h,
        cells: Array.from(before),
      },
      spec,
      null,
    );
    useProjectStore.getState().applyDiff(diff, '导入转图');
    useProjectStore.getState().setRefImage({ name: source.name, dataUrl: refDataUrl });
    useEditorStore.getState().setRefVisible(true);
    getAnalytics().record('import_convert', {
      genType: params.genType,
      size: result.w,
      height: result.h,
      brand: brandKey,
      mode: params.mode,
      removeBackground: params.removeBackground,
      sourceType,
      usedCodes: result.usedCodes,
    });
    get().close();
  },
}));
