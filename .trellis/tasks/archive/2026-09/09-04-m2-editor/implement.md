# 执行计划 · M2 编辑器 MVP

依据本任务 prd.md 与 design.md。每步完成即过四条验证（tsc/test/lint/build），保持可编译可回滚。

## 有序清单

1. **lib/cellOps.ts**：floodFill / getConnectedRegions / denoise / replaceColor / swapColors / clearColor / mapCellsToPalette + 全量单测（含 104×104 性能冒烟）
2. **store**：project.ts（cells: Int16Array + actions）与 editor.ts（工具/视图态 + undo diff 栈 100 步）；单测（undo 边界、mock timer 自动保存）
3. **CanvasStage 分层画布**：四层 canvas + DPR + 缩放平移 + 网格自适应简化 + rAF 脏区重绘（先渲染只读 cells，工具后接）
4. **工具集**：画笔/橡皮（Bresenham + 笔刷 1–4）/油漆桶/直线/矩形/椭圆（预览提交）/吸管；快捷键全表（B/E/G/I/[ ]/空格/Ctrl+Z/Y）
5. **PalettePanel**：搜索/色系分组/最近使用/常用色快捷行（CIEDE2000 取品牌对应色）/当前色大色块
6. **StatsPanel**：总览（cm/板数/豆数/色数）+ Top colors 点击高亮（交互层遮罩）+ 已用/全部页签 + 换色/清除/批量删色（多选+搜索排序）/一键去噪 + Readiness 自检区
7. **参考层**：refCanvas 上下位置切换/不透明度/开关；接 lib/storage 分层存储（IndexedDB 参考图）
8. **NewDialog**：规格↔板型联动（2.6mm 禁 5mm 板提示）+ 品牌三选 + cm/板数实时；创建后品牌锁定
9. **自动保存与工程往返**：30s requestIdleCallback + beforeunload；工程 JSON 导入导出 UI 入口（调 lib/storage）
10. **BrandSwitchDialog**：映射预览 + 一键应用 + 角标 + 单条 undo + 明细逐格改
11. **Studio 页组装 + 全流程自查**：新建→绘制→换色/去噪→高亮→参考层→保存→刷新恢复→JSON 往返；绘制响应 ≤100ms 实测记录

## 验证命令

`(cd px-creat-web && pnpm exec tsc --noEmit && pnpm test && pnpm lint && pnpm build)`

## 回滚点

每步独立提交粒度（task 归档时统一 auto-commit）；cells 数据结构（Int16Array）与 undo diff 格式若需变更，必须回写本文件与 design.md。

## 人工验收（实现代理完成后由主会话执行）

vite preview + 浏览器实测：快捷键全表、绘制流畅度、双主题下画布对比度、自动保存恢复、Readiness 提示真实性。
