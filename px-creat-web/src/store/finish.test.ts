import { beforeEach, describe, expect, it } from 'vitest';

import { useProjectStore } from '@/store/project';
import { useEditorStore } from '@/store/editor';
import { FINISH_GROUPS, resetFinish, setFinish, useFinishStore } from '@/store/finish';
import { DEFAULT_FINISH } from '@/lib/types';
import type { FinishPresetKey } from '@/lib/finish';

/**
 * 烫染会话 store 单测：面板/预览/对比/位图/缩略图状态机 +
 * setFinish 与 project store 的联动（§4.8 持久化字段、cells 零副作用）。
 */

function resetStores(): void {
  useProjectStore.setState({
    loaded: true,
    title: 't',
    brandKey: 'mard',
    spec: '5mm',
    w: 4,
    h: 4,
    cells: new Int16Array(16).fill(-1),
    finish: { ...DEFAULT_FINISH },
    refImage: null,
    cellsVersion: 1,
    lastDiff: null,
    hasUnsavedChanges: false,
    lastSavedAt: null,
  });
  useFinishStore.setState({
    panelOpen: false,
    previewing: false,
    comparing: false,
    preview: null,
    previewKey: null,
    previewBusy: false,
    thumbnails: {
      normal: { dataUrl: null, version: null },
      towel: { dataUrl: null, version: null },
      glitter: { dataUrl: null, version: null },
      sequin: { dataUrl: null, version: null },
      waffle: { dataUrl: null, version: null },
      loofah: { dataUrl: null, version: null },
    },
    cover: null,
  });
}

describe('useFinishStore', () => {
  beforeEach(resetStores);

  it('openPanel 进入面板+预览态，closePanel/exitPreview 复位', () => {
    useFinishStore.getState().openPanel();
    expect(useFinishStore.getState().panelOpen).toBe(true);
    expect(useFinishStore.getState().previewing).toBe(true);
    useFinishStore.getState().setComparing(true);
    useFinishStore.getState().exitPreview();
    const s = useFinishStore.getState();
    expect(s.panelOpen).toBe(false);
    expect(s.previewing).toBe(false);
    expect(s.comparing).toBe(false);
  });

  it('setPreview 记录位图与指纹并清 busy', () => {
    useFinishStore.getState().setPreviewBusy(true);
    const rgba = new Uint8ClampedArray(16);
    useFinishStore.getState().setPreview({ rgba, w: 2, h: 2 }, 'k1');
    const s = useFinishStore.getState();
    expect(s.preview?.rgba).toBe(rgba);
    expect(s.previewKey).toBe('k1');
    expect(s.previewBusy).toBe(false);
  });

  it('setThumb 覆盖单个预设缩略图，其余不动', () => {
    useFinishStore.getState().setThumb('towel', 'data:image/png;base64,x', 'mard:3');
    const thumbs = useFinishStore.getState().thumbnails;
    expect(thumbs.towel).toEqual({ dataUrl: 'data:image/png;base64,x', version: 'mard:3' });
    expect(thumbs.normal.version).toBeNull();
  });
});

describe('setFinish（project store 联动）', () => {
  beforeEach(resetStores);

  it('写入工程 finish 并标记未保存；cells 零副作用', () => {
    const cellsBefore = new Int16Array(useProjectStore.getState().cells);
    const versionBefore = useProjectStore.getState().cellsVersion;
    setFinish({ preset: 'towel', intensity: 62 });
    const s = useProjectStore.getState();
    expect(s.finish).toEqual({ preset: 'towel', intensity: 62 });
    expect(s.hasUnsavedChanges).toBe(true);
    // 视图切换零副作用：cells 与 cellsVersion 不变
    expect(Array.from(s.cells)).toEqual(Array.from(cellsBefore));
    expect(s.cellsVersion).toBe(versionBefore);
    // 撤销栈不记录（非 cells 变更）
    expect(useEditorStore.getState().undoStack).toHaveLength(0);
  });

  it('intensity 钳制到 0–100', () => {
    setFinish({ preset: 'glitter', intensity: 140 });
    expect(useProjectStore.getState().finish.intensity).toBe(100);
    setFinish({ preset: 'glitter', intensity: -5 });
    expect(useProjectStore.getState().finish.intensity).toBe(0);
  });

  it('resetFinish 恢复 normal + 100', () => {
    setFinish({ preset: 'sequin', intensity: 30 });
    resetFinish();
    expect(useProjectStore.getState().finish).toEqual({ preset: 'normal', intensity: 100 });
  });

  it('finish 随 toProject 输出（§4.8 持久化字段）', () => {
    setFinish({ preset: 'waffle', intensity: 77 });
    const project = useProjectStore.getState().toProject();
    expect(project.finish).toEqual({ preset: 'waffle', intensity: 77 });
  });
});

describe('FINISH_GROUPS 元数据', () => {
  it('三组覆盖六预设且无重复', () => {
    const keys = FINISH_GROUPS.flatMap((g) => g.presets.map((p) => p.key));
    expect(keys).toHaveLength(6);
    expect(new Set(keys).size).toBe(6);
    expect(FINISH_GROUPS.map((g) => g.label)).toEqual(['经典', '质感', '闪亮']);
    for (const preset of keys as FinishPresetKey[]) {
      expect(FINISH_GROUPS.some((g) => g.presets.some((p) => p.key === preset && p.label.length > 0))).toBe(true);
    }
  });
});
