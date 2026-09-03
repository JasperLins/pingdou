# M6 性能合并实测（自动生成，勿手改）

> 生成：2026-09-04 · 环境：Node v22.13.1 / win32 · 套件：px-creat-web `src/lib/acceptance.test.ts`
> 指令计数端（无真实光栅化）；浏览器端项目（绘制帧、自动保存、封面 ≤500ms）见 manual-checklist.md 主会话复测。

## 转换管线

| 场景 | 实测 | 指标 |
| --- | ---: | --- |
| 104×104 × MARD 291 色 cartoon（冷缓存，含 JIT 预热） | 47.6ms | ≤2s |
| 104×104 × MARD 291 色 cartoon（热缓存，3 次取最优） | 44.2ms | ≤2s |
| 29×29 targetColors=16 + 背景移除（Q 版场景） | 64.3ms | ≤2s |
## 编辑数据操作

| 场景 | 实测 | 指标 |
| --- | ---: | --- |
| getConnectedRegions（104×104 随机场） | 0.4ms | ≤50ms |
| denoiseStats(threshold=2) | 0.9ms | ≤50ms |
| denoise(threshold=2) | 1.5ms | ≤50ms |
| floodFill（全图空格填充） | 1.1ms | ≤50ms |
| mapCellsToPalette（24 色 → MARD 291 一键映射） | 6.3ms | ≤50ms |
## 图纸渲染

| 场景 | 实测 | 指标 |
| --- | ---: | --- |
| computeBom（104×104，24 色） | 0.2ms | ≤50ms |
| computeSheetLayout（sheet 完整版式） | 0.1ms | ≤50ms |
| renderPatternSheet（完整版式 + 图例，指令计数端） | 2.4ms | ≤100ms |
| renderPatternSheet（cellLabels 全开最重路径） | 2.2ms | ≤100ms |
## 烫染渲染

| 场景 | 实测 | 指标 |
| --- | ---: | --- |
| 55×63 @8px normal（单预设切换成本） | 61.9ms | ≤1s |
| 55×63 @8px towel（单预设切换成本） | 67.7ms | ≤1s |
| 55×63 @8px waffle（单预设切换成本） | 45.9ms | ≤1s |
| 55×63 @8px loofah（单预设切换成本） | 68.1ms | ≤1s |
| 55×63 @8px glitter（单预设切换成本） | 57.8ms | ≤1s |
| 55×63 @8px sequin（单预设切换成本） | 82.8ms | ≤1s |
| 55×63 六预设全循环累计 | 384.2ms | — |
| 104×104 @4px sequin（预览降级口径） | 70.2ms | ≤1s |
