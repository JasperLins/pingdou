import { create } from 'zustand';
import type { CellDiff } from '@/lib/cellOps';
import type { BrandKey, EditorTool } from '@/lib/types';

/**
 * 编辑器视图/工具态 store（design.md §3）：
 * 工具、笔刷、视图（缩放/平移）、网格与参考层开关、最近使用色、
 * 颜色高亮、品牌映射复查角标，以及撤销重做 diff 栈（100 步）。
 *
 * 本 store 不 import project store（单向依赖：project → editor），
 * cells 的实际变更与 undo/redo 执行在 project store 中完成。
 */

/** 撤销重做条目：cells diff + 可选的品牌切换元数据（品牌回退随撤销还原）。 */
export interface UndoEntry {
  label: string;
  diff: CellDiff;
  brandSwap?: { before: BrandKey; after: BrandKey };
}

/** 撤销栈深度上限。 */
export const UNDO_LIMIT = 100;

/** 最近使用色上限。 */
export const RECENT_COLORS_LIMIT = 12;

/** 参考层位置：透写（绘制层之下）/ 对照（绘制层之上）。 */
export type RefMode = 'under' | 'above';

/** 视图变换：格边长（CSS px）与网格原点在容器内的偏移（CSS px）。 */
export interface ViewState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export const MIN_SCALE = 2;
export const MAX_SCALE = 64;

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

function pushRecent(recent: number[], index: number): number[] {
  if (index < 0) return recent;
  const next = recent.filter((i) => i !== index);
  next.unshift(index);
  return next.slice(0, RECENT_COLORS_LIMIT);
}

interface EditorState {
  tool: EditorTool;
  colorIndex: number;
  brushSize: number;
  view: ViewState;
  gridVisible: boolean;
  refVisible: boolean;
  refMode: RefMode;
  refOpacity: number;
  recentColors: number[];
  /** 颜色高亮定位（StatsPanel 点击某色）；null = 关闭。 */
  highlightIndex: number | null;
  /** 品牌映射后待复查的色板下标集合（overlay 层渲染角标）。 */
  reviewColors: number[];
  /** 空格按住（平移模式）。 */
  spaceHeld: boolean;
  undoStack: UndoEntry[];
  redoStack: UndoEntry[];

  setTool: (tool: EditorTool) => void;
  setColorIndex: (index: number) => void;
  setBrushSize: (size: number) => void;
  stepBrush: (delta: number) => void;
  setView: (view: Partial<ViewState>) => void;
  zoomAt: (pointerX: number, pointerY: number, factor: number) => void;
  toggleGrid: () => void;
  setRefVisible: (visible: boolean) => void;
  setRefMode: (mode: RefMode) => void;
  setRefOpacity: (opacity: number) => void;
  setHighlight: (index: number | null) => void;
  setReviewColors: (indices: number[]) => void;
  setSpaceHeld: (held: boolean) => void;

  /** 供 project store 记录 undo（清空 redo，截断至 100 步）。 */
  pushUndo: (entry: UndoEntry) => void;
  clearHistory: () => void;
  resetEditor: () => void;
}

const initialEditor = {
  tool: 'brush' as EditorTool,
  colorIndex: 0,
  brushSize: 1,
  view: { scale: 16, offsetX: 0, offsetY: 0 },
  gridVisible: true,
  refVisible: true,
  refMode: 'under' as RefMode,
  refOpacity: 40,
  recentColors: [] as number[],
  highlightIndex: null as number | null,
  reviewColors: [] as number[],
  spaceHeld: false,
  undoStack: [] as UndoEntry[],
  redoStack: [] as UndoEntry[],
};

export const useEditorStore = create<EditorState>()((set) => ({
  ...initialEditor,

  setTool: (tool) => set({ tool }),
  setColorIndex: (index) =>
    set((state) => ({ colorIndex: index, recentColors: pushRecent(state.recentColors, index) })),
  setBrushSize: (size) => set({ brushSize: Math.min(4, Math.max(1, Math.round(size))) }),
  stepBrush: (delta) =>
    set((state) => ({ brushSize: Math.min(4, Math.max(1, state.brushSize + delta)) })),
  setView: (view) => set((state) => ({ view: { ...state.view, ...view, scale: clampScale(view.scale ?? state.view.scale) } })),
  zoomAt: (pointerX, pointerY, factor) =>
    set((state) => {
      const nextScale = clampScale(state.view.scale * factor);
      const ratio = nextScale / state.view.scale;
      return {
        view: {
          scale: nextScale,
          offsetX: pointerX - (pointerX - state.view.offsetX) * ratio,
          offsetY: pointerY - (pointerY - state.view.offsetY) * ratio,
        },
      };
    }),
  toggleGrid: () => set((state) => ({ gridVisible: !state.gridVisible })),
  setRefVisible: (visible) => set({ refVisible: visible }),
  setRefMode: (mode) => set({ refMode: mode }),
  setRefOpacity: (opacity) => set({ refOpacity: Math.min(100, Math.max(0, Math.round(opacity))) }),
  setHighlight: (index) => set({ highlightIndex: index }),
  setReviewColors: (indices) => set({ reviewColors: indices }),
  setSpaceHeld: (held) => set({ spaceHeld: held }),

  pushUndo: (entry) =>
    set((state) => ({
      undoStack: [...state.undoStack, entry].slice(-UNDO_LIMIT),
      redoStack: [],
    })),
  clearHistory: () => set({ undoStack: [], redoStack: [] }),
  resetEditor: () => set({ ...initialEditor }),
}));
