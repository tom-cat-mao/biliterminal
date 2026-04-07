import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const distEntry = path.join(repoRoot, "dist", "index.js");
const tsxBin = path.join(repoRoot, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");

const entryCommand = fs.existsSync(distEntry) ? process.execPath : tsxBin;
const entryPrefixArgs = fs.existsSync(distEntry) ? [distEntry] : [path.join(repoRoot, "src", "index.tsx")];

if (!fs.existsSync(distEntry) && !fs.existsSync(tsxBin)) {
  console.error("error: smoke 需要 dist/index.js 或本地 tsx 入口，请先安装依赖并构建");
  process.exit(1);
}

function runCase(name, command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    input: options.input,
    stdio: ["pipe", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    console.error(`\n[FAIL] ${name}`);
    console.error(`command: ${[command, ...args].join(" ")}`);
    console.error(result.stdout);
    console.error(result.stderr);
    process.exit(result.status ?? 1);
  }

  const combined = `${result.stdout}\n${result.stderr}`;
  for (const text of options.expect ?? []) {
    if (!combined.includes(text)) {
      console.error(`\n[FAIL] ${name}`);
      console.error(`missing text: ${text}`);
      console.error(combined);
      process.exit(1);
    }
  }

  process.stdout.write(`[OK] ${name}\n`);
}

runCase("help", entryCommand, [...entryPrefixArgs, "--help"], {
  expect: ["repl", "tui", "favorites"],
});

runCase("history", entryCommand, [...entryPrefixArgs, "history"], {
  expect: ["最近搜索", "最近浏览"],
});

runCase("repl-exit", entryCommand, [...entryPrefixArgs, "repl"], {
  input: "exit\n",
  expect: ["Bilibili CLI 已启动。", "bili>"],
});

runCase("repl-eof", entryCommand, [...entryPrefixArgs], {
  input: "",
  expect: ["Bilibili CLI 已启动。"],
});

runCase("tui-help", entryCommand, [...entryPrefixArgs, "tui", "--help"], {
  expect: ["进入全屏终端界面"],
});

if (process.platform !== "win32") {
  runCase("launcher-history", path.join(repoRoot, "biliterminal"), ["history"], {
    expect: ["最近搜索", "最近浏览"],
  });
}
