import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "ink-testing-library";

vi.mock("../../src/platform/browser.js", () => ({
  openUrl: vi.fn(async () => undefined),
}));

import { BiliTerminalApp } from "../../src/tui/App.js";
import type { CommentItem } from "../../src/core/types.js";
import { HistoryStore } from "../../src/storage/history-store.js";
import { makeVideoItem } from "../support/fixtures.js";

function createClient(overrides: Record<string, unknown> = {}) {
  return {
    searchDefault: vi.fn().mockResolvedValue("默认搜索词"),
    trendingKeywords: vi.fn().mockResolvedValue(["热搜甲", "热搜乙"]),
    recommend: vi.fn().mockResolvedValue([
      makeVideoItem({ title: "推荐视频 A", bvid: "BV1xx411c7mu", aid: 106, description: "推荐简介 A" }),
      makeVideoItem({ title: "推荐视频 B", bvid: "BV1ab411c7mu", aid: 107, url: "https://www.bilibili.com/video/BV1ab411c7mu" }),
    ]),
    popular: vi.fn().mockResolvedValue([
      makeVideoItem({ title: "热门视频 A", bvid: "BV1cd411c7mu", aid: 108, url: "https://www.bilibili.com/video/BV1cd411c7mu" }),
    ]),
    precious: vi.fn().mockResolvedValue([]),
    regionRanking: vi.fn().mockResolvedValue([]),
    search: vi.fn().mockImplementation(async (keyword: string) => [
      makeVideoItem({ title: `${keyword} 搜索结果`, bvid: "BV1se411c7mu", aid: 109, url: "https://www.bilibili.com/video/BV1se411c7mu" }),
    ]),
    video: vi.fn().mockImplementation(async (ref: string) =>
      makeVideoItem({
        title: `详情 ${ref}`,
        bvid: ref.startsWith("BV") ? ref : "BV1xx411c7mu",
        aid: 106,
        description: "详情简介",
        url: ref.startsWith("BV") ? `https://www.bilibili.com/video/${ref}` : "https://www.bilibili.com/video/BV1xx411c7mu",
      }),
    ),
    comments: vi.fn().mockResolvedValue([
      { author: "评论者", message: "默认评论", like: 3, ctime: 1_710_000_000 } satisfies CommentItem,
    ]),
    ...overrides,
  };
}

async function waitForAssertion(assertion: () => void, timeout = 2000): Promise<void> {
  const startedAt = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      assertion();
      return;
    } catch (error) {
      if (Date.now() - startedAt > timeout) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
}

describe("tui/App", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "biliterminal-tui-"));
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("首页模式会加载推荐列表与首页元信息", async () => {
    const client = createClient();
    const historyStore = new HistoryStore({ path: path.join(tempDir, "history.json") });
    const app = render(<BiliTerminalApp client={client as never} historyStore={historyStore} limit={2} />);

    await waitForAssertion(() => {
      expect(client.recommend).toHaveBeenCalledWith(1, 2);
      expect(client.searchDefault).toHaveBeenCalledTimes(1);
      expect(client.trendingKeywords).toHaveBeenCalledWith(6);
      expect(app.lastFrame()).toContain("推荐视频 A");
      expect(app.lastFrame()).toContain("默认搜索: 默认搜索词");
      expect(app.lastFrame()).toContain("热搜: 热搜甲 · 热搜乙");
    });
  });

  it("首个视频缺少 aid 时会自动补拉详情并加载评论", async () => {
    const commentsMock = vi.fn().mockResolvedValue([{ author: "自动评论", message: "自动补拉成功", like: 7, ctime: 1_710_000_002 } satisfies CommentItem]);
    const client = createClient({
      recommend: vi.fn().mockResolvedValue([
        makeVideoItem({ title: "推荐视频 A", bvid: "BV1xx411c7mu", aid: null, description: "推荐简介 A" }),
        makeVideoItem({ title: "推荐视频 B", bvid: "BV1ab411c7mu", aid: 107, url: "https://www.bilibili.com/video/BV1ab411c7mu" }),
      ]),
      comments: commentsMock,
    });
    const historyStore = new HistoryStore({ path: path.join(tempDir, "history.json") });
    const app = render(<BiliTerminalApp client={client as never} historyStore={historyStore} limit={2} />);

    await waitForAssertion(() => {
      expect(client.video).toHaveBeenCalledWith("BV1xx411c7mu");
      expect(commentsMock).toHaveBeenCalledWith(106, 4, "BV1xx411c7mu");
      expect(app.lastFrame()).toContain("自动评论");
    });
  });

  it("当前视频已收藏时会在列表和预览中显示星标", async () => {
    const client = createClient();
    const historyStore = new HistoryStore({ path: path.join(tempDir, "history.json") });
    historyStore.addFavorite(makeVideoItem({ title: "推荐视频 A", bvid: "BV1xx411c7mu", aid: 106, description: "推荐简介 A" }));
    const app = render(<BiliTerminalApp client={client as never} historyStore={historyStore} limit={2} />);

    await waitForAssertion(() => {
      expect(app.lastFrame()).toContain("★ 推荐视频 A");
    });
  });

  it("评论加载失败时会展示浏览器回退提示", async () => {
    const client = createClient({ comments: vi.fn().mockRejectedValue(new Error("评论接口受限，请稍后重试或按 o 在浏览器中查看")) });
    const historyStore = new HistoryStore({ path: path.join(tempDir, "history.json") });
    const app = render(<BiliTerminalApp client={client as never} historyStore={historyStore} limit={2} />);

    await waitForAssertion(() => {
      expect(app.lastFrame()).toContain("评论加载失败");
      expect(app.lastFrame()).toContain("按 o 在浏览器查看完整评论");
    });
  });
});
