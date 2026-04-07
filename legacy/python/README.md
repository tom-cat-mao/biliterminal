# legacy/python

这里存放 BiliTerminal 原版 Python 实现的归档副本。

## 定位

- 只用于历史行为对照、截图回放与参考阅读
- 不再参与主运行链、主测试链、主打包链
- 当前仓库的唯一主运行时仍然是 `src/` 下的 Node.js + TypeScript 实现

## 推荐用法

从仓库根目录执行：

```bash
pnpm run legacy:python-baseline
```

这条脚本会：

- 自动进入 `legacy/python/`
- 优先尝试 `python3`
- 若当前环境没有 `python3`，再尝试 `python`

如果你想手动进入归档目录运行：

```bash
cd legacy/python
python3 -m unittest discover -s tests -v
```

## 目录说明

- `bili_terminal/`：原版 Python 包
- `tests/`：原版 Python 单测
- `tools/generate_readme_screenshots.py`：基于 tmux 的 README 截图生成脚本

## 额外依赖

截图脚本不是主线能力，按需使用。若要运行它，通常还需要：

- `tmux`
- `Pillow`

截图产物会写回仓库根目录下的 `assets/readme/`。
