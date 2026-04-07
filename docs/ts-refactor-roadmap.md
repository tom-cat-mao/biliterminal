# BiliTerminal TypeScript 自主重构路线

本文档记录本仓库从 Python 主实现切换到 Node.js + TypeScript 主实现的完整路线与最终收口状态。当前主线已经完成切换，后续继续维护时，默认以 **TS 唯一主运行时** 为准，Python 代码仅保留为 archive/reference。

## 1. 当前真实基线

截至当前仓库状态，已确认的事实如下：

- 已建立 TypeScript 工程主线：`package.json`、`tsconfig.json`、`vitest.config.ts`
- 已建立 TS 源码目录：`src/`
- 已建立首批测试目录：`test/`
- 已建立环境检查脚本：`tools/doctor.mjs`
- 已建立 GitHub Actions：`.github/workflows/ci.yml`
- 启动器已切到 Node-only：`./biliterminal`、`bili_terminal/start.sh`
- `node dist/index.js` 无参数默认进入 REPL，`./biliterminal` 无参数默认进入 TUI
- 已支持 `pnpm / npm / bun` 三条包管理器链路的基本兼容验证
- 已支持跨平台状态目录解析：macOS / Linux / Windows / legacy `.omx/state`
- 在 repo 根目录开发时默认回退到 `.omx/state`，避免开发态写入系统级目录
- `doctor:full` 已切换为 Node 主线 smoke，不再依赖 Python baseline
- GitHub Actions 三平台矩阵已实跑通过
- macOS `launch.command` 与 `.app` 打包 payload 已切到 Node + TS
- Python 代码已归档到 `legacy/python/`，但只作为参考实现与历史存档

当前已经验证通过的命令：

```bash
pnpm run doctor
pnpm run doctor:full
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run smoke
pnpm run ci
npm run typecheck
npm run test
npm run build
bun run typecheck
bun run test
bun run build
./biliterminal history
node dist/index.js --help
printf 'exit\n' | node dist/index.js
```

当前明确存在的非阻塞缺口：

- `ace` 语义检索在当前会话不可用，当前实测返回 `404 Not Found`

## 2. 总目标

最终目标不是“写一版 TS 代码”，而是交付一条可以自主推进、可重复执行、能反复修复失败并最终稳定收口的工程路线：

1. 以 TypeScript 作为唯一主实现与唯一主运行时。
2. 保留 Python 作为参考实现与历史归档，不再作为 fallback runtime。
3. CLI / REPL / TUI / API / 存储 / 平台适配全部纳入 TS 主线。
4. 所有阶段都必须具备自动验证命令。
5. 所有失败都必须进入“定位 -> 修复 -> 重测 -> 回归”的闭环。
6. 结果必须支持 macOS / Linux / Windows。
7. 包管理器至少保证 `pnpm` 主线、`npm` 与 `bun` 兼容。
8. 最终输出必须包含代码、测试、CI、文档、验收标准。

## 3. 范围边界

### 3.1 本路线覆盖范围

- 项目入口与启动器
- CLI 命令系统
- REPL
- TUI
- Bilibili API 访问层
- WBI 签名与评论链路
- 历史记录与收藏夹
- 跨平台路径与浏览器打开逻辑
- 自动测试
- CI
- README / 重构文档 / 验收文档

### 3.2 本路线暂不覆盖范围

- Docker
- 登录态
- 评论发送 / 弹幕发送 / 投稿
- 下载器功能
- 直播 / 专栏 / 课程 / 动态等非视频主线

## 4. 当前目标架构图

```text
                 ┌────────────────────┐
                 │ 启动入口层         │
                 │ biliterminal       │
                 │ bili_terminal/     │
                 └─────────┬──────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   dist/index.js     tsx 直接运行       legacy/python
                           │
                           ▼
                 ┌────────────────────┐
                 │ TS 主入口          │
                 │ src/index.tsx      │
                 └─────────┬──────────┘
                           │
             ┌─────────────┴─────────────┐
             │                           │
             ▼                           ▼
       ┌──────────────┐            ┌──────────────┐
       │ CLI / REPL   │            │ Ink TUI      │
       │ src/cli/*    │            │ src/tui/*    │
       └──────┬───────┘            └──────┬───────┘
              │                           │
              └─────────────┬─────────────┘
                            ▼
                    ┌──────────────┐
                    │ API / Parser │
                    │ src/api/*    │
                    └──────┬───────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
   ┌────────────┐   ┌────────────┐   ┌──────────────┐
   │ core/*     │   │ storage/*  │   │ platform/*   │
   │ 文本/格式  │   │ 历史/收藏   │   │ 路径/浏览器  │
   └──────┬─────┘   └──────┬─────┘   └──────┬───────┘
          └────────────────┴────────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ 质量保障层   │
                    │ vitest / CI  │
                    │ doctor       │
                    └──────────────┘
```

## 5. 自主执行原则

### 5.1 执行模式

每一阶段都必须遵守以下顺序：

1. 阅读当前相关代码与文档。
2. 确认本阶段的写入边界。
3. 先补或更新最小测试锚点。
4. 修改实现。
5. 跑本阶段最小验证。
6. 跑全链路回归。
7. 更新文档与阶段状态。

### 5.2 自主修复原则

只要出现失败，不停止在“报错说明”，而是进入完整修复循环：

```text
发现失败
  -> 分类失败类型
  -> 缩小范围
  -> 写补丁
  -> 运行最小重测
  -> 运行阶段回归
  -> 运行全链路回归
  -> 更新文档中的状态与风险
```

### 5.3 文档阅读原则

每次进入新阶段前，默认至少阅读：

- `AGENTS.md`
- `README.md`
- `package.json`
- `tsconfig.json`
- `vitest.config.ts`
- 对应阶段涉及的 `src/**` 文件
- 对应阶段涉及的 `test/**` 文件
- 必要时对照 `legacy/python/**` Python 参考实现

如果遇到依赖类型、框架行为或平台差异不清晰，再补充官方文档检索。

## 6. 分阶段路线

---

## 阶段 0：环境与基线冻结

### 目标

确认“当前机器 + 当前仓库 + 当前工具链”是可继续开发的状态，并把基线固定下来。

### 执行内容

- 运行 `doctor` 与 `doctor:full`
- 确认 Node、npm、pnpm、bun、python3、tmux、gh 状态
- 确认 npm cache 为仓库内可写路径
- 确认 Python baseline 可通过
- 确认 `pnpm install` 产物与 lockfile 稳定

### 自动验证

```bash
pnpm run doctor
pnpm run doctor:full
```

### 阶段通过标准

- `doctor` 无 FAIL
- `doctor:full` 无 FAIL
- Python baseline 可跑通

### 失败处理

- 环境失败：优先修工具链、路径、缓存、权限
- 非 TTY 问题：不要阻塞主线，改走测试/脚本/CI 验证

---

## 阶段 1：TS 主线可编译、可构建、可运行

### 目标

把 TS 工程从“脚手架”推进到“稳定主线”。

### 执行内容

- 保证 `src/index.tsx` 为唯一 TS 主入口
- 保证 CLI/TUI/REPL 都从 TS 入口出发
- 保证 `biliterminal` 与 `start.sh` 优先走 TS
- 保证 `dist/index.js` 可运行
- 保证 `pnpm / npm / bun` 三条链路均可跑 typecheck / build

### 自动验证

```bash
pnpm run typecheck
pnpm run build
npm run typecheck
npm run build
bun run typecheck
bun run build
./biliterminal history
node dist/index.js --help
```

### 阶段通过标准

- typecheck 全绿
- build 全绿
- 启动器可直接运行至少一个 CLI 命令

### 失败处理

- 类型错误：先修类型，再修逻辑
- 构建错误：优先检查 ESM、导入路径、JSX、构建入口
- 启动失败：优先检查 shebang、fallback 顺序、包管理器命令

---

## 阶段 2：核心能力与 Python 参考实现对齐

### 目标

把高价值业务逻辑从 Python 参考实现稳定映射到 TS 主线。

### 执行内容

重点对齐以下模块：

- `src/core/text.ts`
- `src/core/format.ts`
- `src/core/video-ref.ts`
- `src/core/wbi.ts`
- `src/api/parsers.ts`
- `src/api/bilibili-client.ts`
- `src/storage/history-store.ts`
- `src/cli/commands.ts`

需要逐项确认：

- 视频标识解析行为一致
- 中文宽度/截断/换行一致
- 搜索关键词乱码修复一致
- WBI 签名逻辑一致
- 评论合并与回退逻辑一致
- 收藏夹 / 历史记录行为一致
- 热门 / 推荐 / 搜索 / 热搜 / 详情 / 评论行为一致

### 自动验证

```bash
pnpm run test:core
pnpm run test:storage
pnpm run test:api
pnpm run test:cli
cd legacy/python && python3 -m unittest discover -s tests -v
```

### 阶段通过标准

- TS 测试覆盖核心模块
- Python 参考行为能被 TS 测试间接映射
- 常见异常路径有测试保护

### 失败处理

- 先补最小失败测试
- 再修实现
- 再补边界 case

---

## 阶段 3：TUI 交互可靠性收口

### 目标

把当前 Ink TUI 从“能跑”推进到“可稳定回归验证”。

### 执行内容

- 为 `src/tui/state.ts` 保持纯函数可测
- 为 `src/tui/App.tsx` 补交互级测试
- 覆盖列表切换、详情进入、返回栈、搜索提示、收藏切换、评论刷新、分区切换
- 确保非 TTY 场景下仍能通过测试而不是阻塞
- 保持布局简化策略，不盲目追求 Python curses 像素级复刻

### 自动验证

```bash
pnpm run test:tui
pnpm run test
```

### 阶段通过标准

- TUI 关键状态流有测试锚点
- TUI 失败能通过测试复现，而非只能靠人工交互复测

### 失败处理

- 纯状态问题优先下沉到 `tui/state.ts`
- 交互问题优先用 `ink-testing-library` 复现
- 不把 TUI 问题直接扩散成全局重构

---

## 阶段 4：跨平台与多包管理器收口

### 目标

保证 TS 主线在 Linux / macOS / Windows 下具有一致的执行逻辑。

### 执行内容

- 路径逻辑统一通过 `src/platform/paths.ts`
- 入口统一支持 `pnpm / npm / bun`
- CI 使用三平台矩阵验证
- 需要时为 Windows 路径、分隔符、默认目录补测试
- 保留 legacy `.omx/state` 自动回退

### 自动验证

```bash
pnpm run ci
npm run typecheck && npm run test && npm run build
bun run typecheck && bun run test && bun run build
```

### 阶段通过标准

- 本机三包管理器验证通过
- CI workflow 已覆盖三平台
- 状态目录路径在 Linux / Windows / macOS 都有明确规则

### 失败处理

- 本机失败：先看包管理器脚本与环境差异
- CI 失败：优先根据平台差异定点补路径/命令修复，不做大面积回退

---

## 阶段 5：异常修复闭环与重复失败治理

### 目标

建立“失败不会反复手工排查”的修复机制。

### 执行内容

把失败分为五类处理：

1. **类型失败**
   - 命令：`pnpm run typecheck`
   - 处理：修类型定义、返回值、泛型、第三方类型兼容

2. **单测失败**
   - 命令：`pnpm run test -- <target>` 或对应子目录测试
   - 处理：先最小复现，再修实现，再回归

3. **构建失败**
   - 命令：`pnpm run build`
   - 处理：检查入口、产物格式、导入路径、Node target

4. **运行失败**
   - 命令：`./biliterminal history`、`node dist/index.js --help`
   - 处理：检查启动器、fallback、脚本兼容、dist 可执行性

5. **网络/API 失败**
   - 命令：优先对应 `nock` 测试 + 单条 smoke
   - 处理：优先写稳定测试模拟，不把线上波动直接当代码正确性依据

### 自动修复策略

每次修复必须走：

```text
失败命令
  -> 最小范围命令
  -> 对应模块补丁
  -> 对应模块测试
  -> 全量测试
  -> 构建
  -> smoke
```

### 阶段通过标准

- 同类错误不重复手工分析多次
- 新错误必须能沉淀为测试或脚本化验证

---

## 阶段 6：文档同步与迁移说明

### 目标

让仓库文档与真实执行方式一致，避免“代码已切 TS，README 还像纯 Python 项目”。

### 执行内容

- 更新 `README.md`
- 明确主线启动方式是 TS
- 明确 Python 的定位为参考实现 / archive
- 补充：
  - 环境要求
  - 包管理器兼容说明
  - 跨平台状态目录说明
  - 测试命令
  - CI 命令
  - 常见失败处理
- 保留用户可直接复制执行的命令块

### 自动验证

- 回读 README
- 校对命令是否都能实际运行
- 确认 README 与 `package.json` 脚本一致

### 阶段通过标准

- README 与当前主线一致
- 文档不再误导使用者只走 Python

---

## 阶段 7：最终验收

### 目标

交付可阶段验收、可总体验收、可重复自测的完整重构结果。

### 必跑验收链路

```bash
pnpm run doctor
pnpm run doctor:full
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run ci
npm run typecheck
npm run test
npm run build
bun run typecheck
bun run test
bun run build
./biliterminal history
node dist/index.js --help
```

### 可选在线 smoke

在网络可用且接口未被风控的情况下，可继续跑：

```bash
./biliterminal trending -n 3
./biliterminal search 中文 -n 3
node dist/index.js recommend -n 3
```

### 最终通过标准

- TS 主线可独立运行
- 核心测试通过
- 构建通过
- CI 配置完备
- 三包管理器兼容验证通过
- 跨平台路径规则明确
- 文档同步完成

## 7. 每阶段需要输出的产物

每完成一个阶段，至少沉淀这些结果：

1. 代码变更
2. 对应测试
3. 可执行命令
4. 阶段状态说明
5. 若有新增行为，补 README 或专项文档

## 8. Codex 自主推进时的固定顺序

后续继续推进时，默认按这个顺序执行，不等待人工逐步指挥：

1. 先读 `AGENTS.md`、`README.md` 与相关代码
2. 确认当前阶段目标
3. 先补测试锚点
4. 修改实现
5. 跑最小测试
6. 跑全量 `typecheck + test + build`
7. 跑 smoke
8. 更新文档
9. 进入下一阶段

## 9. 当前推荐的下一执行阶段

按照当前仓库状态，主线本地重构已经跑通，剩余优先级如下：

1. 将当前结果推送到远端分支并触发 GitHub Actions 三平台矩阵
2. 依据远端矩阵结果修复平台特异问题（如果存在）
3. 再做一次最终发布前回归与分发整理

---

这份路线不是一次性说明文，而是后续自主推进 TS 重构的执行约束。只要没有新的更高优先级目标，后续默认继续按本路线推进。
