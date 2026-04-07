import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const legacyRoot = path.join(repoRoot, 'legacy', 'python');

const candidates = [];
const envPython = process.env.PYTHON?.trim();

if (envPython) {
  candidates.push(envPython);
}

candidates.push('python3');
candidates.push('python');

let lastResult = null;

for (const candidate of candidates) {
  const result = spawnSync(candidate, ['-m', 'unittest', 'discover', '-s', 'tests', '-v'], {
    cwd: legacyRoot,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error && result.error.code === 'ENOENT') {
    lastResult = result;
    continue;
  }

  if (result.error) {
    console.error(`[legacy:python-baseline] 启动 ${candidate} 失败:`, result.error.message);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

const tried = candidates.join(', ');
console.error(
  `[legacy:python-baseline] 未找到可用的 Python 解释器。已尝试：${tried || 'PYTHON, python3, python'}`
);

if (lastResult?.error?.message) {
  console.error(`[legacy:python-baseline] 最后一次错误：${lastResult.error.message}`);
}

process.exit(1);
