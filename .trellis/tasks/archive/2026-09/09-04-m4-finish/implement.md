# 执行计划 · M4 烫染预览

依据 prd.md 与 design.md。每步过四条验证（tsc/test/lint/build），保持可编译。

## 有序清单

1. **lib/finish.ts 管线骨架**：meltBase/heightField/normalFromHeight/lighting/tonemap + intensity 插值 + 预设参数结构（六 key）+ 单测（确定性/零副作用/六预设互异/intensity=0 色彩近似）
2. **normal 正常烫**：完整调通（基准预设，色彩保真）；vitest 基准用例（55×63 ≤CI 安全线）
3. **质感组**：towel 三层绒毛 / waffle 格纹 / loofah 网眼（各自 presetFx + 参数）
4. **闪亮组**：glitter 双层星芒 / sequin 亮片阵列+反光带（最难，含虹彩/镜面高光）
5. **finish.worker.ts + finishClient.ts**：transfer 封装 + self 桩冒烟
6. **store/finish.ts**：finish 会话态 + 缩略图缓存/过期重算 + finish 持久化接入 project store（§4.8 schema）
7. **FinishPanel**：缩略图横滑（分组/逐个替换）、强度滑杆（150ms 防抖）、对比按钮、Esc 返回
8. **画布预览态**：效果渲染上屏（隐藏网格/色号）、视图切换零副作用断言、效果封面异步生成（失败降级）+ 保存 ≤500ms 返回
9. **降级**：>100×100 或低端设备预览分辨率减半（导出不受影响）
10. **组件冒烟 + 浏览器人工验收准备**：六预设截图对照表（主会话执行）

## 验证命令

`(cd px-creat-web && pnpm exec tsc --noEmit && pnpm test && pnpm lint && pnpm build)`

## 回滚点

预设参数集（PRESET_PARAMS 结构）与 FinishInput 契约若需变更，回写 design.md；管线阶段函数签名变更须同步 worker 协议说明。

## 人工验收（实现后主会话）

浏览器注入图 → 编辑器 → FinishPanel：六预设缩略图逐个出图、切换 ≤1s、强度拖动防抖、按住对比、Esc 返回、cells 逐格不变（零副作用）；效果封面生成与降级路径。
