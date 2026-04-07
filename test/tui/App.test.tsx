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

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
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

  it("按 d 时会在默认词缓存为空时即时补拉并执行搜索", async () => {
    const searchDefaultMock = vi.fn().mockResolvedValueOnce("").mockResolvedValueOnce("补拉默认词");
    const searchMock = vi.fn().mockImplementation(async (keyword: string) => [
      makeVideoItem({ title: `${keyword} 搜索结果`, bvid: "BV1se411c7mu", aid: 109, url: "https://www.bilibili.com/video/BV1se411c7mu" }),
    ]);
    const client = createClient({
      searchDefault: searchDefaultMock,
      search: searchMock,
    });
    const historyStore = new HistoryStore({ path: path.join(tempDir, "history.json") });
    const app = render(<BiliTerminalApp client={client as never} historyStore={historyStore} limit={2} />);

    await waitForAssertion(() => {
      expect(searchDefaultMock).toHaveBeenCalledTimes(1);
      expect(app.lastFrame()).toContain("默认搜索: 按 / 开始搜索");
    });

    app.stdin.write("d");

    await waitForAssertion(() => {
      expect(searchDefaultMock).toHaveBeenCalledTimes(2);
      expect(searchMock).toHaveBeenCalledWith("补拉默认词", 1, 2);
      expect(app.lastFrame()).toContain("搜索: 补拉默认词");
      expect(app.lastFrame()).toContain("补拉默认词 搜索结果");
    });
  });

  it("按 r 刷新当前页时会强制重新拉取当前评论", async () => {
    const commentsMock = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ author: "刷新评论", message: "刷新后的评论内容", like: 9, ctime: 1_710_000_001 } satisfies CommentItem]);
    const client = createClient({ comments: commentsMock });
    const historyStore = new HistoryStore({ path: path.join(tempDir, "history.json") });
    const app = render(<BiliTerminalApp client={client as never} historyStore={historyStore} limit={2} />);

    await waitForAssertion(() => {
      expect(commentsMock).toHaveBeenCalledTimes(1);
      expect(app.lastFrame()).toContain("当前视频暂无可显示热评");
    });

    app.stdin.write("r");

    await waitForAssertion(() => {
      expect(commentsMock).toHaveBeenCalledTimes(2);
      expect(app.lastFrame()).toContain("刷新评论");
      expect(app.lastFrame()).toContain("刷新后的评论内容");
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

  it("按 j/k 移动选中项时不应重新拉取整个列表", async () => {
    const recommendMock = vi.fn().mockResolvedValue([
      makeVideoItem({ title: "推荐视频 A", bvid: "BV1xx411c7mu", aid: 106, description: "推荐简介 A" }),
      makeVideoItem({ title: "推荐视频 B", bvid: "BV1ab411c7mu", aid: 107, description: "推荐简介 B", url: "https://www.bilibili.com/video/BV1ab411c7mu" }),
    ]);
    const client = createClient({ recommend: recommendMock });
    const historyStore = new HistoryStore({ path: path.join(tempDir, "history.json") });
    const app = render(<BiliTerminalApp client={client as never} historyStore={historyStore} limit={2} />);

    await waitForAssertion(() => {
      expect(app.lastFrame()).toContain("编号 BV1xx411c7mu");
    });

    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(recommendMock).toHaveBeenCalledTimes(1);

    app.stdin.write("j");

    await waitForAssertion(() => {
      expect(app.lastFrame()).toContain("编号 BV1ab411c7mu");
    });

    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(recommendMock).toHaveBeenCalledTimes(1);

    app.stdin.write("k");

    await waitForAssertion(() => {
      expect(app.lastFrame()).toContain("编号 BV1xx411c7mu");
    });

    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(recommendMock).toHaveBeenCalledTimes(1);
  });

  it("快速切换首页分区时，过期列表请求不应覆盖最新结果", async () => {
    const recommendDeferred = createDeferred<ReturnType<typeof makeVideoItem>[]>();
    const client = createClient({
      recommend: vi.fn().mockImplementation(() => recommendDeferred.promise),
      popular: vi.fn().mockResolvedValue([
        makeVideoItem({ title: "热门视频 A", bvid: "BV1cd411c7mu", aid: 108, url: "https://www.bilibili.com/video/BV1cd411c7mu" }),
      ]),
    });
    const historyStore = new HistoryStore({ path: path.join(tempDir, "history.json") });
    const app = render(<BiliTerminalApp client={client as never} historyStore={historyStore} limit={2} />);

    await waitForAssertion(() => {
      expect(client.recommend).toHaveBeenCalledTimes(1);
    });

    app.stdin.write("\t");

    await waitForAssertion(() => {
      expect(client.popular).toHaveBeenCalledWith(1, 2);
      expect(app.lastFrame()).toContain("热门视频 A");
      expect(app.lastFrame()).toContain("分区: 热门");
    });

    recommendDeferred.resolve([
      makeVideoItem({ title: "过期推荐", bvid: "BV1old11c7mu", aid: 120, description: "旧结果" }),
    ]);

    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(app.lastFrame()).toContain("热门视频 A");
    expect(app.lastFrame()).not.toContain("过期推荐");
  });

  it("连续刷新评论时，过期评论响应不应覆盖最新结果", async () => {
    const oldComments = createDeferred<CommentItem[]>();
    const newComments = createDeferred<CommentItem[]>();
    const commentsMock = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockImplementationOnce(() => oldComments.promise)
      .mockImplementationOnce(() => newComments.promise);
    const client = createClient({ comments: commentsMock });
    const historyStore = new HistoryStore({ path: path.join(tempDir, "history.json") });
    const app = render(<BiliTerminalApp client={client as never} historyStore={historyStore} limit={2} />);

    await waitForAssertion(() => {
      expect(commentsMock).toHaveBeenCalledTimes(1);
      expect(app.lastFrame()).toContain("当前视频暂无可显示热评");
    });

    app.stdin.write("c");
    app.stdin.write("c");

    await waitForAssertion(() => {
      expect(commentsMock).toHaveBeenCalledTimes(3);
    });

    newComments.resolve([{ author: "最新评论", message: "新的评论结果", like: 9, ctime: 1_710_000_010 } satisfies CommentItem]);

    await waitForAssertion(() => {
      expect(app.lastFrame()).toContain("最新评论");
      expect(app.lastFrame()).toContain("新的评论结果");
    });

    oldComments.resolve([{ author: "旧评论", message: "过期评论结果", like: 1, ctime: 1_710_000_000 } satisfies CommentItem]);

    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(app.lastFrame()).toContain("最新评论");
    expect(app.lastFrame()).not.toContain("过期评论结果");
  });
});
