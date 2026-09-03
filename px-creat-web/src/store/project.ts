import { create } from 'zustand';
import {
  PROJECT_STORAGE_KEY,
  loadProject,
  saveProject,
  type RefImageStore,
  type StorageLike,
} from '@/lib/storage';
import {
  applyDiff as applyCellDiff,
  revertDiff,
  type CellDiff,
} from '@/lib/cellOps';
import {
  DEFAULT_FINISH,
  PROJECT_SCHEMA_VERSION,
  type BrandKey,
  type FinishSetting,
  type Project,
} from '@/lib/types';
import { useEditorStore } from './editor';

/**
 * 工程 store（design.md §3）：cells（Int16Array，-1 空格）+ 元数据。
 * 一切 cells 变更必须走本 store 的 action（保证 undo 记录与脏区信息）。
 *
 * 撤销栈数据在 editor store（单向依赖 project → editor），
 * undo/redo 的执行（回写 cells、还原品牌）由本 store 完成。
 *
 * `spec`（5mm/2.6mm）不属于 lib §4.8 schema，作为扩展字段随工程 JSON 一起
 * 持久化（读取端宽松解析，旧存档缺省按品牌推导）。
 */

/** 拼豆规格。 */
export type BeadSpec = '5mm' | '2.6mm';

/** 规格缺省时的品牌推导（旧存档兼容）。 */
export const DEFAULT_SPEC_BY_BRAND: Readonly<Record<BrandKey, BeadSpec>> = {
  mard: '2.6mm',
  coco: '2.6mm',
  perler: '5mm',
  hama: '5mm',
  artkal: '5mm',
};

/** 运行时参考图（dataURL 形态，导出时内嵌工程 JSON）。 */
export interface RefImageState {
  name: string;
  dataUrl: string;
}

/** IndexedDB 中参考图的存储键（与 localStorage 工程槽位一一对应）。 */
export const REF_IMAGE_KEY = 'project:current';

export interface NewProjectOptions {
  title: string;
  brandKey: BrandKey;
  spec: BeadSpec;
  size: number;
}

interface ProjectState {
  loaded: boolean;
  title: string;
  brandKey: BrandKey;
  spec: BeadSpec;
  w: number;
  h: number;
  cells: Int16Array;
  finish: FinishSetting;
  refImage: RefImageState | null;
  /** 每次.cells 变更自增（渲染层订阅触发器）。 */
  cellsVersion: number;
  /** 最近一次变更的格子（渲染层脏区重绘用；语义上只需 indices）。 */
  lastDiff: CellDiff | null;
  hasUnsavedChanges: boolean;
  lastSavedAt: number | null;

  newProject: (opts: NewProjectOptions) => void;
  loadFrom: (project: Project, spec: BeadSpec | null, refImage: RefImageState | null) => void;
  /** 应用一笔 diff（默认记录 undo；批量操作 = 单条记录）。 */
  applyDiff: (diff: CellDiff, label: string, opts?: { brandSwap?: { before: BrandKey; after: BrandKey } }) => void;
  /** 笔画过程中的实时落笔（不记 undo，pointerup 后由 recordStroke 统一入栈）。 */
  paintCells: (indices: readonly number[], values: readonly number[]) => void;
  /** 一笔结束后入栈 undo（cells 已由 paintCells 更新）。 */
  recordStroke: (diff: CellDiff, label: string) => void;
  setTitle: (title: string) => void;
  setRefImage: (ref: RefImageState | null) => void;
  /** 更新烫染设置（渲染层属性：不触碰 cells/cellsVersion，不入撤销栈）。 */
  setFinish: (finish: FinishSetting) => void;
  undo: () => void;
  redo: () => void;
  toProject: () => Project;
  /** 落盘（localStorage 工程 + IndexedDB 参考图），返回保存时间戳。 */
  persistNow: (storage: StorageLike, refStore?: RefImageStore) => Promise<number>;
}

const initialProject = {
  loaded: false,
  title: '',
  brandKey: 'mard' as BrandKey,
  spec: '5mm' as BeadSpec,
  w: 0,
  h: 0,
  cells: new Int16Array(0),
  finish: DEFAULT_FINISH,
  refImage: null as RefImageState | null,
  cellsVersion: 0,
  lastDiff: null as CellDiff | null,
  hasUnsavedChanges: false,
  lastSavedAt: null as number | null,
};

export const useProjectStore = create<ProjectState>()((set, get) => ({
  ...initialProject,

  newProject: (opts) => {
    set({
      loaded: true,
      title: opts.title,
      brandKey: opts.brandKey,
      spec: opts.spec,
      w: opts.size,
      h: opts.size,
      cells: new Int16Array(opts.size * opts.size).fill(-1),
      finish: DEFAULT_FINISH,
      refImage: null,
      cellsVersion: get().cellsVersion + 1,
      lastDiff: null,
      hasUnsavedChanges: true,
      lastSavedAt: null,
    });
    useEditorStore.getState().clearHistory();
    useEditorStore.getState().setReviewColors([]);
    useEditorStore.getState().setHighlight(null);
  },

  loadFrom: (project, spec, refImage) => {
    const cells = new Int16Array(project.w * project.h);
    for (let i = 0; i < cells.length; i++) cells[i] = project.cells[i] ?? -1;
    set({
      loaded: true,
      title: project.title,
      brandKey: project.brandKey,
      spec: spec ?? DEFAULT_SPEC_BY_BRAND[project.brandKey],
      w: project.w,
      h: project.h,
      cells,
      finish: project.finish ?? DEFAULT_FINISH,
      refImage,
      cellsVersion: get().cellsVersion + 1,
      lastDiff: null,
      hasUnsavedChanges: false,
      lastSavedAt: Date.now(),
    });
    useEditorStore.getState().clearHistory();
    useEditorStore.getState().setReviewColors([]);
    useEditorStore.getState().setHighlight(null);
  },

  applyDiff: (diff, label, opts) => {
    set((state) => ({
      cells: applyCellDiff(state.cells, diff),
      cellsVersion: state.cellsVersion + 1,
      lastDiff: diff,
      hasUnsavedChanges: true,
    }));
    if (opts?.brandSwap) set({ brandKey: opts.brandSwap.after });
    useEditorStore.getState().pushUndo({ label, diff, ...(opts?.brandSwap ? { brandSwap: opts.brandSwap } : {}) });
  },

  paintCells: (indices, values) => {
    set((state) => {
      const cells = new Int16Array(state.cells);
      const before = new Int16Array(indices.length);
      const after = new Int16Array(indices.length);
      let changed = 0;
      for (let i = 0; i < indices.length; i++) {
        const idx = indices[i];
        if (idx < 0 || idx >= cells.length) continue;
        before[changed] = cells[idx];
        after[changed] = values[i];
        cells[idx] = values[i];
        changed++;
      }
      if (changed === 0) return state;
      return {
        cells,
        cellsVersion: state.cellsVersion + 1,
        lastDiff: { indices: indices.slice(0, changed), before: before.slice(0, changed), after: after.slice(0, changed) },
        hasUnsavedChanges: true,
      };
    });
  },

  recordStroke: (diff, label) => {
    useEditorStore.getState().pushUndo({ label, diff });
  },

  setTitle: (title) => set({ title, hasUnsavedChanges: true }),
  setRefImage: (refImage) => set({ refImage, hasUnsavedChanges: true }),
  setFinish: (finish) =>
    set({
      finish: {
        preset: finish.preset,
        intensity: Math.min(100, Math.max(0, Math.round(finish.intensity))),
      },
      hasUnsavedChanges: true,
    }),

  undo: () => {
    const editor = useEditorStore.getState();
    const entry = editor.undoStack[editor.undoStack.length - 1];
    if (!entry) return;
    useEditorStore.setState((s) => ({
      undoStack: s.undoStack.slice(0, -1),
      redoStack: [...s.redoStack, entry],
    }));
    set((state) => ({
      cells: revertDiff(state.cells, entry.diff),
      cellsVersion: state.cellsVersion + 1,
      lastDiff: entry.diff,
      hasUnsavedChanges: true,
      ...(entry.brandSwap ? { brandKey: entry.brandSwap.before } : {}),
    }));
    if (entry.brandSwap) useEditorStore.getState().setReviewColors([]);
  },

  redo: () => {
    const editor = useEditorStore.getState();
    const entry = editor.redoStack[editor.redoStack.length - 1];
    if (!entry) return;
    useEditorStore.setState((s) => ({
      redoStack: s.redoStack.slice(0, -1),
      undoStack: [...s.undoStack, entry],
    }));
    set((state) => ({
      cells: applyCellDiff(state.cells, entry.diff),
      cellsVersion: state.cellsVersion + 1,
      lastDiff: entry.diff,
      hasUnsavedChanges: true,
      ...(entry.brandSwap ? { brandKey: entry.brandSwap.after } : {}),
    }));
    if (entry.brandSwap) useEditorStore.getState().setReviewColors([]);
  },

  toProject: () => {
    const state = get();
    return {
      v: PROJECT_SCHEMA_VERSION,
      title: state.title,
      brandKey: state.brandKey,
      w: state.w,
      h: state.h,
      cells: Array.from(state.cells),
      finish: state.finish,
    };
  },

  persistNow: async (storage, refStore) => {
    const state = get();
    // spec 为扩展字段：随 JSON 一并写入（normalize 宽松解析不会剔除未知键）
    saveProject(storage, { ...state.toProject(), spec: state.spec } as Project);
    if (refStore && state.refImage) {
      try {
        const blob = await blobFromDataUrl(state.refImage.dataUrl);
        await refStore.put(REF_IMAGE_KEY, blob);
      } catch {
        // 参考图持久化失败不阻塞工程保存（恢复时参考层为空）
      }
    }
    const now = Date.now();
    set({ hasUnsavedChanges: false, lastSavedAt: now });
    return now;
  },
}));

/** dataURL → Blob（fetch 对 data: 协议的原生解析）。 */
async function blobFromDataUrl(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

// ---------------------------------------------------------------------------
// 存档读取（localStorage 工程 + 扩展 spec + IndexedDB 参考图）
// ---------------------------------------------------------------------------

/** 恢复结果：工程数据 + 规格 + 参考图 dataURL（无存档时 project 为 null）。 */
export interface PersistedLoad {
  project: Project | null;
  spec: BeadSpec | null;
  refImage: RefImageState | null;
}

/** 从存储恢复（浏览器：localStorage + IndexedDB；测试注入内存实现）。 */
export async function loadPersisted(
  storage: StorageLike,
  refStore?: RefImageStore,
  blobToDataUrl: (blob: Blob) => Promise<string> = blobToDataUrlDefault,
): Promise<PersistedLoad> {
  const raw = storage.getItem(PROJECT_STORAGE_KEY);
  const project = loadProject(storage);
  if (!project || !raw) return { project: null, spec: null, refImage: null };
  let spec: BeadSpec | null = null;
  try {
    const parsed = JSON.parse(raw) as { spec?: string };
    if (parsed.spec === '5mm' || parsed.spec === '2.6mm') spec = parsed.spec;
  } catch {
    spec = null;
  }
  if (spec === null) spec = DEFAULT_SPEC_BY_BRAND[project.brandKey];
  let refImage: RefImageState | null = null;
  if (refStore) {
    try {
      const blob = await refStore.get(REF_IMAGE_KEY);
      if (blob) refImage = { name: '参考图', dataUrl: await blobToDataUrl(blob) };
    } catch {
      refImage = null;
    }
  }
  return { project, spec, refImage };
}

function blobToDataUrlDefault(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('FileReader 失败'));
    reader.readAsDataURL(blob);
  });
}

// ---------------------------------------------------------------------------
// 自动保存调度（30s 周期 + requestIdleCallback 错峰；可注入定时器测试）
// ---------------------------------------------------------------------------

/** 空闲调度句柄（requestIdleCallback 与 setTimeout 的返回形态不同，按不透明 id 处理）。 */
export type IdleTimerId = unknown;

/** 浏览器默认调度：requestIdleCallback 空闲期执行，无支持时退化为 setTimeout(0)。 */
function defaultIdleSchedule(cb: () => void): IdleTimerId {
  if (typeof requestIdleCallback === 'function') return requestIdleCallback(() => cb());
  return window.setTimeout(cb, 0);
}

function defaultIdleCancel(id: IdleTimerId): void {
  if (typeof id !== 'number') return;
  if (typeof cancelIdleCallback === 'function') cancelIdleCallback(id);
  else window.clearTimeout(id);
}

export interface AutoSaveController {
  start: () => void;
  stop: () => void;
  /** 立即保存（脏态时）；用于 beforeunload / 页面隐藏。 */
  flush: () => void;
}

export interface AutoSaveOptions {
  intervalMs?: number;
  shouldSave: () => boolean;
  save: () => void | Promise<void>;
  schedule?: (cb: () => void) => IdleTimerId;
  cancel?: (id: IdleTimerId) => void;
}

/**
 * 创建自动保存控制器：每 intervalMs 一个 tick，tick 在空闲期检查脏态并保存。
 * 调度器可注入（单测用假定时器）。
 */
export function createAutoSaveController(opts: AutoSaveOptions): AutoSaveController {
  const intervalMs = opts.intervalMs ?? 30_000;
  const schedule = opts.schedule ?? defaultIdleSchedule;
  const cancel = opts.cancel ?? defaultIdleCancel;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let idleId: IdleTimerId | null = null;

  const run = (): void => {
    if (!opts.shouldSave()) return;
    void Promise.resolve(opts.save()).catch(() => undefined);
  };

  return {
    start: () => {
      if (intervalId !== null) return;
      intervalId = setInterval(() => {
        if (idleId !== null) cancel(idleId);
        idleId = schedule(run);
      }, intervalMs);
    },
    stop: () => {
      if (intervalId !== null) clearInterval(intervalId);
      if (idleId !== null) cancel(idleId);
      intervalId = null;
      idleId = null;
    },
    flush: () => run(),
  };
}
