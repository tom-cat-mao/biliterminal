import { formatTimestamp, humanCount } from "../core/format.js";
import { shorten } from "../core/text.js";
import type { CommentItem, VideoItem } from "../core/types.js";
import type { HistoryStore } from "../storage/history-store.js";

export function printVideoList(items: VideoItem[], title: string, out: Pick<Console, "log"> = console): void {
  out.log(`\n${title}`);
  out.log("=".repeat(title.length));
  if (items.length === 0) {
    out.log("没有结果。");
    return;
  }
  items.forEach((item, index) => {
    const meta = `UP: ${item.author} | 播放: ${humanCount(item.play)} | 弹幕: ${humanCount(item.danmaku)} | 时长: ${item.duration} | 发布时间: ${formatTimestamp(item.pubdate)}`;
    out.log(`${String(index + 1).padStart(2, " ")}. ${shorten(item.title, 72)}`);
    out.log(`    ${meta}`);
    out.log(`    ${item.bvid ?? item.aid ?? "-"} | ${item.url}`);
  });
  out.log("\n提示: 可用 `video 1` 查看详情，`favorite 1` 加入收藏，或 `open 1` 在浏览器中打开。");
}

export function printVideoDetail(item: VideoItem, out: Pick<Console, "log"> = console): void {
  out.log(`\n${item.title}`);
  out.log("=".repeat(item.title.length));
  out.log(`UP主: ${item.author}`);
  out.log(`BV号: ${item.bvid ?? "-"}`);
  out.log(`AID: ${item.aid ?? "-"}`);
  out.log(`时长: ${item.duration}`);
  out.log(`发布时间: ${formatTimestamp(item.pubdate)}`);
  out.log(`播放: ${humanCount(item.play)}  弹幕: ${humanCount(item.danmaku)}`);
  out.log(`点赞: ${humanCount(item.like)}  收藏: ${humanCount(item.favorite)}`);
  out.log(`链接: ${item.url}`);
  if (item.description) {
    out.log("\n简介:");
    out.log(item.description);
  }
}

export function printHistory(historyStore: HistoryStore, out: Pick<Console, "log"> = console): void {
  out.log("\n最近搜索");
  out.log("========");
  const keywords = historyStore.getRecentKeywords(10);
  if (keywords.length > 0) {
    keywords.forEach((keyword, index) => out.log(`${String(index + 1).padStart(2, " ")}. ${keyword}`));
  } else {
    out.log("没有搜索记录。");
  }

  out.log("\n最近浏览");
  out.log("========");
  const videos = historyStore.getRecentVideos(10);
  if (videos.length === 0) {
    out.log("没有视频记录。");
    return;
  }
  videos.forEach((item, index) => {
    out.log(`${String(index + 1).padStart(2, " ")}. ${shorten(item.title, 72)}`);
    out.log(`    ${item.author} | ${item.bvid ?? item.aid ?? "-"} | ${item.url}`);
  });
}

export function printFavorites(historyStore: HistoryStore, out: Pick<Console, "log"> = console): void {
  out.log("\n收藏夹");
  out.log("======");
  const favorites = historyStore.getFavoriteVideos();
  if (favorites.length === 0) {
    out.log("收藏夹为空。");
    return;
  }
  favorites.forEach((item, index) => {
    out.log(`${String(index + 1).padStart(2, " ")}. ${shorten(item.title, 72)}`);
    out.log(`    ${item.author} | ${item.bvid ?? item.aid ?? "-"} | ${item.url}`);
  });
  out.log("\n提示: 可用 `favorites open 1` 直接打开，或 `favorites remove 1` 从收藏夹移除。");
}

export function printComments(item: VideoItem, comments: CommentItem[], out: Pick<Console, "log"> = console): void {
  const title = `热评预览: ${shorten(item.title, 72)}`;
  out.log(`\n${title}`);
  out.log("=".repeat(title.length));
  if (comments.length === 0) {
    out.log("没有可显示的评论。");
    return;
  }
  comments.forEach((comment, index) => {
    out.log(`${String(index + 1).padStart(2, " ")}. ${comment.author} | ${humanCount(comment.like)} 赞 | ${formatTimestamp(comment.ctime)}`);
    out.log(`    ${comment.message || "暂无评论内容"}`);
  });
}
