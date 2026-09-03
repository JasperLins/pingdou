# 技术设计 · M4 烫染效果预览

> **2026-09-04 实现回写（回滚点协议）**：① `FinishInput` 增加可选 `pxPerCell`（1–24，默认 8；预览降级传更小值，导出不受影响），`paletteData` 定型为 `{ rgbs: RGB 平铺三元组, lum }`（可结构化克隆）；② finish{preset,intensity} 的权威数据落在 project store 既有 `finish` 字段（§4.8 schema，经 `setFinish` action 写入并标记未保存），store/finish.ts 只承载视图态（面板/预览/对比）+ 预览位图 + 缩略图缓存 + 效果封面——避免双源；③ Worker 输入 cells 走结构化克隆拷贝（不转移调用方缓冲），输出 rgba 走 buffer transfer。

## 1. lib 层：src/lib/finish.ts（纯函数管线，Worker 调用）

```text
输入：FinishInput { cells(Int16Array), w, h, paletteData(rgbs/lum), preset(FinishPresetKey), intensity(0-100) }
管线（对齐需求 §4.6.5，全 ImageData 逐像素，无 DOM）：
  1 meltBase()        熔融基底：豆格色块 + 隐约十字缝 + 中孔浅痕 + 轻微熔融模糊（盒滤）
  2 heightField()     高度场：豆圆顶（每格径向凸起）+ 烫法专属表面结构（见 §2 参数）
  3 normalFromHeight() 中心差分求法线
  4 lighting()        漫反射 + 高光（Blinn-Phong，光源方向固定左上）
  5 presetFx()        烫法特效层（绒毛/星芒/亮片阵列/格纹/网眼——各预设独立函数）
  6 tonemap()         色调映射：饱和/明度/暖偏/对比按 intensity 同系数插值
输出：Uint8ClampedArray(RGBA) + 宽高（由调用方 putImageData/drawImage）
```

- 强度插值：结构幅度/色彩偏移/光泽强度统一乘 `intensity/100`
- 零副作用：同输入同输出（可缓存指纹：cellsVersion+preset+intensity）
- 预览降级：>100×100 或低端设备按 0.5× 渲染再放大（导出不受影响）

## 2. 预设参数集（与管线解耦，便于调优）

`PRESET_PARAMS: Record<FinishPresetKey, PresetParams>`，参数组：表面结构（绒毛层数/星芒密度/亮片尺寸/格纹深度/网眼密度）、光照（高光强度/粗糙度）、色调（饱和/明度/暖偏/对比）。视觉基线为需求 §4.6.3 实现参考（非规格），最终以实物照片对照调优（验收素材待用户提供）。

| key | 预设 | 核心结构 |
| --- | --- | --- |
| normal | 正常烫 | 平整致密，柔和哑光，色彩保真基准 |
| towel | 毛巾烫 | 三层绒毛（低频簇+纤维束+单丝），强漫反射，偏暖降饱和 |
| glitter | 格利特烫 | 双层闪粉（大颗星芒十字臂+细闪糖霜），虹彩抖动 |
| sequin | 亮片烫 | 大颗亮片阵列+片间暗线+斜向反光带，镜面高光 |
| waffle | 华夫格烫 | 规则方格凹凸压痕，坑壁迎光面亮 |
| loofah | 搓澡巾烫 | 细密不规则网眼+织物经纬微纹理，偏灰做旧 |

## 3. Worker：src/lib/finish.worker.ts

**定稿协议（2026-09-04 实现后回写）**：flat 消息（无 id 信封）——请求 `{cells(结构化克隆拷贝), w, h, paletteData, preset, intensity, pxPerCell?}` → 成功 `{ok:true, rgba(buffer transfer), w, h}` / 失败 `{ok:false, message}`；finishClient 消费失败通道并 reject（spawn-per-call 专用 Worker 下 id 冗余，故弃用原 `{id,input}` 信封）。Promise 封装模式对齐 converterClient：每次调用 spawn module Worker、30s 兜底超时、terminate。性能红线：单次渲染 ≤1s、不冻结 UI。

## 4. 编辑器 UI

```text
components/editor/FinishPanel.tsx   滤镜式面板（右栏新页签或 Drawer）：
  - 预设缩略图横滑列表（当前作品低分辨率 24×24 快照渲染，逐个替换不阻塞）
  - 分组：经典(normal)/质感(towel/waffle/loofah)/闪亮(glitter/sequin)
  - 强度滑杆 0–100（停顿 150ms 防抖重渲染）
  - 对比按钮（按住显示平面图纸）+ 空格键同效
  - Esc 返回编辑视图（画布进入效果预览态：隐藏网格/色号，视图切换零副作用——不写 cells）
store/finish.ts                     finish{preset,intensity} 会话态 + 缩略图缓存（画布变更→标记过期重算）
```

- F6 持久化：finish 写入工程 JSON（§4.8 schema 已含）；保存 ≤500ms 返回；效果封面异步生成全分辨率 PNG（失败降级平面图不阻塞）
- 缩略图过期：cellsVersion 变化 → 面板缩略图标记过期 → 空闲时重算

## 5. 性能预算（§4.6.6）

单预设切换 ≤1s（55×63 基准）；面板首开全缩略图 ≤3s 逐个替换；强度防抖 150ms 后 ≤1s；移动端放宽 2s + 预览降级。基准用例入 vitest（CI 安全线放宽并注明 m6 实测）。

## 6. 测试

- 管线纯函数单测：同输入同输出（指纹缓存正确性）、intensity=0 近似原图色彩、六预设输出互异（统计差异断言）、零副作用（cells 不变）
- 预设参数结构测试（六 key 齐全、参数范围合法）
- Worker self 桩冒烟；组件冒烟（面板渲染/预设切换/Esc/对比按钮）
- 浏览器人工验收：六预设肉眼可区分 + 切换流畅 + 强度/对比交互（主会话执行）

## 7. 复核修复与浏览器验收记录（2026-09-04，主会话执行）

**复核问题修复**：P1 finishClient 吞掉 Worker 失败通道（ok:false 被 resolve，坏结果按指纹缓存）→ 已改为无 rgba 即 reject；P2-2 range 滑杆焦点拦截 Esc/空格 → isTypingTarget 排除 range；P2-3 空格粘滞 → keyup 无条件清 spaceHeld；P2-1 Worker 协议信封差异回写 §3。修复后四条验证全绿（286 测试）。

**浏览器实测**（preview 4182 + IAB）：
- 面板：三组六预设缩略图全部渲染（低清快照），强度滑杆/重置/按住对比/Esc 提示在位 ✓
- 正常烫：色块呈熔融豆阵（圆顶高光+缝隙+中孔痕），网格隐藏，色彩保真 ✓
- 亮片烫：大颗圆片+镜面斜向反光带+片间暗线，与正常烫差异鲜明（六预设肉眼可区分对所测两项成立，其余以缩略图+视觉模型走查为据）✓
- Esc 返回编辑态：面板关闭、网格恢复、豆块逐格原样（零副作用实测；代码级三层断言见复核报告 B-4）✓
- 挂账：六预设"贴近实物特征"待用户提供烫染实物照片后终验（prd Notes 既定）；参数集与管线解耦，届时只调参不改管线
- 结论：**m4 验收通过**
