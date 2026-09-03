// @vitest-environment jsdom
/**
 * 导出三件套对话框冒烟（M5 design.md §4：三区渲染 / 开关联动 / 下载触发 /
 * JSON 往返逐字段一致）。jsdom 无 2D 上下文：预览 canvas 与 PNG 编码走
 * exportFiles 守卫降级（sheetPngBlob / downloadBlob 以 mock 替身断言调用契约），
 * 真实下载内容留浏览器人工验收（主会话执行）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { ExportDialog } from './ExportDialog';
import { downloadBlob, sheetPngBlob } from './exportFiles';
import { useProjectStore } from '@/store/project';
import { parseProjectFile, serializeProjectFile } from '@/lib/storage';

vi.mock('./exportFiles', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./exportFiles')>();
  return {
    ...actual,
    downloadBlob: vi.fn(),
    sheetPngBlob: vi.fn(async () => new Blob(['png-bytes'], { type: 'image/png' })),
  };
});

/** 标题含 Windows 非法字符，验证文件名清洗。 */
const TITLE = '星星/图纸:测试';

function seedProject(): void {
  useProjectStore.setState({
    loaded: true,
    title: TITLE,
    brandKey: 'mard',
    spec: '5mm',
    w: 3,
    h: 2,
    cells: new Int16Array([0, 0, 0, 5, 5, -1]),
    finish: { preset: 'normal', intensity: 100 },
    refImage: null,
    cellsVersion: 1,
    lastDiff: null,
    hasUnsavedChanges: false,
    lastSavedAt: null,
  });
}

function lastDownload(): [Blob, string] {
  const calls = vi.mocked(downloadBlob).mock.calls;
  const last = calls[calls.length - 1];
  if (!last) throw new Error('downloadBlob 未被调用');
  return last as [Blob, string];
}

afterEach(cleanup);

describe('ExportDialog 冒烟', () => {
  beforeEach(() => {
    seedProject();
    vi.mocked(downloadBlob).mockClear();
    vi.mocked(sheetPngBlob).mockClear();
  });

  it('三分区渲染与页签切换', () => {
    render(<ExportDialog open onClose={vi.fn()} onImportProject={vi.fn()} />);
    expect(screen.getByRole('tab', { name: '图纸 PNG' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下载 PNG' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'BOM 清单 CSV' }));
    expect(screen.getByRole('columnheader', { name: '色号' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下载 CSV' })).toBeInTheDocument();
    expect(screen.getByText('总计')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '工程 JSON' }));
    expect(screen.getByRole('button', { name: '导出工程 JSON' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导入工程' })).toBeInTheDocument();
  });

  it('PNG：默认完整版式下载；版式/标注/署名联动渲染参数，文件名清洗生效', async () => {
    render(<ExportDialog open onClose={vi.fn()} onImportProject={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '下载 PNG' }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
    expect(lastDownload()[1]).toBe('星星_图纸_测试.png');
    expect(vi.mocked(sheetPngBlob).mock.calls[0]?.[4]).toMatchObject({ layout: 'sheet', cellLabels: false });

    fireEvent.click(screen.getByRole('button', { name: /纯图版/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /格子内印色号/ }));
    fireEvent.change(screen.getByLabelText('作者署名'), { target: { value: '拼豆娘' } });
    fireEvent.click(screen.getByRole('button', { name: '下载 PNG' }));
    await waitFor(() => expect(sheetPngBlob).toHaveBeenCalledTimes(2));
    expect(vi.mocked(sheetPngBlob).mock.calls[1]?.[4]).toMatchObject({
      layout: 'pattern_only',
      cellLabels: true,
      author: '拼豆娘',
      title: TITLE,
    });
    expect(lastDownload()[1]).toBe('星星_图纸_测试.png');
  });

  it('CSV：UTF-8 BOM 与表头正确、文件名 -BOM.csv、预览对齐 store 颗数', async () => {
    render(<ExportDialog open onClose={vi.fn()} onImportProject={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'BOM 清单 CSV' }));
    expect(screen.getAllByText('A1').length).toBeGreaterThan(0); // 预览行来自 computeBom（3 颗 A1 降序在前；MARD 色名回填为色号）
    fireEvent.click(screen.getByRole('button', { name: '下载 CSV' }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
    const [blob, filename] = lastDownload();
    expect(filename).toBe('星星_图纸_测试-BOM.csv');
    // Blob.text() 会剥离 BOM（UTF-8 解码语义），落盘字节以 arrayBuffer 校验
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(bytes.slice(0, 3)).toEqual(new Uint8Array([0xef, 0xbb, 0xbf]));
    const text = new TextDecoder().decode(bytes.slice(3));
    expect(text).toContain('品牌,色号,色名,颗数,占比');
    expect(text).toContain('mard,A1,');
    expect(text.trimEnd().endsWith('总计,,,5,100.00%')).toBe(true);
  });

  it('工程 JSON：导出 → parseProjectFile → 再序列化逐字段一致（spec 扩展字段随文件）', async () => {
    render(<ExportDialog open onClose={vi.fn()} onImportProject={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: '工程 JSON' }));
    fireEvent.click(screen.getByRole('button', { name: '导出工程 JSON' }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
    const [blob, filename] = lastDownload();
    expect(filename).toBe('星星_图纸_测试.json');

    const text = await blob.text();
    expect((JSON.parse(text) as { spec?: string }).spec).toBe('5mm');
    const first = parseProjectFile(text);
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error(first.error);
    const second = parseProjectFile(serializeProjectFile(first.project));
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error(second.error);
    expect(second.project).toEqual(first.project);
  });

  it('导入：文件选择触发回调并关闭对话框', () => {
    const onImportProject = vi.fn();
    const onClose = vi.fn();
    render(<ExportDialog open onClose={onClose} onImportProject={onImportProject} />);
    fireEvent.click(screen.getByRole('tab', { name: '工程 JSON' }));
    // Dialog 经 portal 挂 document.body，input 需从 body 查询
    const input = document.body.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    const file = new File(['{}'], 'project.json', { type: 'application/json' });
    fireEvent.change(input!, { target: { files: [file] } });
    expect(onImportProject).toHaveBeenCalledWith(file);
    expect(onClose).toHaveBeenCalled();
  });
});
