# M1 lib 算法层：色彩/色板/转换/导出纯函数库

## Goal

实现 px-creat-web 的核心算法层 `src/lib/`：色彩科学、色板管理、图片转图纸管线、图纸 PNG 渲染、工程持久化——全部纯函数、与 UI 解耦、Vitest 单测覆盖。技术选型遵循需求文档 §4.3.4（讨论确认为稳定基线）。

## Requirements

- `types.ts`：Project（对齐工程 JSON schema §4.8：v/title/brandKey/w/h/cells/finish）、BeadColor{brand,code,name,rgb,colorType?}、BOM 行（预留 brand/code/count）、工具类型。
- `color.ts`：sRGB→CIELAB、CIEDE2000 色差；跨品牌近似色提示（不做硬映射）。
- `palettes.ts`：五品牌色板（MARD 291/COCO 293/Perler 103/Hama 92/Artkal R89+S199+A145+C174）加载、按色系分组、搜索；特殊效果色标记不参与默认匹配。
- 色板 CSV 数据源：从 beadcolors（MIT License）重新拉取（本工作区无既有数据），放 `src/data/`，入库时校验唯一色号无重复。
- `converter.ts`：转换管线——阶梯式减半+区域平均降采样、双模式代表色（平滑=区域平均 / 卡通=量化取众数）、CIEDE2000 最近色匹配、默认无抖动、量化 5bit 缓存、Alpha 直通+边缘扩散式纯色背景移除；**目标色数参数 targetColors**（可选，0=不限；先做色板子集聚类/贪心选子集、再逐格匹配，2026-09-04 定案）。
- `patternSheet.ts`：图纸 PNG 渲染（网格图案区 + 每 5 格坐标刻度 + 底部图例色块/色号/颗数），供导出与预览共用。
- `storage.ts`：工程 localStorage 自动保存（30s 周期）与导入导出；**分层存储**——localStorage 只存工程数据，参考图存 IndexedDB，导出 JSON 内嵌参考图、导入时优先取内嵌图（2026-09-04 定案）。
- `analytics.ts`：本地匿名事件接口留位（editor_open/import_convert/finish_preset_apply 等，不上报）。
- 转换支持 Web Worker 化调用封装（104×104 计算不放主线程）。

## Acceptance Criteria

- [ ] 五品牌 1,386 色入库，逐文件唯一色号校验通过
- [ ] 104×104 目标网格 + 291 色板转换 ≤2s（含量化缓存；缓存命中典型素材 <200ms 量级）
- [ ] 卡通模式产出硬边色块（无抖动、无边缘染灰）；平滑模式适配照片；targetColors=16 时产出色号数 ≤16
- [ ] 分层存储：localStorage 自动保存不含参考图大对象；含内嵌参考图的工程 JSON 导入后可恢复参考层
- [ ] Vitest 单测覆盖：CIEDE2000 已知值、转换管线（含透明背景直通与纯色移除）、patternSheet 图例统计
- [ ] `tsc --noEmit` 零错误，lib/ 无 React import

## Notes

- 依赖：不依赖 M0 的 UI（仅要求仓库内可运行 Vitest），可并行。
- 边界提示（文档 §4.3.5 纳入）：低分辨率(<100×100)与近纯色图片返回可判别错误码。
