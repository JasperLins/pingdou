# src/lib · 纯函数算法库

**硬性约束：本目录禁止 `import React`**（父任务 design.md 目录契约）。除下述例外，
模块不得访问浏览器运行时句柄（DOM/Worker），输入输出均为显式数据，可被 Vitest 独立单测。

**例外**：`converter.worker.ts`（Worker 线程入口）与 `converterClient.ts`（Worker 的
Promise 调用封装）使用浏览器 Worker 运行时；`finish.worker.ts` / `finishClient.ts`
同模式（烫染渲染 Worker 化，m4）；`storage.ts` 的 IndexedDB 适配器通过
`indexedDB` 全局句柄惰性打开连接。Worker 入口均由 Vitest + self 桩覆盖
（`converter.worker.test.ts` / `finish.worker.test.ts`）；两个 client 的真实 Worker
构造不进单测，随 UI 联调。管线测试走纯函数路径。

模块清单（m1 已落地，m4 增补 finish，m5 增补 bomCsv）：

- `types.ts` —— 工程 JSON schema（§4.8）、`BeadColor`、BOM 行、工具类型等核心契约
- `color.ts` —— 色彩科学：sRGB→CIELAB、CIEDE2000（Sharma 2005 修正）、HSL
- `palettes.ts` —— 五品牌色板解析/加载（`src/data/*.csv` 唯一权威来源）、色系分组、搜索、近似色查找
- `cellOps.ts` —— 编辑器格子批量操作（m2）：diff 基础/栅格化/油漆桶/连通域/去噪/
  换色/互换/清除/CIEDE2000 品牌映射，全部不可变（入参 cells 返回新数组 + diff）
- `converter.ts` —— 图片转图纸管线：阶梯减半+区域平均、双模式代表色、targetColors
  色板子集聚类、5bit 量化缓存、边缘扩散式背景移除、边界错误码
- `converter.worker.ts` / `converterClient.ts` —— 转换的 Worker 化执行（大图不占主线程）
- `finish.ts` —— 烫染效果管线（m4，§4.6.5）：熔融基底→高度场→法线→漫反射+高光→
  烫法特效→色调映射；`PRESET_PARAMS` 六预设参数集与管线解耦；确定性噪声
  （整数哈希→值噪声→fbm），同输入同输出；intensity=0 恒等退化为原色板色
- `finish.worker.ts` / `finishClient.ts` —— 烫染渲染的 Worker 化执行（输出 buffer transfer）
- `patternSheet.ts` —— 图纸 PNG 渲染：BOM 统计、版式布局（完整图纸/纯图版、格内色号标注
  放不下自动跳过、作者署名）、注入式 canvas 绘制指令
- `bomCsv.ts` —— BOM 清单 CSV 序列化（m5，§4.7）：表头 品牌/色号/色名/颗数/占比、
  末行总颗数、UTF-8 BOM + CRLF（Excel 中文兼容）、RFC 4180 字段转义
- `storage.ts` —— 分层存储（localStorage 工程 / IndexedDB 参考图）+ 工程 JSON 导入导出
- `analytics.ts` —— 本地匿名事件接口留位（不上报）
- `utils.ts` —— 通用工具（className 拼接等，m0）

所有公开函数有显式类型签名与 TSDoc，是 UI 层唯一调用入口。
