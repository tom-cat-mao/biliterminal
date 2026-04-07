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

  it("支持进入详情页并返回列表", async () => {
    const client = createClient();
    const historyStore = new HistoryStore({ path: path.join(tempDir, "history.json") });
    const app = render(<BiliTerminalApp client={client as never} historyStore={historyStore} limit={2} />);

    await waitForAssertion(() => {
      expect(client.recommend).toHaveBeenCalledWith(1, 2);
      expect(app.lastFrame()).toContain("推荐视频 A");
    });

    app.stdin.write("\r");
    app.stdin.write("\n");
    app.stdin.write("\u001B[C");

    await waitForAssertion(() => {
      expect(client.video).toHaveBeenCalledWith("BV1xx411c7mu");
      expect(app.lastFrame()).toContain("详情页");
      expect(app.lastFrame()).toContain("详情简介");
    });

    app.stdin.write("b");

    await waitForAssertion(() => {
      expect(app.lastFrame()).toContain("列表 · 2 条");
      expect(app.lastFrame()).toContain("已返回列表");
    });
  });

  it("支持中文搜索输入与最近搜索重跑", async () => {
    const client = createClient();
    const historyStore = new HistoryStore({ path: path.join(tempDir, "history.json") });
    const app = render(<BiliTerminalApp client={client as never} historyStore={historyStore} limit={2} />);

    await waitForAssertion(() => {
      expect(app.lastFrame()).toContain("推荐视频 A");
    });

    app.stdin.write("/");
    await waitForAssertion(() => {
      expect(app.lastFrame()).toContain("搜索关键词:");
    });

    app.stdin.write("中文");
    await waitForAssertion(() => {
      expect(app.lastFrame()).toContain("搜索关键词: 中文");
    });

    app.stdin.write("\r");
    await waitForAssertion(() => {
      expect(client.search).toHaveBeenCalledWith("中文", 1, 2);
      expect(app.lastFrame()).toContain("搜索: 中文");
      expect(app.lastFrame()).toContain("中文 搜索结果");
    });

    app.stdin.write("h");
    await waitForAssertion(() => {
      expect(app.lastFrame()).toContain("分区: 首页");
    });

    app.stdin.write("l");
    await waitForAssertion(() => {
      expect(client.search).toHaveBeenCalledTimes(2);
      expect(app.lastFrame()).toContain("搜索: 中文");
    });
  });

  it("支持收藏并在收藏夹中查看已收藏视频", async () => {
    const client = createClient();
    const historyStore = new HistoryStore({ path: path.join(tempDir, "history.json") });
    const app = render(<BiliTerminalApp client={client as never} historyStore={historyStore} limit={2} />);

    await waitForAssertion(() => {
      expect(app.lastFrame()).toContain("推荐视频 A");
    });

    app.stdin.write("f");
    await waitForAssertion(() => {
      expect(historyStore.getFavoriteVideos(1)[0]?.title).toBe("推荐视频 A");
      expect(app.lastFrame()).toContain("已收藏");
    });

    app.stdin.write("m");
    await waitForAssertion(() => {
      expect(app.lastFrame()).toContain("收藏夹");
      expect(app.lastFrame()).toContain("推荐视频 A");
    });

    app.stdin.write("h");
    await waitForAssertion(() => {
      expect(app.lastFrame()).toContain("分区: 首页");
      expect(app.lastFrame()).toContain("推荐视频 A");
    });
  });

  it("支持切换首页分区并返回之前分区", async () => {
    const client = createClient();
    const historyStore = new HistoryStore({ path: path.join(tempDir, "history.json") });
    const app = render(<BiliTerminalApp client={client as never} historyStore={historyStore} limit={2} />);

    await waitForAssertion(() => {
      expect(app.lastFrame()).toContain("分区: 首页");
    });

    app.stdin.write("2");
    await waitForAssertion(() => {
      expect(client.popular).toHaveBeenCalledWith(1, 2);
      expect(app.lastFrame()).toContain("分区: 热门");
      expect(app.lastFrame()).toContain("热门视频 A");
    });

    app.stdin.write("b");
    await waitForAssertion(() => {
      expect(app.lastFrame()).toContain("分区: 首页");
      expect(app.lastFrame()).toContain("推荐视频 A");
    });
  });

  it("刷新评论后状态与评论内容保持一致", async () => {
    const commentsMock = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ author: "评论刷新", message: "新评论内容", like: 9, ctime: 1_710_000_001 } satisfies CommentItem]);
    const client = createClient({ comments: commentsMock });
    const historyStore = new HistoryStore({ path: path.join(tempDir, "history.json") });
    const app = render(<BiliTerminalApp client={client as never} historyStore={historyStore} limit={2} />);

    await waitForAssertion(() => {
      expect(commentsMock).toHaveBeenCalledTimes(1);
      expect(app.lastFrame()).toContain("当前视频暂无可显示热评");
    });

    app.stdin.write("c");
    await waitForAssertion(() => {
      expect(commentsMock).toHaveBeenCalledTimes(2);
      expect(app.lastFrame()).toContain("评论刷新");
      expect(app.lastFrame()).toContain("已加载评论 1 条");
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
