import { create } from 'zustand';
import { DEFAULT_FINISH, type FinishSetting } from '@/lib/types';
import type { FinishPresetKey } from '@/lib/finish';
import { useProjectStore } from './project';

/**
 * 烫染预览会话 store（design §4）：面板/预览/对比的视图态 + 画布预览位图 +
 * 缩略图缓存。finish{preset,intensity} 的权威数据在 project store（§4.8 schema），
 * 经 {@link setFinish} 写入并标记未保存——烫染是渲染层属性，永不修改 cells。
 *
 * store 只管数据：位图上屏（putImageData/drawImage）由 CanvasStage 订阅执行，
 * Worker 调度由 hooks 层（useFinishPreview / useFinishThumbnails）驱动。
 */

/** 预设展示元数据（面板分组：经典 / 质感 / 闪亮）。 */
export interface FinishPresetMeta {
  key: FinishPresetKey;
  label: string;
  tagline: string;
}

/** 分组结构（顺序即面板展示顺序）。 */
export const FINISH_GROUPS: Readonly<{ label: string; presets: readonly FinishPresetMeta[] }>[] = [
  {
    label: '经典',
    presets: [{ key: 'normal', label: '正常烫', tagline: '平整致密 · 柔和哑光' }],
  },
  {
    label: '质感',
    presets: [
      { key: 'towel', label: '毛巾烫', tagline: '三层绒毛 · 偏暖柔化' },
      { key: 'waffle', label: '华夫格烫', tagline: '方格压痕 · 坑壁迎光' },
      { key: 'loofah', label: '搓澡巾烫', tagline: '网眼做旧 · 偏灰织物' },
    ],
  },
  {
    label: '闪亮',
    presets: [
      { key: 'glitter', label: '格利特烫', tagline: '双层闪粉 · 虹彩星芒' },
      { key: 'sequin', label: '亮片烫', tagline: '亮片阵列 · 镜面反光带' },
    ],
  },
];

/** 全部预设元数据（平铺）。 */
export const FINISH_PRESET_META: Readonly<Record<FinishPresetKey, FinishPresetMeta>> = Object.fromEntries(
  FINISH_GROUPS.flatMap((g) => g.presets.map((p) => [p.key, p])),
) as Readonly<Record<FinishPresetKey, FinishPresetMeta>>;

/** 预设缩略图缓存条目（version = 渲染时的指纹（brand+cellsVersion），不匹配即过期）。 */
export interface FinishThumb {
  dataUrl: string | null;
  version: string | null;
}

/** 画布预览位图。 */
export interface FinishPreviewBitmap {
  rgba: Uint8ClampedArray;
  w: number;
  h: number;
}

/** 效果封面（保存后异步生成；失败降级平面图）。 */
export interface FinishCover {
  dataUrl: string;
  /** 封面对应的指纹（cellsVersion+w+h+brand+finish）。 */
  key: string;
}

interface FinishState {
  /** 面板开合（开 = 同时进入画布预览态）。 */
  panelOpen: boolean;
  /** 画布效果预览态（隐藏网格/色号，只读视图）。 */
  previewing: boolean;
  /** 按住对比（按钮或空格）：瞬时切回平面图纸。 */
  comparing: boolean;
  /** 最新画布预览位图（null = 尚无渲染结果，画布显示平面图兜底）。 */
  preview: FinishPreviewBitmap | null;
  /** preview 对应的指纹（cellsVersion+w+h+brand+preset+intensity+pxPerCell）。 */
  previewKey: string | null;
  previewBusy: boolean;
  /** 预设缩略图缓存（六 key 全量，过期按 version 判定）。 */
  thumbnails: Record<FinishPresetKey, FinishThumb>;
  /** 效果封面（会话内缓存）。 */
  cover: FinishCover | null;

  openPanel: () => void;
  closePanel: () => void;
  /** 退出预览（Esc）：面板与预览态一并复位。 */
  exitPreview: () => void;
  setComparing: (held: boolean) => void;
  setPreview: (bitmap: FinishPreviewBitmap, key: string) => void;
  setPreviewBusy: (busy: boolean) => void;
  setThumb: (key: FinishPresetKey, dataUrl: string | null, version: string) => void;
  setCover: (cover: FinishCover) => void;
}

const EMPTY_THUMB: FinishThumb = { dataUrl: null, version: null };

const initialFinish = {
  panelOpen: false,
  previewing: false,
  comparing: false,
  preview: null as FinishPreviewBitmap | null,
  previewKey: null as string | null,
  previewBusy: false,
  thumbnails: {
    normal: { ...EMPTY_THUMB },
    towel: { ...EMPTY_THUMB },
    glitter: { ...EMPTY_THUMB },
    sequin: { ...EMPTY_THUMB },
    waffle: { ...EMPTY_THUMB },
    loofah: { ...EMPTY_THUMB },
  } as Record<FinishPresetKey, FinishThumb>,
  cover: null as FinishCover | null,
};

export const useFinishStore = create<FinishState>()((set) => ({
  ...initialFinish,

  openPanel: () => set({ panelOpen: true, previewing: true, comparing: false }),
  closePanel: () => set({ panelOpen: false, previewing: false, comparing: false }),
  exitPreview: () => set({ panelOpen: false, previewing: false, comparing: false }),
  setComparing: (held) => set({ comparing: held }),
  setPreview: (bitmap, key) => set({ preview: bitmap, previewKey: key, previewBusy: false }),
  setPreviewBusy: (busy) => set({ previewBusy: busy }),
  setThumb: (key, dataUrl, version) =>
    set((state) => ({ thumbnails: { ...state.thumbnails, [key]: { dataUrl, version } } })),
  setCover: (cover) => set({ cover }),
}));

// ---------------------------------------------------------------------------
// finish 设置写入（project store 单一权威；不触碰 cells）
// ---------------------------------------------------------------------------

/** 更新工程烫染设置：委托 project store 的 setFinish（持久化到工程 JSON §4.8）。 */
export function setFinish(setting: FinishSetting): void {
  useProjectStore.getState().setFinish(setting);
}

/** 恢复默认烫染设置（normal + 100）。 */
export function resetFinish(): void {
  setFinish({ ...DEFAULT_FINISH });
}
