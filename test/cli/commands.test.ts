import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/platform/browser.js", () => ({
  openUrl: vi.fn(async () => undefined),
  openVideoTarget: vi.fn(async (target: string) => `https://www.bilibili.com/video/${target}`),
}));

import * as browser from "../../src/platform/browser.js";
import { createCommandContext, resolveFavoriteItem, resolveTarget, runFavoritesOpen, runFavoritesRemove, runOpen } from "../../src/cli/commands.js";
import { HistoryStore } from "../../src/storage/history-store.js";
import { makeVideoItem } from "../support/fixtures.js";

describe("cli/commands", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "biliterminal-cli-"));
  });

  afterEach(() => {
    vi.clearAllMocks();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("resolveTarget 支持用上一次列表序号解析视频", () => {
    const items = [makeVideoItem({ bvid: "BV1xx411c7mu" })];
    expect(resolveTarget("1", items)).toBe("BV1xx411c7mu");
    expect(resolveTarget("BV1ab411c7mu", items)).toBe("BV1ab411c7mu");
  });

  it("resolveFavoriteItem 支持收藏夹序号与标识解析", () => {
    const store = new HistoryStore({ path: path.join(tempDir, "history.json") });
    const item = makeVideoItem({ title: "收藏视频", bvid: "BV1xx411c7mu" });
    store.addFavorite(item);

    expect(resolveFavoriteItem("1", store).title).toBe("收藏视频");
    expect(resolveFavoriteItem("BV1xx411c7mu", store).title).toBe("收藏视频");
  });

  it("runOpen 会按最近列表序号打开并写入历史", async () => {
    const store = new HistoryStore({ path: path.join(tempDir, "history.json") });
    const out = { log: vi.fn() };
    const ctx = createCommandContext({} as never, store, out);
    const item = makeVideoItem({ bvid: "BV1xx411c7mu", title: "打开测试" });
    ctx.lastItems = [item];

    await runOpen("1", ctx);
    expect(browser.openUrl).toHaveBeenCalledWith(item.url);
    expect(store.getRecentVideos(1)[0].title).toBe("打开测试");
  });

  it("runFavoritesOpen 会打开收藏并写入历史", async () => {
    const store = new HistoryStore({ path: path.join(tempDir, "history.json") });
    const out = { log: vi.fn() };
    const ctx = createCommandContext({} as never, store, out);
    const item = makeVideoItem({ title: "收藏打开", bvid: "BV1xx411c7mu" });
    store.addFavorite(item);

    await runFavoritesOpen("1", ctx);
    expect(browser.openUrl).toHaveBeenCalledWith(item.url);
    expect(store.getRecentVideos(1)[0].title).toBe("收藏打开");
  });

  it("runFavoritesRemove 会从收藏夹移除目标项", () => {
    const store = new HistoryStore({ path: path.join(tempDir, "history.json") });
    const out = { log: vi.fn() };
    const ctx = createCommandContext({} as never, store, out);
    store.addFavorite(makeVideoItem({ title: "待移除", bvid: "BV1xx411c7mu" }));

    runFavoritesRemove("1", ctx);
    expect(store.getFavoriteVideos()).toEqual([]);
    expect(out.log).toHaveBeenCalledWith("已移出收藏: 待移除");
  });
});
