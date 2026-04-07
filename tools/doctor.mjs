import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const fullMode = process.argv.includes("--full");

function run(command, args = [], options = {}) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

function commandExists(command) {
  const locator = process.platform === "win32" ? "where" : "which";
  const result = run(locator, [command]);
  return result.status === 0;
}

function firstLine(value) {
  return (value || "").split(/\r?\n/).find(Boolean) || "";
}

function parseMajor(version) {
  const match = String(version).match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function isPathWritable(targetPath) {
  const resolved = path.resolve(targetPath);
  const probe = fs.existsSync(resolved) ? resolved : path.dirname(resolved);
  try {
    fs.accessSync(probe, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

const results = [];

function addResult(level, name, detail, hint = "") {
  results.push({ level, name, detail, hint });
}

function ok(name, detail, hint = "") {
  addResult("OK", name, detail, hint);
}

function warn(name, detail, hint = "") {
  addResult("WARN", name, detail, hint);
}

function fail(name, detail, hint = "") {
  addResult("FAIL", name, detail, hint);
}

ok("repo", repoRoot);
ok("platform", `${os.platform()} ${os.release()} (${os.arch()})`);
ok("cwd_tty", `stdout isTTY=${String(process.stdout.isTTY)}`, "非 TTY 会话下 TUI 交互测试应改走 tmux 或 node-pty");

const nodeMajor = parseMajor(process.versions.node);
if (nodeMajor !== null && nodeMajor >= 20) {
  ok("node", `v${process.versions.node}`);
} else {
  fail("node", `当前版本 v${process.versions.node} 低于要求 >=20`);
}

if (commandExists("npm")) {
  const npmVersion = firstLine(run("npm", ["--version"]).stdout);
  ok("npm", npmVersion || "已安装");
} else {
  fail("npm", "未找到 npm");
}

if (commandExists("pnpm")) {
  const pnpmVersion = firstLine(run("pnpm", ["--version"]).stdout);
  ok("pnpm", pnpmVersion || "已安装");
} else {
  warn("pnpm", "未找到 pnpm", "建议安装 pnpm 作为主包管理器");
}

if (commandExists("bun")) {
  const bunVersion = firstLine(run("bun", ["--version"]).stdout);
  ok("bun", bunVersion || "已安装");
} else {
  warn("bun", "未找到 bun", "仅影响兼容性验证，不阻塞主线开发");
}

if (commandExists("python3")) {
  const pythonVersion = firstLine(run("python3", ["--version"]).stdout || run("python3", ["--version"]).stderr);
  ok("python3", pythonVersion || "已安装");
} else {
  warn("python3", "未找到 python3", "若要继续使用现有 Python 基线测试，需要安装 Python 3");
}

if (commandExists("tmux")) {
  const tmuxVersion = firstLine(run("tmux", ["-V"]).stdout || run("tmux", ["-V"]).stderr);
  ok("tmux", tmuxVersion || "已安装");
} else {
  warn("tmux", "未找到 tmux", "TUI smoke 与截图链路会受影响");
}

if (commandExists("gh")) {
  const auth = run("gh", ["auth", "status"]);
  if (auth.status === 0) {
    ok("gh", "已登录 GitHub CLI");
  } else {
    warn("gh", "已安装但未登录", "后续若要直接查看或触发 GitHub Actions，需要先 gh auth login");
  }
} else {
  warn("gh", "未找到 gh", "不影响本地开发，但会影响 GitHub Actions 相关自动化");
}

const npmCacheResult = run("npm", ["config", "get", "cache"]);
if (npmCacheResult.status !== 0) {
  fail("npm_cache", firstLine(npmCacheResult.stderr) || "无法读取 npm cache 配置");
} else {
  const npmCache = firstLine(npmCacheResult.stdout);
  const insideRepo = path.resolve(npmCache).startsWith(repoRoot + path.sep) || path.resolve(npmCache) === path.join(repoRoot, ".cache", "npm");
  const writable = isPathWritable(npmCache);
  if (!insideRepo) {
    warn("npm_cache", npmCache, "建议继续使用仓库内 cache，避免全局 ~/.npm 权限污染");
  } else if (!writable) {
    fail("npm_cache", `${npmCache} 不可写`, "请检查仓库目录权限");
  } else {
    ok("npm_cache", `${npmCache} (repo-local & writable)`);
  }
}

const packageJsonPath = path.join(repoRoot, "package.json");
if (fs.existsSync(packageJsonPath)) {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  ok("package.json", `name=${pkg.name || "-"} packageManager=${pkg.packageManager || "-"}`);
} else {
  warn("package.json", "不存在", "若要继续 npm/pnpm scripts 自动化，建议创建 package.json");
}

if (fullMode) {
  const baseline = run("python3", ["-m", "unittest", "discover", "-s", "bili_terminal/tests", "-v"]);
  if (baseline.status === 0) {
    const summary = firstLine(
      [...baseline.stdout.split(/\r?\n/).reverse(), ...baseline.stderr.split(/\r?\n/).reverse()].find((line) =>
        /Ran \d+ tests?/.test(line),
      ) || "",
    );
    ok("python_baseline", summary || "Python baseline tests passed");
  } else {
    fail("python_baseline", "Python baseline tests failed", firstLine(baseline.stderr) || firstLine(baseline.stdout));
  }
}

const levelWeight = { OK: 0, WARN: 1, FAIL: 2 };
results.sort((a, b) => levelWeight[a.level] - levelWeight[b.level] || a.name.localeCompare(b.name));

console.log("BiliTerminal Doctor");
console.log("===================");
for (const item of results) {
  const prefix = item.level.padEnd(4, " ");
  console.log(`[${prefix}] ${item.name}: ${item.detail}`);
  if (item.hint) {
    console.log(`       hint: ${item.hint}`);
  }
}

const hasFailure = results.some((item) => item.level === "FAIL");
process.exit(hasFailure ? 1 : 0);
