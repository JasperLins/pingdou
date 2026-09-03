import { beforeEach, describe, expect, it, vi } from 'vitest';

import { paintCells, type CellDiff } from '@/lib/cellOps';
import { UNDO_LIMIT, useEditorStore, type UndoEntry } from './editor';
import {
  REF_IMAGE_KEY,
  createAutoSaveController,
  loadPersisted,
  useProjectStore,
  type RefImageState,
} from './project';
import { PROJECT_STORAGE_KEY, type StorageLike } from '@/lib/storage';
import type { Project } from '@/lib/types';

/** 内存存储（模拟 localStorage）。 */
class MemoryStorage implements StorageLike {
  map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

/** 内存参考图存储（模拟 IndexedDB 适配器）。 */
class MemoryRefStore {
  map = new Map<string, Blob>();
  async put(key: string, blob: Blob): Promise<void> {
    this.map.set(key, blob);
  }
  async get(key: string): Promise<Blob | null> {
    return this.map.get(key) ?? null;
  }
  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }
}

function resetStores(): void {
  useProjectStore.setState({
    loaded: false,
    title: '',
    brandKey: 'mard',
    spec: '5mm',
    w: 0,
    h: 0,
    cells: new Int16Array(0),
    refImage: null,
    cellsVersion: 0,
    lastDiff: null,
    hasUnsavedChanges: false,
    lastSavedAt: null,
  });
  useEditorStore.getState().resetEditor();
}

function diff(indices: number[], before: number[], after: number[]): CellDiff {
  return {
    indices,
    before: Int16Array.from(before),
    after: Int16Array.from(after),
  };
}

describe('project store：cells 变更与 undo/redo', () => {
  beforeEach(resetStores);

  it('newProject 建立空网格并清空历史', () => {
    useProjectStore.getState().applyDiff(diff([0], [-1], [5]), '一笔');
    useProjectStore.getState().newProject({ title: '新作品', brandKey: 'coco', spec: '2.6mm', size: 8 });
    const s = useProjectStore.getState();
    expect(s.loaded).toBe(true);
    expect(s.w).toBe(8);
    expect([...s.cells]).toHaveLength(64);
    expect(s.cells.every((v) => v === -1)).toBe(true);
    expect(useEditorStore.getState().undoStack).toHaveLength(0);
    expect(s.hasUnsavedChanges).toBe(true);
  });

  it('applyDiff 应用并记录 undo，undo/redo 还原', () => {
    useProjectStore.getState().newProject({ title: 't', brandKey: 'mard', spec: '5mm', size: 4 });
    useProjectStore.getState().applyDiff(diff([0, 5], [-1, -1], [3, 3]), '画两格');
    expect([...useProjectStore.getState().cells].slice(0, 6)).toEqual([3, -1, -1, -1, -1, 3]);

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().cells[0]).toBe(-1);
    expect(useProjectStore.getState().cells[5]).toBe(-1);

    useProjectStore.getState().redo();
    expect(useProjectStore.getState().cells[0]).toBe(3);
    // redo 后可再 undo（条目往返）
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().cells[0]).toBe(-1);
  });

  it('applyDiff 后再变更会清空 redo 栈', () => {
    useProjectStore.getState().newProject({ title: 't', brandKey: 'mard', spec: '5mm', size: 4 });
    useProjectStore.getState().applyDiff(diff([0], [-1], [1]), 'a');
    useProjectStore.getState().undo();
    useProjectStore.getState().applyDiff(diff([1], [-1], [2]), 'b');
    expect(useEditorStore.getState().redoStack).toHaveLength(0);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().cells[1]).toBe(-1);
  });

  it('paintCells 实时落笔不记 undo，recordStroke 统一入栈后可整体撤销', () => {
    useProjectStore.getState().newProject({ title: 't', brandKey: 'mard', spec: '5mm', size: 4 });
    const stroke = paintCells(useProjectStore.getState().cells, [0, 1, 2], 7);
    useProjectStore.getState().paintCells(stroke.indices, [...stroke.after]);
    expect(useEditorStore.getState().undoStack).toHaveLength(0);
    expect(useProjectStore.getState().cells[1]).toBe(7);

    useProjectStore.getState().recordStroke(stroke, '画笔一笔');
    expect(useEditorStore.getState().undoStack).toHaveLength(1);
    useProjectStore.getState().undo();
    expect([...useProjectStore.getState().cells.slice(0, 3)]).toEqual([-1, -1, -1]);
  });

  it('品牌切换 diff 的 undo/redo 同时还原 brandKey 与复查角标', () => {
    useProjectStore.getState().newProject({ title: 't', brandKey: 'mard', spec: '5mm', size: 4 });
    useProjectStore.getState().applyDiff(
      diff([0], [-1], [1]),
      '切品牌',
      { brandSwap: { before: 'mard', after: 'coco' } },
    );
    expect(useProjectStore.getState().brandKey).toBe('coco');
    useEditorStore.getState().setReviewColors([1]);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().brandKey).toBe('mard');
    expect(useEditorStore.getState().reviewColors).toHaveLength(0);
    useProjectStore.getState().redo();
    expect(useProjectStore.getState().brandKey).toBe('coco');
  });

  it('撤销栈 100 步截断', () => {
    useProjectStore.getState().newProject({ title: 't', brandKey: 'mard', spec: '5mm', size: 4 });
    for (let i = 0; i < UNDO_LIMIT + 20; i++) {
      useProjectStore.getState().applyDiff(diff([i % 16], [-1], [i % 20]), `第${i}笔`);
    }
    expect(useEditorStore.getState().undoStack).toHaveLength(UNDO_LIMIT);
    const labels = useEditorStore.getState().undoStack.map((e: UndoEntry) => e.label);
    expect(labels[labels.length - 1]).toBe(`第${UNDO_LIMIT + 19}笔`);
  });
});

describe('project store：持久化与恢复', () => {
  beforeEach(resetStores);

  it('persistNow 写入 localStorage（含扩展 spec 字段）并清除脏态', async () => {
    useProjectStore.getState().newProject({ title: '存档', brandKey: 'mard', spec: '2.6mm', size: 4 });
    const storage = new MemoryStorage();
    const at = await useProjectStore.getState().persistNow(storage);
    expect(at).toBeGreaterThan(0);
    expect(useProjectStore.getState().hasUnsavedChanges).toBe(false);
    const raw = JSON.parse(storage.map.get(PROJECT_STORAGE_KEY) ?? '{}') as Project & { spec?: string };
    expect(raw.title).toBe('存档');
    expect(raw.spec).toBe('2.6mm');
    expect(raw.cells).toHaveLength(16);
  });

  it('persistNow 同时把参考图写入 IndexedDB 适配器', async () => {
    useProjectStore.getState().newProject({ title: '带图', brandKey: 'mard', spec: '5mm', size: 4 });
    const ref: RefImageState = { name: '猫.png', dataUrl: 'data:text/plain;base64,aGk=' };
    useProjectStore.getState().setRefImage(ref);
    const storage = new MemoryStorage();
    const refStore = new MemoryRefStore();
    await useProjectStore.getState().persistNow(storage, refStore);
    const blob = refStore.map.get(REF_IMAGE_KEY);
    expect(blob).toBeInstanceOf(Blob);
    expect(await blob?.text()).toBe('hi');
  });

  it('loadPersisted 恢复工程 + spec + 参考图', async () => {
    const storage = new MemoryStorage();
    const refStore = new MemoryRefStore();
    await refStore.put(REF_IMAGE_KEY, new Blob(['refimg'], { type: 'image/png' }));
    storage.setItem(
      PROJECT_STORAGE_KEY,
      JSON.stringify({
        v: 1,
        title: '恢复',
        brandKey: 'perler',
        w: 2,
        h: 2,
        cells: [0, -1, -1, 3],
        spec: '5mm',
      }),
    );
    const loaded = await loadPersisted(storage, refStore, async (b) => `data:image/png;base64,${await b.text()}`);
    expect(loaded.project?.title).toBe('恢复');
    expect(loaded.spec).toBe('5mm');
    expect(loaded.refImage?.dataUrl).toContain('refimg');

    useProjectStore.getState().loadFrom(loaded.project!, loaded.spec, loaded.refImage);
    const s = useProjectStore.getState();
    expect(s.loaded).toBe(true);
    expect([...s.cells]).toEqual([0, -1, -1, 3]);
    expect(s.brandKey).toBe('perler');
  });

  it('loadPersisted 无存档返回 null 工程；旧存档缺 spec 时按品牌推导', async () => {
    const empty = await loadPersisted(new MemoryStorage());
    expect(empty.project).toBeNull();

    const storage = new MemoryStorage();
    storage.setItem(
      PROJECT_STORAGE_KEY,
      JSON.stringify({ v: 1, title: '旧档', brandKey: 'perler', w: 2, h: 2, cells: [-1, -1, -1, -1] }),
    );
    const loaded = await loadPersisted(storage);
    expect(loaded.spec).toBe('5mm');
    useProjectStore.getState().loadFrom(loaded.project!, null, null);
    expect(useProjectStore.getState().spec).toBe('5mm');
  });

  it('loadFrom 重置 undo 历史与脏态', async () => {
    useProjectStore.getState().newProject({ title: 't', brandKey: 'mard', spec: '5mm', size: 4 });
    useProjectStore.getState().applyDiff(diff([0], [-1], [1]), 'a');
    const storage = new MemoryStorage();
    storage.setItem(
      PROJECT_STORAGE_KEY,
      JSON.stringify({ v: 1, title: 'b', brandKey: 'coco', w: 2, h: 2, cells: [1, 2, 3, -1], spec: '2.6mm' }),
    );
    const loaded = await loadPersisted(storage);
    useProjectStore.getState().loadFrom(loaded.project!, loaded.spec, null);
    expect(useEditorStore.getState().undoStack).toHaveLength(0);
    expect(useProjectStore.getState().hasUnsavedChanges).toBe(false);
  });
});

describe('自动保存调度（mock timer）', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetStores();
  });

  it('30s 周期触发空闲保存，且仅在脏态时执行', () => {
    useProjectStore.getState().newProject({ title: 't', brandKey: 'mard', spec: '5mm', size: 4 });
    const saves: number[] = [];
    const controller = createAutoSaveController({
      intervalMs: 30_000,
      schedule: (cb) => setTimeout(cb, 0),
      cancel: () => undefined,
      shouldSave: () => useProjectStore.getState().hasUnsavedChanges,
      save: () => {
        saves.push(Date.now());
      },
    });
    controller.start();
    vi.advanceTimersByTime(30_000 + 10);
    expect(saves).toHaveLength(1);

    // 保存后脏态清除（模拟 shouldSave 变 false），下一周期不再保存
    useProjectStore.setState({ hasUnsavedChanges: false });
    vi.advanceTimersByTime(30_000);
    expect(saves).toHaveLength(1);

    controller.stop();
    vi.advanceTimersByTime(120_000);
    expect(saves).toHaveLength(1);
  });

  it('flush 立即保存脏工程（beforeunload 路径）', () => {
    useProjectStore.getState().newProject({ title: 't', brandKey: 'mard', spec: '5mm', size: 4 });
    let saved = 0;
    const controller = createAutoSaveController({
      shouldSave: () => useProjectStore.getState().hasUnsavedChanges,
      save: () => {
        saved += 1;
      },
    });
    controller.flush();
    expect(saved).toBe(1);
  });

  it('端到端：30s 自动保存落 localStorage 并可恢复', async () => {
    useProjectStore.getState().newProject({ title: '自动保存', brandKey: 'mard', spec: '5mm', size: 4 });
    useProjectStore.getState().applyDiff(diff([0], [-1], [2]), '一格');
    const storage = new MemoryStorage();
    const controller = createAutoSaveController({
      intervalMs: 30_000,
      schedule: (cb) => setTimeout(cb, 0),
      cancel: () => undefined,
      shouldSave: () => useProjectStore.getState().hasUnsavedChanges,
      save: () => void useProjectStore.getState().persistNow(storage),
    });
    controller.start();
    await vi.advanceTimersByTimeAsync(30_000 + 10);
    const loaded = await loadPersisted(storage);
    expect(loaded.project?.cells[0]).toBe(2);
    controller.stop();
    vi.useRealTimers();
  });
});

describe('editor store', () => {
  beforeEach(resetStores);

  it('setColorIndex 维护最近使用（去重、置顶、≤12）', () => {
    const { setColorIndex } = useEditorStore.getState();
    for (let i = 0; i < 15; i++) setColorIndex(i);
    const recent = useEditorStore.getState().recentColors;
    expect(recent).toHaveLength(12);
    expect(recent[0]).toBe(14);
    setColorIndex(10);
    expect(useEditorStore.getState().recentColors[0]).toBe(10);
  });

  it('zoomAt 以指针为中心缩放并夹取范围', () => {
    useEditorStore.getState().setView({ scale: 10, offsetX: 100, offsetY: 50 });
    useEditorStore.getState().zoomAt(200, 150, 2);
    const v = useEditorStore.getState().view;
    expect(v.scale).toBe(20);
    // 指针点 (200,150) 对应的格子保持不动
    expect(v.offsetX).toBeCloseTo(0);
    expect(v.offsetY).toBeCloseTo(-50);
    useEditorStore.getState().zoomAt(0, 0, 1000);
    expect(useEditorStore.getState().view.scale).toBe(64);
  });

  it('stepBrush 夹取 1–4', () => {
    useEditorStore.getState().setBrushSize(4);
    useEditorStore.getState().stepBrush(1);
    expect(useEditorStore.getState().brushSize).toBe(4);
    useEditorStore.getState().stepBrush(-9);
    expect(useEditorStore.getState().brushSize).toBe(1);
  });

  it('pushUndo 截断并清空 redo', () => {
    const { pushUndo } = useEditorStore.getState();
    useEditorStore.setState({ redoStack: [{ label: 'r', diff: { indices: [], before: new Int16Array(0), after: new Int16Array(0) } }] });
    pushUndo({ label: 'a', diff: { indices: [], before: new Int16Array(0), after: new Int16Array(0) } });
    expect(useEditorStore.getState().redoStack).toHaveLength(0);
    expect(useEditorStore.getState().undoStack).toHaveLength(1);
  });
});
