// @vitest-environment jsdom
/**
 * 烫染组件冒烟（design §6：面板渲染 / 预设切换 / 强度 / 对比按钮 / Esc /
 * 渲染调度防抖 / 缩略图缓存 / 零副作用断言）。画布像素级不强测
 * （jsdom 无 2D context，CanvasStage 渲染守卫为 no-op），留浏览器人工验收。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { FinishPanel } from './FinishPanel';
import { useEditorShortcuts } from './useEditorShortcuts';
import { useFinishPreview } from './useFinishPreview';
import { useFinishThumbnails } from './useFinishThumbnails';
import type { FinishRunner } from './finishRender';
import { downsampleCells, previewPxPerCell } from './finishRender';
import { useProjectStore } from '@/store/project';
import { useEditorStore } from '@/store/editor';
import { useFinishStore } from '@/store/finish';
import { diffOf } from '@/lib/cellOps';
import type { FinishInput, FinishOutput } from '@/lib/finish';

function resetStores(): void {
  useProjectStore.setState({
    loaded: true,
    title: 't',
    brandKey: 'mard',
    spec: '5mm',
    w: 8,
    h: 8,
    cells: new Int16Array(64).fill(-1),
    finish: { preset: 'normal', intensity: 100 },
    refImage: null,
    cellsVersion: 0,
    lastDiff: null,
    hasUnsavedChanges: false,
    lastSavedAt: null,
  });
  useEditorStore.getState().resetEditor();
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

afterEach(cleanup);

describe('FinishPanel', () => {
  beforeEach(resetStores);

  it('渲染三组六预设 + 强度滑杆 + 对比按钮', () => {
    render(<FinishPanel />);
    for (const name of ['正常烫', '毛巾烫', '华夫格烫', '搓澡巾烫', '格利特烫', '亮片烫']) {
      expect(screen.getByRole('button', { name: new RegExp(name) })).toBeInTheDocument();
    }
    expect(screen.getByRole('slider', { name: '烫染强度' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '按住对比' })).toBeInTheDocument();
  });

  it('点击预设写入工程 finish（cells 零副作用）', () => {
    useProjectStore.getState().newProject({ title: 't', brandKey: 'mard', spec: '5mm', size: 8 });
    const cellsBefore = new Int16Array(useProjectStore.getState().cells);
    const versionBefore = useProjectStore.getState().cellsVersion;
    render(<FinishPanel />);
    fireEvent.click(screen.getByRole('button', { name: /毛巾烫/ }));
    expect(useProjectStore.getState().finish).toEqual({ preset: 'towel', intensity: 100 });
    fireEvent.click(screen.getByRole('button', { name: /亮片烫/ }));
    expect(useProjectStore.getState().finish.preset).toBe('sequin');
    // 视图切换零副作用
    expect(Array.from(useProjectStore.getState().cells)).toEqual(Array.from(cellsBefore));
    expect(useProjectStore.getState().cellsVersion).toBe(versionBefore);
  });

  it('强度滑杆写回 finish', () => {
    render(<FinishPanel />);
    fireEvent.change(screen.getByRole('slider', { name: '烫染强度' }), { target: { value: '42' } });
    expect(useProjectStore.getState().finish.intensity).toBe(42);
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('按住对比按钮切换 comparing，松开复位', () => {
    render(<FinishPanel />);
    const btn = screen.getByRole('button', { name: '按住对比' });
    fireEvent.pointerDown(btn);
    expect(useFinishStore.getState().comparing).toBe(true);
    fireEvent.pointerUp(btn);
    expect(useFinishStore.getState().comparing).toBe(false);
    fireEvent.pointerDown(btn);
    fireEvent.pointerLeave(btn);
    expect(useFinishStore.getState().comparing).toBe(false);
  });

  it('关闭按钮退出面板与预览态', () => {
    useFinishStore.getState().openPanel();
    render(<FinishPanel />);
    fireEvent.click(screen.getByRole('button', { name: '关闭烫染预览' }));
    expect(useFinishStore.getState().panelOpen).toBe(false);
    expect(useFinishStore.getState().previewing).toBe(false);
  });
});

describe('快捷键：预览态空格对比 / Esc 返回', () => {
  beforeEach(resetStores);

  function ShortcutsProbe(): null {
    useEditorShortcuts();
    return null;
  }

  it('预览态：空格按下对比、松开复位；Esc 退出预览', () => {
    render(<ShortcutsProbe />);
    useFinishStore.getState().openPanel();
    fireEvent.keyDown(window, { key: ' ' });
    expect(useFinishStore.getState().comparing).toBe(true);
    expect(useEditorStore.getState().spaceHeld).toBe(false);
    fireEvent.keyUp(window, { key: ' ' });
    expect(useFinishStore.getState().comparing).toBe(false);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useFinishStore.getState().previewing).toBe(false);
    expect(useFinishStore.getState().panelOpen).toBe(false);
  });

  it('编辑态：空格仍为平移，Esc 清高亮（原行为不回归）', () => {
    render(<ShortcutsProbe />);
    fireEvent.keyDown(window, { key: ' ' });
    expect(useEditorStore.getState().spaceHeld).toBe(true);
    expect(useFinishStore.getState().comparing).toBe(false);
    fireEvent.keyUp(window, { key: ' ' });
    useEditorStore.getState().setHighlight(3);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useEditorStore.getState().highlightIndex).toBeNull();
    expect(useFinishStore.getState().panelOpen).toBe(false);
  });
});

describe('useFinishPreview（注入假 runner）', () => {
  beforeEach(resetStores);

  function PreviewProbe({ runner }: { runner: FinishRunner }): null {
    useFinishPreview(runner);
    return null;
  }

  const fakeRunner: FinishRunner = async (input: FinishInput): Promise<FinishOutput> => {
    return { rgba: new Uint8ClampedArray(input.w * input.pxPerCell! * 4), w: input.w * input.pxPerCell!, h: input.h * input.pxPerCell! };
  };

  it('预览开启后按指纹渲染并缓存；指纹命中不重复渲染', async () => {
    const spy = vi.fn(fakeRunner);
    render(<PreviewProbe runner={spy} />);
    useFinishStore.getState().openPanel();
    await waitFor(() => {
      expect(useFinishStore.getState().preview).not.toBeNull();
    });
    const key = useFinishStore.getState().previewKey;
    expect(key).toContain('normal');
    expect(spy).toHaveBeenCalledTimes(1);
    // 关闭再打开：指纹命中缓存，不再渲染
    useFinishStore.getState().closePanel();
    useFinishStore.getState().openPanel();
    await new Promise((r) => setTimeout(r, 60));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('预设切换立即派发；强度变化 150ms 防抖后派发', async () => {
    const spy = vi.fn(fakeRunner);
    render(<PreviewProbe runner={spy} />);
    useFinishStore.getState().openPanel();
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    // 预设切换 → 0ms 派发
    useProjectStore.getState().setFinish({ preset: 'towel', intensity: 100 });
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2), { timeout: 300 });
    // 强度微调 → 150ms 内不派发，之后派发
    useProjectStore.getState().setFinish({ preset: 'towel', intensity: 80 });
    await new Promise((r) => setTimeout(r, 60));
    expect(spy).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(3), { timeout: 400 });
    const lastInput = spy.mock.calls[spy.mock.calls.length - 1][0] as FinishInput;
    expect(lastInput.intensity).toBe(80);
    expect(lastInput.preset).toBe('towel');
  });

  it('runner 失败清 busy 不崩溃（画布平面图兜底）', async () => {
    const failing: FinishRunner = () => Promise.reject(new Error('boom'));
    render(<PreviewProbe runner={failing} />);
    useFinishStore.getState().openPanel();
    await waitFor(() => expect(useFinishStore.getState().previewBusy).toBe(false));
    expect(useFinishStore.getState().preview).toBeNull();
  });
});

describe('useFinishThumbnails（注入假 runner）', () => {
  beforeEach(resetStores);

  function ThumbProbe({ runner }: { runner: FinishRunner }): null {
    useFinishThumbnails(runner);
    return null;
  }

  it('空闲期逐个渲染六预设并记指纹（jsdom 无 2D 上下文 → dataUrl 为 null 但 version 落账）', async () => {
    const spy = vi.fn(async (input: FinishInput): Promise<FinishOutput> => {
      const s = input.pxPerCell ?? 4;
      return { rgba: new Uint8ClampedArray(input.w * s * input.h * s * 4), w: input.w * s, h: input.h * s };
    });
    render(<ThumbProbe runner={spy} />);
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(6), { timeout: 2000 });
    const thumbs = useFinishStore.getState().thumbnails;
    for (const key of ['normal', 'towel', 'glitter', 'sequin', 'waffle', 'loofah'] as const) {
      expect(thumbs[key].version).toBe('mard:0');
    }
    // 同指纹不再重算
    await new Promise((r) => setTimeout(r, 50));
    expect(spy).toHaveBeenCalledTimes(6);
    // 画布变更 → 指纹过期 → 重算
    const cells = useProjectStore.getState().cells;
    useProjectStore.getState().applyDiff(diffOf(cells, [0], [5]), '一笔');
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(12), { timeout: 2000 });
  });

  it('缩略图用降采样快照（≤24×24）', async () => {
    useProjectStore.getState().newProject({ title: 't', brandKey: 'mard', spec: '5mm', size: 52 });
    const spy = vi.fn(async (input: FinishInput): Promise<FinishOutput> => {
      return { rgba: new Uint8ClampedArray(input.w * input.h * 4), w: input.w, h: input.h };
    });
    render(<ThumbProbe runner={spy} />);
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(6), { timeout: 2000 });
    const input = spy.mock.calls[0][0] as FinishInput;
    expect(Math.max(input.w, input.h)).toBeLessThanOrEqual(24);
  });
});

describe('finishRender 支撑函数', () => {
  it('previewPxPerCell：常规 8px，>100×100 降 4px', () => {
    expect(previewPxPerCell(55, 63)).toBe(8);
    expect(previewPxPerCell(104, 104)).toBe(4);
    expect(previewPxPerCell(60, 120)).toBe(4);
  });

  it('downsampleCells 最近邻且保长宽比上限', () => {
    const cells = new Int16Array(52 * 52);
    for (let i = 0; i < cells.length; i++) cells[i] = i % 3;
    const small = downsampleCells(cells, 52, 52, 24);
    expect(small.w).toBeLessThanOrEqual(24);
    expect(small.h).toBeLessThanOrEqual(24);
    expect(small.cells.length).toBe(small.w * small.h);
    // 最近邻：原点值保留
    expect(small.cells[0]).toBe(cells[0]);
  });
});
