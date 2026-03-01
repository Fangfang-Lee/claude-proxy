# 常见问题 FAQ

## 问题 1：使用国产模型时日志中仍有 Claude Haiku 的请求记录

### 症状

当你只使用国产模型（如 MiniMax、DeepSeek 等）而没有购买官方 Claude 模型时，发现在 Claude Code 的日志中仍然看到 `claude-haiku` 的请求记录，即使你已经将主模型切换到了国产模型。

### 原因

Claude Code 内部有一个机制：某些后台任务（如会话摘要）会使用 Haiku 模型来处理。这些后台任务由环境变量 `ANTHROPIC_DEFAULT_HAIKU_MODEL` 控制，**而不是**主模型 `ANTHROPIC_MODEL`。

当你通过 Claude Code UI 切换模型时，UI 只会修改顶层配置，但后台任务仍然会使用默认的 `claude-haiku` 模型。

### 解决方案

需要同时配置以下两个环境变量：

```json
{
  "env": {
    "ANTHROPIC_MODEL": "MiniMax-M2.5",              // 主模型 - 控制主要对话使用的模型
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "MiniMax-M2.5" // 后台任务模型 - 需要手动配置
  }
}
```

**配置步骤：**

1. 打开 Claude Proxy 应用
2. 点击"写入 Claude Code 配置"按钮
3. 在弹出的配置中，手动添加 `ANTHROPIC_DEFAULT_HAIKU_MODEL` 字段，值设置为你的国产模型名称
4. 保存配置

或者直接编辑 `~/.claude/settings.json` 文件，添加或修改 `ANTHROPIC_DEFAULT_HAIKU_MODEL` 字段。

### 说明

- `ANTHROPIC_MODEL`: 控制主要对话的 API 请求使用什么模型
- `ANTHROPIC_DEFAULT_HAIKU_MODEL`: 控制后台任务（如会话摘要）使用什么模型

将两者设置为相同的国产模型，即可确保所有请求都使用国产模型，不会产生任何官方 Claude 模型的调用。

---

## 问题 2：Claude Code 配置中的 model 字段是什么？

### 说明

在 Claude Code 的配置文件中，可能会看到顶层有一个 `"model"` 字段：

```json
{
  "model": "haiku",
  "env": {
    "ANTHROPIC_MODEL": "MiniMax-M2.5"
  }
}
```

- **顶层 `model`**: 主要影响 UI 显示和对话类别，**可以删除**
- **`env.ANTHROPIC_MODEL`**: 控制实际 API 请求的模型，**必须配置**
- **`env.ANTHROPIC_DEFAULT_HAIKU_MODEL`**: 控制后台任务模型，**必须配置**

### 建议

- 如果你只使用国产模型，可以删除顶层的 `model` 字段
- 确保 `env` 中的 `ANTHROPIC_MODEL` 和 `ANTHROPIC_DEFAULT_HAIKU_MODEL` 都配置为你的国产模型

---

## 问题 3：配置文件位置

Claude Code 配置文件位于：`~/.claude/settings.json`

代理规则配置位于：`~/Library/Application Support/claude-proxy/routes.json`
