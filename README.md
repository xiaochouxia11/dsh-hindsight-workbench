# Hindsight 记忆工作台

DeepSeek Harness（DSH）的简体中文只读记忆界面：在 DSH 左侧栏打开独立页面，查看本机 [Hindsight](https://github.com/vectorize-io/hindsight) 记忆库的连接状态、统计、记忆原文、关键词搜索、知识页与关联，以及本机已安装的 DSH 技能。

界面只读浏览，不采集对话、不写入或删除记忆。

## 功能

- **记忆库切换**：自动列出本机 Hindsight 中的记忆库（同一 `coding-agent::` 命名空间），下拉切换后立即重读数据，选择会记住。
- **总览**：连接状态、事实数、关联数、文档数、待处理操作。
- **记忆列表**：项目库 / 全局库 / 联合搜索三种范围；每页 30 条，可翻页；关键词搜索原文与上下文；按事实类型显示中文标签。
- **记忆详情**：原文、时间、类型、实体、标签、元数据、已有关系图（按需读取）。
- **知识库**：知识页树与正文阅读，支持页内选择与关键词命中。
- **技能**：列出 `DSH_HOME/skills` 下带 `SKILL.md` 的技能（名称、描述、目录 id）。技能不属于 Hindsight 记忆库，这里只做只读展示。
- **安装检查**：本机服务健康、项目/全局记忆库状态、上游采集器挂载情况与安装步骤；服务未启动时给出启动提示。

## 安装

安装在 DSH 应用内完成，插件自带上游采集集成依赖 `@vectorize-io/hindsight-coding-agents@0.8.8`，**不需要另外安装采集器**：

1. 打开 DSH 的插件管理 / 插件市场，搜索 `Hindsight 记忆工作台` 或 `dsh-hindsight-memory`，安装并启用；
2. 或在插件管理里用 GitHub 源安装：`github:xiaochouxia11/dsh-hindsight-memory#v0.1.0`；
3. 安装后刷新页面或重开 DSH，左侧栏出现「Hindsight 记忆工作台」，也可以按 `Alt+Shift+H` 打开。

工作台依赖本机已有 Hindsight 后端（默认 `http://127.0.0.1:9077`）。后端、Python/uv 运行环境、模型授权不属于本插件安装范围，请按 Hindsight 官方文档准备；后端不可用时页面会显示连接不可用，不会崩溃。

## 配置

宿主配置字段（由 DSH 官方配置能力提供，界面没有保存连接的表单）：

```json
{"endpoint":"http://127.0.0.1:9077","bank":"project-bank-id","globalBank":"global-bank-id"}
```

- `endpoint` 仅接受无凭证的本机回环 HTTP origin（`127.0.0.1` 或 `[::1]`，端口可改）。
- `bank` 与 `globalBank` 必须不同；未配置时默认使用 `coding-agent::default` / `coding-agent::global`，页面打开后会自动切换到后端实际存在的第一个记忆库。
- 只允许切换到与绑定库同一命名空间（`::` 前缀相同）的记忆库；其他库名会被忽略。

## 只读边界

- 宿主只注册固定 GET allowlist（健康、统计、记忆库列表、记忆列表/详情、知识页树/正文、关系、技能清单），不提供任意 URL 代理，不暴露 recall/reflect 或任何写入接口。
- 前端渲染纯文本，不执行 HTML、不加载外部资源。
- 严格 UTF-8 解码，解码失败与疑似异常文本分别提示；请求 12 秒超时、响应上限 16 MB。
- 官方上游清单只返回白名单状态字段，不读取凭证。

## 构建与测试

需要 Node.js 20+：

```sh
npm run build   # 复制 src → dist
npm test        # 26 项回归测试
npm run check:public-pack   # 公开包内容预检（需 npm）
```

宿主入口 `dist/index.js`，客户端入口 `dist/client.js`。

## 许可

MIT，见 [LICENSE](LICENSE)。
