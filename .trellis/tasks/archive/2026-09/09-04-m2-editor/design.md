# 技术设计 · M2 编辑器 MVP

## 1. 组件结构

```text
src/components/editor/
  CanvasStage.tsx        画布舞台（分层 canvas + 缩放平移 + 工具事件）
  ToolRail.tsx           工具栏（七工具 + 笔刷大小 + 撤销重做）
  PalettePanel.tsx       色板面板（搜索/分组/最近/快捷行/当前色）
  StatsPanel.tsx         用量面板（总览/Top colors 高亮/批量操作/Readiness）
  BrandSwitchDialog.tsx  品牌切换映射（一键映射+角标复查+明细）
src/pages/studio/Studio.tsx  组装（Grid 布局：左工具栏 / 中画布 / 右双面板，可折叠）
src/store/project.ts / editor.ts
src/lib/cellOps.ts       编辑器批量格子操作纯函数（见 §4）
```

## 2. 画布渲染策略（Canvas 分层 + 脏区重绘）

四个同尺寸绝对定位 canvas 叠层（下→上）：

| 层 | 内容 | 重绘时机 |
| --- | --- | --- |
| refCanvas 参考层 | 参考图（透写时在 cellCanvas 之下，对照时移到其上——DOM order 切换） | 图源/不透明度/位置变化 |
| cellCanvas 绘制层 | 豆格（方块底 + 圆形珠点），高倍率叠加色号首字母 | cells 脏区变化 |
| gridCanvas 网格层 | 网格线 + 每 5 格刻度加重；缩放自适应（格宽 <8px 隐藏色号首字母、<4px 省略次级线，pixel-beads 采纳） | 视口变化 |
| overlayCanvas 交互层 | 笔刷预览 / 图形工具预览 / 颜色高亮遮罩 | 指针移动 |

- 全部离屏合成后一次 `drawImage` 上屏；104×104 全量重绘预算 ≤16ms/帧
- 缩放：滚轮以指针为中心变换；平移：空格拖拽/中键；DPR 适配
- 绘制响应 ≤100ms：pointermove 节流到 rAF，笔刷走 Bresenham 连线防跳格

## 3. 状态设计（zustand）

- `store/project.ts` 工程态：title/brandKey/w/h/cells（Int16Array，-1 空）/finish/refImage 元信息；一切变更走 action（保证 undo 记录）；持久化调 lib/storage（30s requestIdleCallback 错峰 + beforeunload 落盘）
- `store/editor.ts` 视图/工具态：tool/colorIndex/brushSize/scale/offset/gridVisible/refMode(下/上)/refOpacity/recentColors(≤12)/undo 栈
- 撤销：**命令式 diff**（每笔操作 {indices[], before[], after[]}），栈 100 步；redo 对称；批量操作（换色/去噪/映射）单条记录

## 4. lib/cellOps.ts（纯函数，m2 新增 lib 模块）

floodFill（扫描线同色连片）、getConnectedRegions（4 邻接连通域）、denoise（面积 ≤ 阈值孤立域清除，阈值可配）、replaceColor / swapColors / clearColor、mapCellsToPalette（品牌切换批量映射，返回 diff + 映射表）。全部不可变：入参 cells 返回新数组 + diff。

## 5. 交互细节定稿

- 七工具：画笔/橡皮/油漆桶/直线/矩形/椭圆（预览层临时绘制，pointerup 提交）/吸管（I 或 Alt+点击）
- 快捷键：B/E/G/I、[ ]（笔刷 1–4 格方刷）、空格平移、Ctrl+Z / Ctrl+Shift+Z
- 色板：搜索（色号/名称）、色系分组、最近使用、**常用色快捷行**（固定 24 常用色目标值按 CIEDE2000 在当前品牌取对应色号）、当前色大色块
- StatsPanel：总览（规格/cm 物理尺寸/板数/豆数/色数）、Top colors（颗数+占比，**点击→交互层高亮该色全部格子**）、已用/全部页签、全局换色/清除颜色/**批量删色（多选）/已用色搜索排序**/**一键去噪** 入口、**Readiness 自检区**（色号有效/孤立碎色统计（denoise 干跑）/无待确认映射/统计完整）
- 品牌切换：BrandSwitchDialog 预览映射（源色→CIEDE2000 最近色表），一键全量应用 + 角标（overlay 层渲染 pendingMapped 集合）+ 单条 undo + 明细面板逐格改
- NewDialog：规格（5mm/2.6mm）↔ 板型（29/52/58/87/104 + 自定义 7–104 正方形；2.6mm 时禁用 5mm 板并提示）联动、品牌五选卡（规格不匹配联动禁用；"三选"口径 2026-09-04 修正为五品牌）、cm/板数实时显示

## 6. 性能与验收对照

- 绘制响应 ≤100ms（rAF + 脏区）；104×104 全量重绘 ≤16ms/帧；30s 自动保存不阻塞
- 验收流程：新建→绘制（七工具+快捷键）→换色/清除/去噪→高亮定位→参考层→保存→刷新恢复（localStorage 工程 + IndexedDB 参考图）→JSON 导出导入往返

## 7. 测试策略

- cellOps 全函数单测（含 104×104 随机场性能冒烟 ≤50ms）
- store 单测：undo/redo 深度与边界（100 步截断）、自动保存节流（mock timer）
- 组件冒烟：@testing-library（工具切换、快捷键绑定、面板渲染）
- 画布像素级不强测，留 Studio 人工验收（vite preview + 浏览器）

## 8. 待定与实现偏差记录（2026-09-04 实现代理回写）

实现与本文冲突处按保守方案落地，待主会话/后续任务定稿回写：

1. **spec（5mm/2.6mm）未进 lib §4.8 schema**。PRD 要求 cm/板数反馈与规格↔板型联动，但
   本任务约束"lib 只新增 cellOps.ts"，故 `spec` 以扩展字段存于 `store/project.ts`
   （`BeadSpec` 类型 + `DEFAULT_SPEC_BY_BRAND` 品牌缺省推导），随 localStorage 工程 JSON
   与导出 JSON 一并写入（读取端宽松解析：`loadPersisted` / Studio 导入路径从原始 JSON 提取）。
   后续应正式并入 `lib/types.ts` Project schema（v 保持 1，可选字段）并回写父任务契约。
2. **画布不做"全图离屏合成"**（§2 的"离屏合成后一次 drawImage"）。104×104 在 48px/格的全图
   缓冲约 100MB，不可行；改为**视口裁剪 + 按色批量 Path2D 直接分层绘制** + cells 脏区修补，
   性能预算不变（数据路径实测见任务报告；帧预算留浏览器验收）。
3. **undo 栈位置**：按本文放 editor store（数据），undo/redo 的执行（回写 cells、还原
   brandKey）在 project store——单向依赖 project → editor，避免循环 import。
4. ~~NewDialog 品牌三选 = MARD / COCO / Perler~~ **已修正（2026-09-04 复检后主会话改）**：
   `NEW_DIALOG_BRANDS` 开放全部五品牌，规格不匹配的经 `brandSupportsSpec` 联动禁用——
   "三选"原意是规格/板型/品牌三项选择，非三个品牌。
5. **色号首字母渲染上限**：格宽 ≥8px 且可见格数 ≤6000 时才绘制（防 fillText 超帧预算）；
   次级网格线 <4px 省略、5 格刻度线常显（与本文一致）。
6. **板型口径**（板数计算基准）：5mm → 29×29 标准互锁板，2.6mm → 52×52 迷你方板；
   29/87 为 5mm 专用、52/58 为 2.6mm 专用、104 双规格通用（`components/editor/boardSpec.ts`），
   实物板型数据待用户核对。

## 9. 浏览器人工验收记录（2026-09-04，主会话执行）

环境：vite preview 4180 + IAB 实测（注入合成图，DataTransfer 方式）。

- **绘制**：快捷行选 R13 → 画笔 3×3 方环 ✓，方块底+圆珠+高光渲染正确，StatsPanel 实时 R13×8/豆数 8 ✓
- **下透写（复检 P1 修复）**：注入参考图（蓝底笑脸 PNG）→ 空格区域透出参考图、豆环浮于其上、控制条"↓下 100%" ✓；上对照切换入口在位
- **自动保存与恢复**：确定性两轮——绘制后 31s tick 落盘（存档 2650B）→ 刷新 → 29×29 网格 + 3 颗红豆 + 参考图（IndexedDB）全部恢复、NewDialog 不弹 ✓
- **新建流程**：NewDialog 默认项创建成功；品牌五选卡与规格板型联动（smoke 测试 + 实测）✓
- **撤销/重做**：浏览器键盘实测被一次环境干扰中断（见下），以 21 个 store 单测证据（100 步边界/批量单条 undo）补位验收
- 面板能力（Readiness/Top colors 高亮/批量删色/去噪/已用·全部页签）UI 在位，行为由组件冒烟与 cellOps 单测覆盖
- **环境干扰记录**：验收中段 localStorage 全量清空一次（含 m0 主题键；应用代码无任何 clear 调用；确定性复测两轮无法复现）——判定为 IAB 面板侧外部操作所致，非应用缺陷；若后续复现需重查
- 结论：**m2 验收通过**（含复检 P1/P2 修复：透写底色跳过 + 双路径一致 + 规格切换回退 + 三选口径清理）
