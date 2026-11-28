# Hindsight 记忆工作台的安装与使用

## 1. 在新电脑上首次安装

桌面用户可直接从插件管理器安装，依赖由 Harness 管理。使用官方命令行的用户先确认 `node --version` 和 `pnpm --version` 可执行，再运行下列命令。对已验证的 Harness CLI 0.2.2-rc.5，Node.js 需达到 24.9.0，测试使用 Node 24 和 pnpm 11.28.5。

```sh
dsh plugin --profile web add github:xiaochouxia11/dsh-hindsight-workbench#v0.3.0
dsh --profile web
```

官方 CLI 安装与宿主挂载由 [跨平台验收](https://github.com/xiaochouxia11/dsh-hindsight-workbench/actions/workflows/clean-harness.yml) 检查。每个平台的结果以当次运行记录为准。此验收包含本机笔记保存和重启恢复，AI 知识库和 Skill 创建仍需在目标电脑配置相应组件。

1. 打开本机 DeepSeek Harness 的「插件」页面。兼容版本由插件的 `engines.dsh` 声明，安装时由 Harness 校验。
2. 在已配置的市场中搜索「Hindsight 记忆工作台」或 `dsh-hindsight-workbench`。能否搜到取决于市场是否已收录和刷新。也可从仓库的 GitHub Releases 下载对应版本的 `.tgz`，再从 Harness 插件管理器安装该包。两个入口都应核对安装来源和版本。
3. 安装后按 Harness 提示启用或重新加载。从左侧栏打开「Hindsight 记忆工作台」，也可用 `Alt+Shift+H`。打开「检查」，依次核对 Hindsight 服务、记忆库和采集器。工作台默认使用简体中文。
4. 插件管理器会解析随包声明的 Hindsight 依赖并挂载工作台采集器。已有独立采集器的电脑应在「检查」中核对挂载，保留一个承担 Hindsight 采集职责的实例。
5. 没有 Hindsight 后端时，可先使用「长期记忆」和「进化」中的本机功能。Hindsight 记忆、语义召回和 AI 知识库另需后端。按 [Hindsight 官方部署指南](https://hindsight.vectorize.io/developer/installation) 准备运行环境、存储和嵌入环境。已有健康后端可以复用。安装包和向导提供检查与步骤，依赖下载和启动需在目标电脑执行。
6. 创建 DSH Skill 需要已启用的 `@michengai/dsh-skills-manager`。在「技能」页点击「添加 Skill」会检查该插件。打开「AI 知识库」会检查 Hindsight 1.3.0 的知识库接口。

## 2. 配置并核对记忆库

- 后端默认地址是 `http://127.0.0.1:9077`。宿主配置支持 `endpoint`、`bank` 和 `globalBank`。仅接受没有 URL 凭证的本机回环 HTTP 地址。后端模型与授权由 Hindsight 部署方配置。
- 全局范围绑定独立全局库。项目下拉只列出允许的项目库，并恢复最近一次仍可用的明确选择。项目下拉也会显示已有本机学习记录的库。界面选择按库 ID 生效，跨对话的自动采集所用库由上游映射决定。
- 联合查询分开显示项目和全局结果。任一库不可用时，其来源与错误会保留在页面。按含义召回使用所配置 Hindsight 后端的检索、嵌入和排序，结果按来源分组。

### 同名项目的自动采集隔离

工作台随包采集器基于会话启动目录的真实路径生成 `coding-agent::workspace-…` 库 ID。同名目录各自使用独立的库，Git 子目录和关联工作树默认使用主工作树对应的库。会话目录不可用时跳过该会话的自动召回与采集。

旧版按目录名生成的库仍可从工作台中选中并浏览。升级不自动合并旧记录。需要继续使用旧库或固定库 ID 时，在 Hindsight 的 `coding-agent.json` 中合并 `mapPathToBank`。配置文件通常位于 `~/.hindsight/coding-agent.json`，也可由 `HINDSIGHT_CONFIG` 指定。

```json
{
  "mapPathToBank": {
    "D:/work/client-a/app": "coding-agent::client-a-app",
    "D:/work/client-b/app": "coding-agent::client-b-app"
  }
}
```

保留文件中的其他配置和已有映射。完整退出并重开 Harness，以刷新采集器缓存。用不同的合成标记核对实际落库和召回，再在工作台选择对应的库。显式路径映射、静态库和自定义模板仍可控制路由，多条映射指向一个库时会共享记忆。

## 3. 日常使用

- **记忆**可浏览事实、观察原文、来源和版本。输入关键词后按回车，打开「按含义召回」可按语义检索。
- **自动学习**可在「进化」页按项目库或全局库查看。明确说出长期约定可直接保存，候选指令需在三个独立会话出现。流程有三次独立验证后可打开 Skill 草稿。可以归档不再使用的自动记录。
- **长期记忆**可把偏好、项目事实或经验手动保存到选定项目库或全局库，在之后的会话再次打开。支持搜索、编辑、归档及恢复。本机笔记与后端采集事实分别存储。
- **AI 知识库**可新建工作台知识库、导入 UTF-8 文本或 Markdown。索引完成后可查询并打开原文。
- **进化**可从一条记忆提炼 Skill 草稿。先核对依据并保存草稿，之后可恢复编辑。确认后从技能管理器创建 Skill。同名冲突保留正编辑的内容。
- **检查**显示服务与配置状态。连接成功、存在记忆数据、采集器已挂载和模型授权是独立结果。

## 4. 排错与换机

- **侧栏没有工作台**。检查插件是否启用、实际版本及生效提示，必要时先等运行中的任务结束，再正常退出并重开 Harness。
- **后端离线或 404**。分别核对服务地址、当前库是否存在，以及 Hindsight 版本是否提供所选接口。
- **换机后没有旧记忆**。安装包只包含程序。请先关闭两台电脑上的 Harness，再把旧电脑 `DSH_HOME/storages/dsh-hindsight-workbench` 中的本机笔记、进化草稿和学习日志备份到你控制的位置。仅在新电脑对应目录为空时复制这份备份，避免覆盖已使用的数据。Hindsight 数据请另用官方备份与恢复方法。记忆文件含个人或项目内容，请仅通过你控制的私有位置传输。
- **换机后同一个项目显示新库**。默认项目库由目录的真实路径计算，两台电脑的路径不同会生成不同库。要继续使用迁移过的库，查询旧电脑工作台中的库 ID，然后在新电脑按上面的 `mapPathToBank` 示例把新项目目录绑定到这一 ID。
- **回退插件**。在 Harness 插件管理器中选择已验证的安装包。个别组件卸载后，本机笔记、草稿和 Hindsight 数据由各自的存储管理。
