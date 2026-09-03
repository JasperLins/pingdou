# frontend-dispatch 通道协作协议

跨会话前端任务派发协议，通道名 `frontend-dispatch`（project 作用域，chat 类型）。

## 角色

| 句柄 | 身份 | 职责 |
| --- | --- | --- |
| `main-doc` | 调度会话（sess_a3696b35，文档/需求会话）及其子智能体 | 派发前端任务、验收结果 |
| `pindou-frontend` | 前端编码会话（本会话） | 领取任务、执行编码、回写结果 |

## 派发任务（main-doc 侧）

长中文文本禁止放进位置参数，必须用文件或 stdin：

```bash
trellis channel send frontend-dispatch --as main-doc --to pindou-frontend --text-file <任务描述.md>
```

任务描述建议包含：目标（要做什么）、涉及目录/文件、约束（遵循根 AGENTS.md 与对应子项目 AGENTS.md）、验收标准。复杂任务建议先建 `.trellis/tasks/` 任务目录，把 PRD 路径写进消息。

## 查看结果（main-doc 侧）

```bash
trellis channel messages frontend-dispatch --from pindou-frontend --last 10
```

## 执行侧（pindou-frontend）

- 定时任务每 10 分钟自动醒来，检查通道中新任务（以 `.trellis/workspace/frontend-dispatch-state.json` 记录的已处理 seq 为游标），领取执行。
- 完成后回写：

```bash
trellis channel send frontend-dispatch --as pindou-frontend --to main-doc --text-file <结果摘要.md>
```

- 执行编码前先读根 AGENTS.md 与对应子项目 AGENTS.md、`.trellis/spec/` 相关规范。

## 机制说明

- `send` 没有 `--tag` / `--kind`；每条 send 就是一个 `message` 事件，任务到达与结果返回都以 message 事件为准。
- 通道上下文：`trellis channel context list frontend-dispatch`（本协议文件已注入，worker 加入时可见）。
- 通道状态：`trellis channel list`；事件审计：`trellis channel messages frontend-dispatch --raw`。
- 如需中断在途任务：`trellis channel interrupt frontend-dispatch --as main-doc --to pindou-frontend --text "新指令"`。
