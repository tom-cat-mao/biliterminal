export class BilibiliAPIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BilibiliAPIError";
  }
}

export interface VideoItem {
  title: string;
  author: string;
  bvid: string | null;
  aid: number | null;
  duration: string;
  play: number;
  danmaku: number;
  like: number;
  favorite: number;
  pubdate: number | null;
  description: string;
  url: string;
  raw: Record<string, unknown>;
}

export interface ListState {
  mode: AppMode;
  page: number;
  keyword: string;
  selectedIndex: number;
  channelIndex: number;
}

export interface CommentItem {
  author: string;
  message: string;
  like: number;
  ctime: number | null;
}

export type VideoRefType = "bvid" | "aid";
export type AppMode = "hot" | "search" | "history" | "favorites";

export const DEFAULT_TIMEOUT = 15_000;
export const DEFAULT_STATE_DIR = ".omx/state";
export const DEFAULT_HISTORY_FILENAME = "bilibili-cli-history.json";
export const MAX_HISTORY_ITEMS = 40;
export const MAX_FAVORITE_ITEMS = 200;
export const BILIBILI_PINK = "#FB7299";
export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

export interface HomeChannel {
  label: string;
  source: "recommend" | "popular" | "precious" | "region";
  rid?: number;
}

export const HOME_CHANNELS: HomeChannel[] = [
  { label: "首页", source: "recommend" },
  { label: "热门", source: "popular" },
  { label: "入站必刷", source: "precious" },
  { label: "动画", source: "region", rid: 1 },
  { label: "游戏", source: "region", rid: 4 },
  { label: "知识", source: "region", rid: 36 },
  { label: "影视", source: "region", rid: 181 },
  { label: "科技", source: "region", rid: 188 },
  { label: "音乐", source: "region", rid: 3 },
];
