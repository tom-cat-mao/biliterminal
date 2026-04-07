import { beforeEach, describe, expect, it, vi } from "vitest";

const { renderMock, waitUntilExitMock, runReplMock } = vi.hoisted(() => ({
  renderMock: vi.fn(() => ({ waitUntilExit: vi.fn(async () => undefined) })),
  waitUntilExitMock: vi.fn(async () => undefined),
  runReplMock: vi.fn(async () => undefined),
}));

renderMock.mockImplementation(() => ({ waitUntilExit: waitUntilExitMock }));

vi.mock("ink", () => ({
  render: renderMock,
}));

vi.mock("../src/cli/repl.js", () => ({
  runRepl: runReplMock,
}));

import { main } from "../src/index.js";

describe("index/main", () => {
  beforeEach(() => {
    renderMock.mockClear();
    waitUntilExitMock.mockClear();
    runReplMock.mockClear();
  });

  it("无参数时默认进入 REPL", async () => {
    await expect(main([])).resolves.toBe(0);
    expect(runReplMock).toHaveBeenCalledOnce();
    expect(renderMock).not.toHaveBeenCalled();
  });

  it("tui 子命令会进入 Ink TUI", async () => {
    await expect(main(["tui"])).resolves.toBe(0);
    expect(renderMock).toHaveBeenCalledOnce();
    expect(waitUntilExitMock).toHaveBeenCalledOnce();
  });

  it("repl 子命令会进入 REPL", async () => {
    await expect(main(["repl"])).resolves.toBe(0);
    expect(runReplMock).toHaveBeenCalledOnce();
    expect(renderMock).not.toHaveBeenCalled();
  });
});
