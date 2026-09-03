import { describe, expect, it } from 'vitest';

import {
  PROJECT_STORAGE_KEY,
  getFinish,
  loadProject,
  normalizeProject,
  parseProjectFile,
  saveProject,
  serializeProjectFile,
  type StorageLike,
} from './storage';
import { DEFAULT_FINISH, type Project } from './types';

/** 内存存储（模拟 localStorage）。 */
class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();

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

function sampleProject(over: Partial<Project> = {}): Project {
  return {
    v: 1,
    title: '测试作品',
    brandKey: 'mard',
    w: 8,
    h: 8,
    cells: Array.from({ length: 64 }, (_, i) => (i % 7 === 0 ? -1 : i % 291)),
    ...over,
  };
}

describe('localStorage 层', () => {
  it('saveProject / loadProject 往返一致', () => {
    const store = new MemoryStorage();
    const project = sampleProject();
    saveProject(store, project);
    const loaded = loadProject(store);
    expect(loaded).toEqual(project);
  });

  it('loadProject 使用默认键，空存储返回 null', () => {
    const store = new MemoryStorage();
    expect(loadProject(store)).toBeNull();
    saveProject(store, sampleProject(), 'other-key');
    expect(store.getItem(PROJECT_STORAGE_KEY)).toBeNull();
  });

  it('损坏数据返回 null 而不抛错', () => {
    const store = new MemoryStorage();
    store.setItem(PROJECT_STORAGE_KEY, '{not json');
    expect(loadProject(store)).toBeNull();
    store.setItem(PROJECT_STORAGE_KEY, JSON.stringify({ v: 2, title: 'x' }));
    expect(loadProject(store)).toBeNull();
  });

  it('存储内容不含参考图等大对象字段（分层存储决议）', () => {
    const store = new MemoryStorage();
    saveProject(store, sampleProject());
    const raw = store.getItem(PROJECT_STORAGE_KEY) ?? '';
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual(['brandKey', 'cells', 'h', 'title', 'v', 'w']);
    expect(parsed.refImage).toBeUndefined();
  });
});

describe('normalizeProject（§4.8 schema）', () => {
  it('finish 缺省保持缺省，getFinish 回退 normal+100', () => {
    const project = normalizeProject(sampleProject(), true);
    expect(project?.finish).toBeUndefined();
    expect(getFinish(project ?? sampleProject())).toEqual(DEFAULT_FINISH);
  });

  it('finish.preset 非法回退 normal，intensity 裁剪到 0–100', () => {
    const project = normalizeProject(sampleProject({ finish: { preset: 'glitter' as never, intensity: 150 } }), false);
    expect(project?.finish).toEqual({ preset: 'glitter', intensity: 100 });
    const project2 = normalizeProject(sampleProject({ finish: { preset: 'unknown' as never, intensity: -5 } }), false);
    expect(project2?.finish).toEqual({ preset: 'normal', intensity: 0 });
  });

  it('非法 brandKey / 尺寸 / cells 长度 / 负下标拒绝', () => {
    expect(normalizeProject(sampleProject({ brandKey: 'ukenn' as never }), true)).toBeNull();
    expect(normalizeProject(sampleProject({ w: 0 }), true)).toBeNull();
    expect(normalizeProject(sampleProject({ cells: [0, 1] }), true)).toBeNull();
    expect(normalizeProject(sampleProject({ cells: [-2, ...Array(63).fill(0)] }), true)).toBeNull();
    expect(normalizeProject({ ...sampleProject(), v: 2 }, true)).toBeNull();
  });

  it('合法工程通过（含 -1 空格与 finish）', () => {
    const project = normalizeProject(
      sampleProject({ finish: { preset: 'waffle', intensity: 40 } }),
      true,
    );
    expect(project?.finish).toEqual({ preset: 'waffle', intensity: 40 });
  });
});

describe('工程 JSON 导入导出', () => {
  it('无内嵌参考图往返一致', () => {
    const project = sampleProject();
    const json = serializeProjectFile(project);
    const result = parseProjectFile(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project).toEqual(project);
    expect(result.refImage).toBeNull();
  });

  it('内嵌参考图导出与导入（导入优先取内嵌图）', () => {
    const project = sampleProject();
    const refImage = { dataUrl: 'data:image/png;base64,QUJD', name: 'ref.png' };
    const json = serializeProjectFile(project, refImage);
    const result = parseProjectFile(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project).toEqual(project);
    expect(result.refImage).toEqual(refImage);
  });

  it('非法 JSON / 非法 schema 返回 ok=false 与原因', () => {
    const bad1 = parseProjectFile('not-json');
    expect(bad1.ok).toBe(false);
    if (bad1.ok) return;
    expect(bad1.error.length).toBeGreaterThan(0);

    const bad2 = parseProjectFile(JSON.stringify({ v: 1, title: 'x', brandKey: 'mard', w: 4, h: 4, cells: [0] }));
    expect(bad2.ok).toBe(false);
  });
});
