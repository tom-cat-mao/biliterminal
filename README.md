# BiliTerminal

一个轻量、低打扰、适合在终端里快速浏览 Bilibili 视频内容的客户端。

当前仓库已经完成 **Node.js + TypeScript 主线切换**：

- **唯一主运行时**：`src/` 下的 TypeScript + Ink
- **推荐启动方式**：直接运行 `./biliterminal`
- **归档参考实现**：`legacy/python/` 下的 Python 代码仅保留为历史参考，不再参与主运行链、主测试链与主打包链

## 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/teee32/biliterminal.git
cd biliterminal
```

### 2. 安装依赖

推荐使用 `pnpm`：

```bash
pnpm install
```

也支持：

```bash
npm install
bun install
```

### 3. 直接启动

推荐直接使用智能启动器：

```bash
./biliterminal
```

启动器当前顺序为：

1. `dist/index.js`
2. `pnpm exec tsx src/index.tsx`
3. `bunx tsx src/index.tsx`
4. `npm exec -- tsx src/index.tsx`

并且有一个明确约定：

- `node dist/index.js` / `tsx src/index.tsx` **无参数默认进入 REPL**
- `./biliterminal` **无参数默认进入 TUI**

因此既保留了原版模块入口语义，也保留了日常终端启动体验。

## 推荐运行方式

### TS 主线运行

直接运行源码：

```bash
pnpm exec tsx src/index.tsx history
pnpm exec tsx src/index.tsx trending -n 5
pnpm exec tsx src/index.tsx search 中文 -n 5
pnpm exec tsx src/index.tsx tui
pnpm exec tsx src/index.tsx repl
```

先构建再运行：

```bash
pnpm run build
node dist/index.js
node dist/index.js repl
node dist/index.js tui
node dist/index.js history
node dist/index.js --help
```

### 启动器运行

```bash
./biliterminal
./biliterminal recommend -n 5
./biliterminal search 中文 -n 5
./biliterminal favorite BV19K9uBmEdx
./biliterminal favorites
./biliterminal favorites open 1
./biliterminal comments BV19K9uBmEdx -n 3
```

## 当前能力范围

当前已覆盖的主能力：

- 首页推荐流
- 热门视频列表
- 入站必刷列表
- 分区榜单
- 首页热搜词
- 默认搜索词
- 关键词搜索
- 视频详情查看
- 视频评论预览
- 浏览器打开当前视频
- 本地收藏夹
- 最近搜索与最近浏览历史
- REPL
- 全屏 TUI
- TUI 中文直接输入搜索

当前**不处理**：

- 登录态
- 视频下载
- 评论发送 / 弹幕发送 / 投稿
- 直播 / 课程 / 专栏 / 动态等非视频主线
- Docker

## 开发命令

### 环境检查

```bash
pnpm run doctor
pnpm run doctor:full
```

### 类型检查 / 构建 / 测试

```bash
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run smoke
pnpm run ci
```

### 分模块测试

```bash
pnpm run test:core
pnpm run test:storage
pnpm run test:api
pnpm run test:cli
pnpm run test:tui
```

### legacy Python 基线

```bash
pnpm run legacy:python-baseline
# 或
cd legacy/python && python3 -m unittest discover -s tests -v
```

说明：

- `pnpm run legacy:python-baseline` 会自动切到 `legacy/python/` 并优先尝试 `python3`，必要时回退到 `python`
- 这条链路只用于历史行为对照
- 不再属于 TS 主线验收必跑项

### 多包管理器兼容验证

```bash
npm run typecheck
npm run test
npm run build

bun run typecheck
bun run test
bun run build
```

## 当前项目结构

```text
.
├── src/                     # TypeScript 主线
│   ├── api/                 # Bilibili API / parser
│   ├── cli/                 # CLI / REPL 分发
│   ├── core/                # 文本、格式、WBI、类型
│   ├── platform/            # 路径、浏览器打开
│   ├── storage/             # 历史与收藏夹
│   ├── tui/                 # Ink TUI
│   └── index.tsx            # TS 主入口
├── test/                    # Vitest 测试
├── tools/doctor.mjs         # 环境检查
├── tools/smoke.mjs          # Node 主线 smoke
├── bili_terminal/           # Node 启动转发 / macOS 打包脚本
├── legacy/python/           # legacy Python 参考实现与归档工具
├── docs/                    # 重构路线与清单
├── biliterminal             # 智能启动器
└── .github/workflows/ci.yml # CI
```

## 状态目录与历史文件

状态目录解析顺序如下：

1. `BILITERMINAL_STATE_DIR`
2. `BILITERMINAL_HOME/state`
3. 如果当前运行位置就是仓库根目录 / 开发工作区，则默认使用 `.omx/state`
4. 如果已存在 legacy 历史文件，则继续复用 `.omx/state`
5. 否则按平台默认目录

平台默认目录：

- macOS：`~/Library/Application Support/BiliTerminal/state`
- Linux：`$XDG_STATE_HOME/biliterminal` 或 `~/.local/state/biliterminal`
- Windows：`%APPDATA%\BiliTerminal\state`

默认历史文件名：

```text
bilibili-cli-history.json
```

这意味着：

- 老用户已有 `.omx/state/bilibili-cli-history.json` 时，会被自动沿用
- 新环境会优先走更合理的跨平台状态目录

## TUI 快捷键

- `↑/↓` 或 `j/k`：移动选中项
- `Enter`：进入详情页
- `Esc` 或 `b`：从详情页返回，或回到上一个列表状态
- `/` 或 `s`：输入搜索关键词
- `Tab` / `Shift+Tab`：切换首页分区
- `1-9`：直接切换首页对应分区
- `l`：重新执行最近一次搜索
- `d`：使用默认搜索词直接搜索
- `h`：回首页
- `v`：最近浏览
- `m`：收藏夹
- `f`：收藏 / 取消收藏当前视频
- `n/p`：翻页
- `PgUp/PgDn`：详情页滚动
- `o`：浏览器打开当前视频
- `c`：刷新评论
- `r`：刷新当前列表
- `?`：帮助浮层
- `q`：退出

## macOS 双击版

仓库里仍保留 macOS 双击打包脚本：

```bash
./bili_terminal/build_macos_app.sh
```

当前这条桌面打包链路已经切到 **Node.js + TypeScript payload**：

- `launch.command` 会优先使用应用包内 Node runtime
- 若包内 runtime 不可用，再回退到系统 Node 20+
- 应用包内不再复制 `bilibili_cli.py` 等 Python 运行文件

构建产物：

- `dist/BiliTerminal.app`
- `dist/BiliTerminal-macOS.zip`

## 重构路线文档

如果要查看当前 TS 重构路线与执行清单，可直接阅读：

- `docs/ts-refactor-roadmap.md`
- `docs/ts-refactor-checklist.md`

这两份文档定义了：

- 阶段重构计划
- 阶段测试要求
- 自动修复闭环
- 跨平台收口策略
- 最终验收链路

如果要直接查看“原版 Python 功能 / 接口 和当前 TS 主线”的一一对应关系，可继续阅读：

- `docs/python-ts-parity-mapping.md`

## 说明

- CLI 与 TUI 会为接口补齐浏览器请求头，降低被风控 412 的概率。
- 评论接口在权限受限或触发风控时，会尽量转成友好的终端提示。
- 当前 TS 主线已经具备类型检查、自动测试、构建、smoke、CI、跨平台路径适配和多包管理器兼容验证。
- `doctor:full` 默认验证 Node 主线 smoke，不再依赖 Python。
- `legacy/python/` 下的 Python 代码保留为 archive/reference，用于行为回溯，不再作为 fallback runtime。
- `ace` 语义检索在当前会话里可能不可用；最近一次实测返回 `404 Not Found`。这不影响本地代码重构主线，但会影响语义搜索效率。

## 致谢

本项目受 [LINUX DO](https://linux.do/) 社区启发和支持。
