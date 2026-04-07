import type { VideoItem } from "../../src/core/types.js";

export function makeVideoPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: "标题",
    owner: { name: "UP" },
    bvid: "BV1xx411c7mu",
    aid: 106,
    duration: 60,
    stat: {
      view: 123,
      danmaku: 4,
      like: 5,
      favorite: 6,
    },
    pubdate: 1_710_000_000,
    description: "简介",
    ...overrides,
  };
}

export function makeVideoItem(overrides: Partial<VideoItem> = {}): VideoItem {
  const base: VideoItem = {
    title: "标题",
    author: "UP",
    bvid: "BV1xx411c7mu",
    aid: 106,
    duration: "1:00",
    play: 123,
    danmaku: 4,
    like: 5,
    favorite: 6,
    pubdate: 1_710_000_000,
    description: "简介",
    url: "https://www.bilibili.com/video/BV1xx411c7mu",
    raw: {},
  };

  const merged = { ...base, ...overrides };
  const bvid = merged.bvid ?? null;
  const aid = merged.aid ?? null;
  const url =
    overrides.url ??
    (bvid
      ? `https://www.bilibili.com/video/${bvid}`
      : aid != null
        ? `https://www.bilibili.com/video/av${aid}`
        : base.url);

  return {
    ...merged,
    bvid,
    aid,
    url,
  };
}
