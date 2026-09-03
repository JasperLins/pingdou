# src/components/editor · 编辑器组件（m2 落地）

拼豆精修编辑器（M2）组件，视觉走本站 token（大圆角、pill、soft 阴影），组件结构可参考
`lineone-ui-demo` 但禁止 navy 后台风。数据流：组件 → zustand store（`store/project.ts` 工程
+ `store/editor.ts` 视图/工具/undo 栈）→ `lib/` 纯函数。

## 组件清单

- `CanvasStage.tsx` —— 四层 canvas（参考/绘制/网格/交互）+ DPR + 指针中心缩放 + 空格平移
  + rAF 脏区重绘 + 七工具指针交互 + 视图/参考层浮动控制条；烫染预览态（m4）切只读
  效果图（隐藏网格/色号/参考/交互层，对比或渲染未就绪时平面图纸兜底）
- `ToolRail.tsx` —— 左侧工具栏：七工具 + 笔刷 1–4 + 撤销/重做
- `PalettePanel.tsx` —— 色板面板：当前色大色块 / 常用色快捷行（CIEDE2000 品牌内就近解析）/
  最近使用 / 搜索 / 色系分组（含颗数徽标）
- `StatsPanel.tsx` —— 用量面板：Readiness 导出自检 / 总览（cm·板数·豆数·色数）/
  Top colors 点击高亮 / 已用·全部页签 / 换色·互换·清除·批量删色·去噪
- `NewDialog.tsx` —— 新建：入口两路径（空白画布/导入作品合并入口、从图片转图交棒 ImportDialog）
  + 规格（5mm/2.6mm）↔ 板型联动禁用提示 + 品牌五选（规格不匹配联动禁用）+ cm/板数实时
  + 可选参考图导入（挂参考层）
- `ImportDialog.tsx` —— 图片转图纸（m3）：idle→crop→config→converting→done 状态机宿主，
  done 步「进编辑器」= loadFrom 重建网格 + applyDiff 一条 undo + 原图挂参考层（透写下置）
- `BrandSwitchDialog.tsx` —— 品牌切换：CIEDE2000 映射预览 + 一键应用（单条 undo）+
  角标复查（reviewColors）+ 明细逐色改
- `useEditorShortcuts.ts` —— 快捷键全表（B/E/G/I、[ ]、空格、Ctrl+Z/Y、Esc、输入框守卫）；
  烫染预览态下空格=按住对比、Esc=返回编辑视图（m4）
- `useProjectAutoSave.ts` —— 30s requestIdleCallback 自动保存 + beforeunload/隐藏兜底
- `FinishPanel.tsx` —— 烫染效果面板（m4）：三组六预设缩略图横滑列表（当前作品 ≤24×24
  快照渲染，逐个替换）+ 强度滑杆 + 按住对比按钮；finish 写工程状态（§4.8），零 cells 副作用

## 辅助模块

- `boardSpec.ts` —— 规格/板型常量与换算（BOARD_PRESETS、cm、板覆盖数、品牌规格支持）
- `quickColors.ts` —— 24 个常用色目标值 → 当前品牌就近色号
- `Swatch.tsx` —— 色块（PalettePanel / StatsPanel 共用）
- `finishRender.ts` —— 烫染渲染支撑（m4）：色板数据构建 / 缩略图降采样 / 预览降级口径
  （>100×100 或低端设备 8px→4px）/ RGBA→dataURL / 平面图纸封面降级 / Worker 执行器注入
- `useFinishPreview.ts` —— 画布效果预览渲染调度（m4）：指纹缓存命中跳过、预设切换立即
  派发、强度 150ms 防抖、最新者胜
- `useFinishThumbnails.ts` —— 预设缩略图缓存（m4）：空闲期逐个渲染、品牌+cellsVersion
  指纹过期重算、失败记指纹防重试风暴
- `useFinishCover.ts` —— 效果封面（m4）：保存后空闲期异步生成全分辨率 PNG，失败降级
  平面图纸图，不阻塞保存
- `convert/` —— 转换流（m3）：`CropStep.tsx`（8 向手柄裁剪 + 主体缩放 + 源图类型三选 +
  豆宽预估）、`ConfigStep.tsx`（生成类型三卡 + 参数面板）、`CompareView.tsx`（150ms 防抖
  增量重跑，Worker via lib/converterClient）、`ResultCanvas.tsx`（结果渲染，对照/done 共用）、
  `imageIo.ts`（文件→≤2048 预压缩像素、像素→dataURL，DOM 依赖不进 lib）

## 约定

- cells 一切变更走 `useProjectStore` 的 action（`applyDiff` / `paintCells` / `recordStroke`），
  保证 undo 记录与 `lastDiff` 脏区信息；组件不得直接改 store.cells。
- 画布渲染为命令式（engine ref + rAF 调度），React 状态只承载低频 UI 值；
  指针 hover/预览不进 React state。
- 画布像素级不做单测（jsdom 无 2D context），组件冒烟见 `components.smoke.test.tsx`，
  渲染帧预算留浏览器人工验收（implement.md 人工验收节）。
