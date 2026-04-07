# BiliTerminal TypeScript 重构执行清单

本清单配合 `docs/ts-refactor-roadmap.md` 使用。

## A. 当前已完成

- [x] 建立 `package.json`
- [x] 建立 `tsconfig.json`
- [x] 建立 `vitest.config.ts`
- [x] 建立 `src/` TS 主线目录
- [x] 建立 `test/` 首批测试目录
- [x] 建立 `tools/doctor.mjs`
- [x] 建立 `.github/workflows/ci.yml`
- [x] `./biliterminal` 已切为 Node-only 启动器
- [x] `bili_terminal/start.sh` 已改为转发到 Node-only 启动器
- [x] `node dist/index.js` 无参数默认进入 REPL
- [x] `./biliterminal` 无参数默认进入 TUI
- [x] CLI `--help` 已公开 `repl` / `tui`
- [x] `pnpm run typecheck` 通过
- [x] `pnpm run test` 通过
- [x] `pnpm run build` 通过
- [x] `pnpm run smoke` 通过
- [x] `pnpm run ci` 通过
- [x] `npm run typecheck/test/build` 通过
- [x] `bun run typecheck/test/build` 通过
- [x] `doctor:full` 通过
- [x] 跨平台状态目录解析已建立
- [x] Repo 根目录默认落回 `.omx/state`，避免开发态写到系统目录
- [x] TUI 交互测试已覆盖详情 / 搜索 / 收藏 / 分区 / 评论
- [x] API 异常测试已覆盖 412 / WBI 刷新 / 权限受限
- [x] TUI `r` 已对齐为刷新列表并强制重拉评论
- [x] TUI `d` 已对齐为默认词为空时即时补拉
- [x] `doctor:full` 已切到 Node 主线 smoke
- [x] macOS `launch.command` 已切到 Node runtime
- [x] macOS `.app` 打包已改为 TS payload
- [x] README 已同步为 TS 主线说明
- [x] legacy Python 参考实现已归档到 `legacy/python/`

## B. 当前下一阶段

- [x] 扩充 `src/tui/App.tsx` 的交互级测试
- [x] 扩充 `src/api/bilibili-client.ts` 异常分支测试
- [x] 覆盖 412 预热重试场景
- [x] 覆盖 WBI key 刷新场景
- [x] 覆盖评论权限受限友好错误场景
- [x] README 改写为 TS 主线文档
- [x] 远端 GitHub Actions 三平台矩阵实跑确认
- [x] 根据远端结果补齐最终平台特异兼容修复
- [x] Python 已退出主运行链 / 主测试链 / 主打包链

## C. 每阶段固定动作

- [ ] 阅读 `AGENTS.md`
- [ ] 阅读 `README.md`
- [ ] 阅读本阶段相关 `src/**`
- [ ] 阅读本阶段相关 `test/**`
- [ ] 必要时对照 `legacy/python/**`
- [ ] 先补最小测试锚点
- [ ] 再修改实现
- [ ] 跑阶段最小测试
- [ ] 跑 `pnpm run typecheck`
- [ ] 跑 `pnpm run test`
- [ ] 跑 `pnpm run build`
- [ ] 跑 smoke 命令
- [ ] 更新文档

## D. 失败闭环清单

### 类型失败

- [ ] 运行 `pnpm run typecheck`
- [ ] 定位到具体文件与具体类型
- [ ] 修复后重跑 `pnpm run typecheck`
- [ ] 重跑 `pnpm run test && pnpm run build`

### 单测失败

- [ ] 先跑失败文件或失败目录
- [ ] 补最小复现
- [ ] 修复实现
- [ ] 重跑全量测试
- [ ] 重跑构建

### 构建失败

- [ ] 检查入口
- [ ] 检查导入路径
- [ ] 检查 ESM/JSX
- [ ] 重跑 build
- [ ] 重跑 smoke

### 运行失败

- [ ] 跑 `./biliterminal history`
- [ ] 跑 `node dist/index.js --help`
- [ ] 检查启动器与 fallback 顺序
- [ ] 修复后回归 `typecheck/test/build`

### API 失败

- [ ] 优先写 `nock` 复现
- [ ] 再修实现
- [ ] 先跑 `test/api`
- [ ] 再跑全量测试

## E. 最终验收必跑

- [x] `pnpm run doctor`
- [x] `pnpm run doctor:full`
- [x] `pnpm run typecheck`
- [x] `pnpm run test`
- [x] `pnpm run build`
- [x] `pnpm run smoke`
- [x] `pnpm run ci`
- [x] `npm run typecheck`
- [x] `npm run test`
- [x] `npm run build`
- [x] `bun run typecheck`
- [x] `bun run test`
- [x] `bun run build`
- [x] `./biliterminal history`
- [x] `node dist/index.js --help`
- [x] `printf 'exit\n' | node dist/index.js`
