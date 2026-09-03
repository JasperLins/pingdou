// @vitest-environment jsdom
/**
 * 编辑器组件冒烟（design.md §7：@testing-library，工具切换 / 快捷键绑定 / 面板渲染）。
 * 画布像素级不强测（jsdom 无 2D context，CanvasStage 渲染守卫为 no-op），留浏览器人工验收。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { ToolRail } from './ToolRail';
import { PalettePanel } from './PalettePanel';
import { StatsPanel } from './StatsPanel';
import { NewDialog } from './NewDialog';
import { CanvasStage } from './CanvasStage';
import { useEditorShortcuts } from './useEditorShortcuts';
import { useEditorStore } from '@/store/editor';
import { useProjectStore } from '@/store/project';
import { diffOf } from '@/lib/cellOps';
import { loadPalette } from '@/lib/palettes';

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

afterEach(cleanup);

function ShortcutsProbe(): null {
  useEditorShortcuts();
  return null;
}

describe('ToolRail', () => {
  beforeEach(resetStores);

  it('点击工具切换 editor store', () => {
    render(<ToolRail />);
    fireEvent.click(screen.getByRole('button', { name: '油漆桶' }));
    expect(useEditorStore.getState().tool).toBe('bucket');
    fireEvent.click(screen.getByRole('button', { name: '橡皮' }));
    expect(useEditorStore.getState().tool).toBe('eraser');
    expect(screen.getByRole('button', { name: '橡皮' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('笔刷档位切换 1–4', () => {
    render(<ToolRail />);
    fireEvent.click(screen.getByRole('button', { name: '笔刷 3' }));
    expect(useEditorStore.getState().brushSize).toBe(3);
  });

  it('撤销按钮走 project store 的 undo', () => {
    useProjectStore.getState().newProject({ title: 't', brandKey: 'mard', spec: '5mm', size: 4 });
    const cells = useProjectStore.getState().cells;
    useProjectStore.getState().applyDiff(diffOf(cells, [0], [5]), '一笔');
    render(<ToolRail />);
    fireEvent.click(screen.getByRole('button', { name: '撤销' }));
    expect(useProjectStore.getState().cells[0]).toBe(-1);
  });
});

describe('快捷键绑定（useEditorShortcuts）', () => {
  beforeEach(resetStores);

  it('B/E/G/I 切换工具，[ ] 调笔刷，Esc 清高亮', () => {
    render(<ShortcutsProbe />);
    fireEvent.keyDown(window, { key: 'g' });
    expect(useEditorStore.getState().tool).toBe('bucket');
    fireEvent.keyDown(window, { key: 'i' });
    expect(useEditorStore.getState().tool).toBe('picker');
    fireEvent.keyDown(window, { key: ']' });
    fireEvent.keyDown(window, { key: ']' });
    expect(useEditorStore.getState().brushSize).toBe(3);
    fireEvent.keyDown(window, { key: '[' });
    expect(useEditorStore.getState().brushSize).toBe(2);
    useEditorStore.getState().setHighlight(3);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useEditorStore.getState().highlightIndex).toBeNull();
  });

  it('空格按住进入平移模式，松开退出', () => {
    render(<ShortcutsProbe />);
    fireEvent.keyDown(window, { key: ' ' });
    expect(useEditorStore.getState().spaceHeld).toBe(true);
    fireEvent.keyUp(window, { key: ' ' });
    expect(useEditorStore.getState().spaceHeld).toBe(false);
  });

  it('Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y 撤销重做', () => {
    useProjectStore.getState().newProject({ title: 't', brandKey: 'mard', spec: '5mm', size: 4 });
    const cells = useProjectStore.getState().cells;
    useProjectStore.getState().applyDiff(diffOf(cells, [1, 2], [7, 7]), '一笔');
    render(<ShortcutsProbe />);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(useProjectStore.getState().cells[1]).toBe(-1);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(useProjectStore.getState().cells[1]).toBe(7);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'y', ctrlKey: true });
    expect(useProjectStore.getState().cells[1]).toBe(7);
  });

  it('输入控件聚焦时快捷键不劫持', () => {
    render(
      <div>
        <ShortcutsProbe />
        <input type="text" aria-label="名称" />
      </div>,
    );
    const input = screen.getByRole('textbox', { name: '名称' });
    input.focus();
    fireEvent.keyDown(input, { key: 'b' });
    expect(useEditorStore.getState().tool).toBe('brush');
    fireEvent.keyDown(input, { key: ' ' });
    expect(useEditorStore.getState().spaceHeld).toBe(false);
  });
});

describe('PalettePanel', () => {
  beforeEach(resetStores);

  it('渲染当前色块/常用色/搜索，点击色块设置当前色', () => {
    useProjectStore.getState().newProject({ title: 't', brandKey: 'mard', spec: '5mm', size: 8 });
    render(<PalettePanel />);
    expect(screen.getByText('色板')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('搜索色号 / 名称…')).toBeInTheDocument();

    const quick = screen.getAllByRole('button', { name: /^A1 / });
    fireEvent.click(quick[0]);
    expect(useEditorStore.getState().colorIndex).toBe(0);
    // 最近使用已记录
    expect(useEditorStore.getState().recentColors).toContain(0);
  });

  it('搜索过滤色系分组', async () => {
    useProjectStore.getState().newProject({ title: 't', brandKey: 'mard', spec: '5mm', size: 8 });
    render(<PalettePanel />);
    fireEvent.change(screen.getByPlaceholderText('搜索色号 / 名称…'), { target: { value: 'A1' } });
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /^A1 / }).length).toBeGreaterThan(0);
    });
  });
});

describe('StatsPanel', () => {
  beforeEach(resetStores);

  it('总览与 Readiness 渲染；有图时点击 Top 颜色高亮', () => {
    useProjectStore.getState().newProject({ title: 't', brandKey: 'mard', spec: '5mm', size: 8 });
    const cells = useProjectStore.getState().cells;
    useProjectStore.getState().applyDiff(diffOf(cells, [0, 1, 2, 9], [3, 3, 3, 4]), '铺色');
    render(<StatsPanel />);
    expect(screen.getByText('用量与检查')).toBeInTheDocument();
    expect(screen.getByText(/导出自检/)).toBeInTheDocument();
    // 8 格 5mm = 4cm
    expect(screen.getByText('4×4 cm')).toBeInTheDocument();

    const top = screen.getByRole('button', { name: `高亮 ${loadPalette('mard').colors[3].code}` });
    fireEvent.click(top);
    expect(useEditorStore.getState().highlightIndex).toBe(3);
    fireEvent.click(top);
    expect(useEditorStore.getState().highlightIndex).toBeNull();
  });

  it('一键去噪按钮可用并走 applyDiff', () => {
    useProjectStore.getState().newProject({ title: 't', brandKey: 'mard', spec: '5mm', size: 8 });
    const cells = useProjectStore.getState().cells;
    // (0,0) 放一颗孤立色 → Readiness 出现碎色提示与清理按钮
    useProjectStore.getState().applyDiff(diffOf(cells, [0], [9]), '孤立');
    render(<StatsPanel />);
    expect(screen.getByText(/孤立碎色/)).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: '一键去噪清理' });
    fireEvent.click(btn);
    expect(useProjectStore.getState().cells[0]).toBe(-1);
    // 一条 undo 记录
    const labels = useEditorStore.getState().undoStack.map((e) => e.label);
    expect(labels).toContain('一键去噪（阈值 1）');
  });
});

describe('NewDialog', () => {
  beforeEach(resetStores);

  it('规格↔板型联动：2.6mm 禁用 29×29 并提示', () => {
    render(<NewDialog open onClose={() => undefined} />);
    const board29 = screen.getByRole('button', { name: /29×29/ });
    expect(board29).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /2.6mm（迷你）/ }));
    expect(screen.getByRole('button', { name: /29×29/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /52×52/ })).not.toBeDisabled();
  });

  it('品牌五选随规格联动禁用，创建写入 project store', () => {
    render(<NewDialog open onClose={() => undefined} />);
    // 5mm 下 COCO（2.6mm 专用）禁用
    expect(screen.getByRole('button', { name: /COCO/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /104×104/ }));
    fireEvent.click(screen.getByRole('button', { name: /开始创作/ }));
    const s = useProjectStore.getState();
    expect(s.loaded).toBe(true);
    expect(s.w).toBe(104);
    expect(s.h).toBe(104);
    expect(s.brandKey).toBe('mard');
    expect(s.spec).toBe('5mm');
  });

  it('自定义尺寸超范围阻止创建', () => {
    render(<NewDialog open onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /自定义/ }));
    fireEvent.change(screen.getByRole('spinbutton', { name: '自定义边长' }), { target: { value: '5' } });
    expect(screen.getByRole('button', { name: /开始创作/ })).toBeDisabled();
  });
});

describe('CanvasStage（jsdom 渲染冒烟）', () => {
  beforeEach(resetStores);

  it('渲染四层 canvas 与视图控制条', () => {
    useProjectStore.getState().newProject({ title: 't', brandKey: 'mard', spec: '5mm', size: 8 });
    const { container } = render(<CanvasStage />);
    expect(container.querySelectorAll('canvas')).toHaveLength(4);
    expect(screen.getByRole('button', { name: '适应窗口' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '隐藏网格' })).toBeInTheDocument();
  });
});
