import { describe, expect, it } from "vitest";
import { buildVideoUrl, buildWatchUrl, parseVideoRef } from "../../src/core/video-ref.js";

describe("core/video-ref", () => {
  it("支持从纯文本和 URL 解析 BV 号", () => {
    expect(parseVideoRef("BV1xx411c7mu")).toEqual(["bvid", "BV1xx411c7mu"]);
    expect(parseVideoRef("https://www.bilibili.com/video/BV1xx411c7mu?p=1")).toEqual(["bvid", "BV1xx411c7mu"]);
  });

  it("支持解析 av 号和纯数字 aid", () => {
    expect(parseVideoRef("av106")).toEqual(["aid", "106"]);
    expect(parseVideoRef("106")).toEqual(["aid", "106"]);
  });

  it("无法识别时会抛错", () => {
    expect(() => parseVideoRef("hello")).toThrow("无法识别视频标识");
  });

  it("buildVideoUrl 会优先使用 redirect_url", () => {
    expect(
      buildVideoUrl({
        redirect_url: "https://www.bilibili.com/bangumi/play/ep1",
        bvid: "BV1xx411c7mu",
      }),
    ).toBe("https://www.bilibili.com/bangumi/play/ep1");
  });

  it("buildWatchUrl 支持 bvid 与 aid", () => {
    expect(buildWatchUrl("bvid", "BV1xx411c7mu")).toBe("https://www.bilibili.com/video/BV1xx411c7mu");
    expect(buildWatchUrl("aid", "106")).toBe("https://www.bilibili.com/video/av106");
  });
});
