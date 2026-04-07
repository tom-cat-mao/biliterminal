import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultHistoryPath, defaultStateDir } from "../../src/platform/paths.js";
import { HistoryStore } from "../../src/storage/history-store.js";
import { makeVideoItem } from "../support/fixtures.js";

function joinForPlatform(platformName: NodeJS.Platform, base: string, ...parts: string[]): string {
  const pathApi = platformName === "win32" ? path.win32 : path.posix;
  const normalizedBase = platformName === "win32" ? base.replace(/\//g, "\\") : base.replace(/\\/g, "/");
  return pathApi.join(pathApi.normalize(normalizedBase), ...parts);
}

describe("storage/history-store", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "biliterminal-history-"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("会在加载时修复关键词乱码并去重收藏", () => {
    const historyPath = path.join(tempDir, "history.json");
    fs.writeFileSync(
      historyPath,
      JSON.stringify(
        {
          recent_keywords: ["ä¸­æ", "ã, æ", "原神", "中文"],
          recent_videos: [
            { bvid: "BV1xx411c7mu", title: "标题", author: "UP", duration: "1:00", url: "https://www.bilibili.com/video/BV1xx411c7mu" },
          ],
          favorite_videos: [
            { bvid: "BV1xx411c7mu", title: "A", author: "UP", duration: "1:00", url: "https://www.bilibili.com/video/BV1xx411c7mu" },
            { bvid: "BV1xx411c7mu", title: "B", author: "UP", duration: "1:00", url: "https://www.bilibili.com/video/BV1xx411c7mu" },
            null,
          ],
        },
        null,
        2,
      ),
    );

    const store = new HistoryStore({ path: historyPath });
    expect(store.getRecentKeywords(5)).toEqual(["中文", "原神"]);
    expect(store.getFavoriteVideos()).toHaveLength(1);
    expect(store.getFavoriteVideos()[0].title).toBe("A");
  });

  it("会持久化最近搜索、最近浏览和收藏切换", () => {
    const historyPath = path.join(tempDir, "history.json");
    const store = new HistoryStore({ path: historyPath });
    const first = makeVideoItem({ title: "视频 A", bvid: "BV1xx411c7mu" });
    const second = makeVideoItem({ title: "视频 B", bvid: "BV1ab411c7mu", aid: 107, url: "https://www.bilibili.com/video/BV1ab411c7mu" });

    store.addKeyword("原神");
    store.addKeyword("原神");
    store.addVideo(first);
    store.addVideo(second);
    store.addVideo(first);
    expect(store.toggleFavorite(first)).toBe(true);
    expect(store.isFavorite(first)).toBe(true);
    expect(store.toggleFavorite(first)).toBe(false);
    expect(store.isFavorite(first)).toBe(false);
    expect(store.addFavorite(second)).toBe(true);

    const reloaded = new HistoryStore({ path: historyPath });
    expect(reloaded.getRecentKeywords(5)).toEqual(["原神"]);
    expect(reloaded.getRecentVideos(5).map((item) => item.title)).toEqual(["视频 A", "视频 B"]);
    expect(reloaded.getFavoriteVideos(5).map((item) => item.title)).toEqual(["视频 B"]);
  });

  it("默认路径优先支持显式环境变量", () => {
    expect(defaultHistoryPath({ env: { BILITERMINAL_STATE_DIR: "~/custom-state" }, homeDir: "/Users/tester", cwd: "/repo", platform: "darwin" })).toBe(
      "/Users/tester/custom-state/bilibili-cli-history.json",
    );

    expect(defaultHistoryPath({ env: { BILITERMINAL_HOME: "~/workspace-home" }, homeDir: "/Users/tester", cwd: "/repo", platform: "darwin" })).toBe(
      "/Users/tester/workspace-home/state/bilibili-cli-history.json",
    );
  });

  it("默认状态目录支持 Linux、Windows 与 legacy 回退", () => {
    expect(defaultStateDir({ env: { XDG_STATE_HOME: "/tmp/xdg-state" }, cwd: "/repo", homeDir: "/home/tester", platform: "linux", isWritable: () => true })).toBe(
      "/tmp/xdg-state/biliterminal",
    );

    expect(
      defaultStateDir({
        env: { APPDATA: "C:\\Users\\tester\\AppData\\Roaming" },
        cwd: "C:\\repo",
        homeDir: "C:\\Users\\tester",
        platform: "win32",
      }),
    ).toBe("C:\\Users\\tester\\AppData\\Roaming\\BiliTerminal\\state");

    const legacyCwd = path.join(tempDir, "legacy-repo");
    const legacyDir = path.join(legacyCwd, ".omx", "state");
    fs.mkdirSync(legacyDir, { recursive: true });
    fs.writeFileSync(path.join(legacyDir, "bilibili-cli-history.json"), "{}\n");
    expect(defaultStateDir({ cwd: legacyCwd, homeDir: "/home/tester", platform: "linux", env: {} })).toBe(joinForPlatform("linux", legacyCwd, ".omx", "state"));
  });

  it("平台默认状态目录不可写时会回退到 legacy 目录", () => {
    const cwd = path.join(tempDir, "sandbox-repo");
    fs.mkdirSync(cwd, { recursive: true });

    expect(defaultStateDir({ cwd, homeDir: "/Users/tester", platform: "darwin", env: {}, isWritable: () => false })).toBe(
      joinForPlatform("darwin", cwd, ".omx", "state"),
    );
  });
});
