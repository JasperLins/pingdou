# src/components/editor · 编辑器组件（占位）

m2 编辑器任务落地以下组件（父任务 design.md 目录契约）：

- `CanvasStage` —— 画布舞台（网格渲染、绘制交互）
- `ToolRail` —— 工具栏（画笔/吸管/填充/矩形等）
- `PalettePanel` —— 色板面板（品牌切换、常用色）
- `StatsPanel` —— 统计面板（用色统计、规格显示）
- `ImportDialog` / `NewDialog` —— 转图/新建对话框

组件结构可参考 `lineone-ui-demo` 的高密度后台形态，但配色/圆角/字体必须走本站 token（tailwind.config.js + src/index.css），禁止 navy 后台风。
