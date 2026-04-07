import nock from "nock";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BilibiliClient } from "../../src/api/bilibili-client.js";
import { BilibiliAPIError } from "../../src/core/types.js";
import { makeVideoPayload } from "../support/fixtures.js";

const VIDEO_PAGE_STATE =
  '<script>window.__INITIAL_STATE__={"abtest":{"comment_version_hash":"hash123"},"defaultWbiKey":{"wbiImgKey":"img","wbiSubKey":"sub"}};(function(){})</script>';

describe("api/bilibili-client", () => {
  beforeEach(() => {
    nock.disableNetConnect();
  });

  afterEach(() => {
    expect(nock.isDone()).toBe(true);
    nock.cleanAll();
    nock.enableNetConnect();
  });

  it("search 会过滤非 video 结果", async () => {
    nock("https://api.bilibili.com")
      .get("/x/web-interface/search/type")
      .query({ search_type: "video", keyword: "测试", page: 1 })
      .reply(200, {
        code: 0,
        data: {
          result: [
            { ...makeVideoPayload({ title: "视频A", author: "UP1", type: "video" }) },
            { type: "ketang", title: "课程B" },
          ],
        },
      });

    const items = await new BilibiliClient().search("测试", 1, 10);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("视频A");
  });

  it("popular 在接口报错时会抛出 BilibiliAPIError", async () => {
    nock("https://api.bilibili.com")
      .get("/x/web-interface/popular")
      .query({ pn: 1, ps: 10 })
      .reply(200, { code: -352, message: "-352" });

    await expect(new BilibiliClient().popular()).rejects.toBeInstanceOf(BilibiliAPIError);
  });

  it("popular 遇到 412 时会预热后重试", async () => {
    nock("https://api.bilibili.com")
      .get("/x/web-interface/popular")
      .query({ pn: 1, ps: 10 })
      .reply(412, "Precondition Failed")
      .get("/x/web-interface/popular")
      .query({ pn: 1, ps: 10 })
      .reply(200, {
        code: 0,
        data: {
          list: [{ ...makeVideoPayload({ title: "热门重试成功" }) }],
        },
      });

    nock("https://www.bilibili.com").get("/").reply(200, "ok");

    const items = await new BilibiliClient().popular();
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("热门重试成功");
  });

  it("warmup 会先访问首页再访问 referer", async () => {
    const visited: string[] = [];
    nock("https://www.bilibili.com")
      .get("/")
      .reply(() => {
        visited.push("home");
        return [200, "ok"];
      })
      .get("/video/BV1xx411c7mu")
      .reply(() => {
        visited.push("referer");
        return [200, "ok"];
      });

    await new BilibiliClient().warmup("https://www.bilibili.com/video/BV1xx411c7mu");
    expect(visited).toEqual(["home", "referer"]);
  });

  it("recommend 能解析首页推荐流条目", async () => {
    nock("https://api.bilibili.com")
      .get("/x/web-interface/index/top/feed/rcmd")
      .query(true)
      .reply(200, {
        code: 0,
        data: {
          item: [
            {
              ...makeVideoPayload({ title: "首页推荐", owner: { name: "UP1" } }),
              goto: "av",
            },
          ],
        },
      });

    const items = await new BilibiliClient().recommend();
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("首页推荐");
    expect(items[0].author).toBe("UP1");
  });

  it("trendingKeywords 会提取热搜展示词", async () => {
    nock("https://api.bilibili.com")
      .get("/x/web-interface/search/square")
      .query({ limit: 2, from_source: "home_search" })
      .reply(200, {
        code: 0,
        data: {
          trending: {
            list: [{ show_name: "原神" }, { keyword: "中文" }],
          },
        },
      });

    await expect(new BilibiliClient().trendingKeywords(2)).resolves.toEqual(["原神", "中文"]);
  });

  it("comments 在无 bvid 时会走默认热评接口", async () => {
    nock("https://api.bilibili.com")
      .get("/x/v2/reply/main")
      .query({ next: 0, type: 1, oid: 123, mode: 3, ps: 1 })
      .reply(200, {
        code: 0,
        data: {
          replies: [
            {
              member: { uname: "评论者" },
              content: { message: "评论内容" },
              like: 9,
              ctime: 1_710_000_000,
            },
          ],
        },
      });

    const comments = await new BilibiliClient().comments(123, 1);
    expect(comments).toEqual([{ author: "评论者", message: "评论内容", like: 9, ctime: 1_710_000_000 }]);
  });

  it("comments 在有 bvid 时会使用 WBI 主接口并合并置顶评论", async () => {
    nock("https://www.bilibili.com", {
      reqheaders: {
        referer: "https://www.bilibili.com/",
      },
    })
      .get("/video/BV1xx411c7mu")
      .reply(200, VIDEO_PAGE_STATE);

    nock("https://s1.hdslb.com")
      .get("/bfs/seed/jinkela/commentpc/bili-comments.hash123.js")
      .reply(200, 'encWbiKeys:{wbiImgKey:"img2",wbiSubKey:"sub2"}');

    nock("https://api.bilibili.com", {
      reqheaders: {
        referer: "https://www.bilibili.com/video/BV1xx411c7mu",
      },
    })
      .get("/x/v2/reply/wbi/main")
      .query((query) => {
        return (
          query.oid === "123" &&
          query.type === "1" &&
          query.mode === "3" &&
          query.plat === "1" &&
          query.web_location === "1315875" &&
          query.pagination_str === '{"offset":""}' &&
          typeof query.wts === "string" &&
          typeof query.w_rid === "string"
        );
      })
      .reply(200, {
        code: 0,
        data: {
          top_replies: [
            {
              rpid: 1,
              member: { uname: "置顶" },
              content: { message: "置顶评论" },
              like: 8,
              ctime: 1_710_000_000,
            },
          ],
          replies: [
            {
              rpid: 2,
              member: { uname: "普通" },
              content: { message: "普通评论" },
              like: 3,
              ctime: 1_710_000_001,
            },
          ],
        },
      });

    const comments = await new BilibiliClient().comments(123, 2, "BV1xx411c7mu");
    expect(comments.map((comment) => comment.author)).toEqual(["置顶", "普通"]);
  });

  it("comments 首次权限受限时会刷新 WBI key 后重试", async () => {
    nock("https://www.bilibili.com").get("/video/BV1xx411c7mu").times(2).reply(200, VIDEO_PAGE_STATE);

    nock("https://s1.hdslb.com")
      .get("/bfs/seed/jinkela/commentpc/bili-comments.hash123.js")
      .reply(200, 'encWbiKeys:{wbiImgKey:"oldimg",wbiSubKey:"oldsub"}')
      .get("/bfs/seed/jinkela/commentpc/bili-comments.hash123.js")
      .reply(200, 'encWbiKeys:{wbiImgKey:"newimg",wbiSubKey:"newsub"}');

    nock("https://api.bilibili.com")
      .get("/x/v2/reply/wbi/main")
      .query(true)
      .reply(200, { code: -403, message: "访问权限不足" })
      .get("/x/v2/reply/wbi/main")
      .query(true)
      .reply(200, {
        code: 0,
        data: {
          replies: [
            {
              member: { uname: "刷新后评论" },
              content: { message: "刷新成功" },
              like: 6,
              ctime: 1_710_000_002,
            },
          ],
        },
      });

    const comments = await new BilibiliClient().comments(123, 1, "BV1xx411c7mu");
    expect(comments[0].author).toBe("刷新后评论");
  });

  it("comments 持续权限受限时会抛出友好错误", async () => {
    nock("https://www.bilibili.com").get("/video/BV1xx411c7mu").times(2).reply(200, VIDEO_PAGE_STATE);

    nock("https://s1.hdslb.com")
      .get("/bfs/seed/jinkela/commentpc/bili-comments.hash123.js")
      .times(2)
      .reply(200, 'encWbiKeys:{wbiImgKey:"img2",wbiSubKey:"sub2"}');

    nock("https://api.bilibili.com")
      .get("/x/v2/reply/wbi/main")
      .query(true)
      .twice()
      .reply(200, { code: -403, message: "访问权限不足" });

    await expect(new BilibiliClient().comments(123, 1, "BV1xx411c7mu")).rejects.toThrow(
      "评论接口受限，请稍后重试或按 o 在浏览器中查看",
    );
  });
});
