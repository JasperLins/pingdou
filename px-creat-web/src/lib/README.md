# src/lib · 纯函数算法库

**硬性约束：本目录禁止 `import React` 与任何 DOM/浏览器 API 依赖**（父任务 design.md 目录契约）。

计划承载（m1–m5 任务落地）：

- `types.ts` —— 工程 JSON schema（§4.8）等核心类型
- `color.ts` —— CIELAB / CIEDE2000 色彩科学
- `palettes.ts` —— 五品牌色板解析与查询
- `converter.ts` —— 图片转图纸管线（区域平均、targetColors 聚类）
- `patternSheet.ts` —— 图纸 PNG / BOM CSV 导出
- `storage.ts` —— localStorage（工程数据）/ IndexedDB（参考图）分层存储
- `analytics.ts` —— 本地匿名埋点接口留位

所有公开函数须有显式类型签名与 TSDoc，是 UI 层唯一调用入口；必须可被 Vitest 独立单测。
