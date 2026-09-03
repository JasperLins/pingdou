# src/data · 色板数据（唯一权威来源）

MARD / COCO / Perler / Hama / Artkal 五品牌 1,386 色的 CSV 数据入库位置（m1 任务从 beadcolors 拉取）。

约定（根 AGENTS.md §4）：

- 本目录是全生态（px-creat-web / server / 小程序）色板数据的**唯一权威来源**，各端不得自建副本；
- 数据结构：`BeadColor { brand, code, name, rgb, colorType? }`，特殊效果色带 `colorType` 标记，默认不参与自动匹配；
- 构建期内置进产物，由 `src/lib/palettes.ts` 解析。
