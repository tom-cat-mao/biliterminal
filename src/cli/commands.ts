import type { BilibiliClient } from "../api/bilibili-client.js";
import { videoKeyFromItem, videoKeyFromRef } from "../api/parsers.js";
import { printComments, printFavorites, printHistory, printVideoDetail, printVideoList } from "./printers.js";
import { buildWatchUrl, parseVideoRef } from "../core/video-ref.js";
import type { VideoItem } from "../core/types.js";
import { openUrl, openVideoTarget } from "../platform/browser.js";
import type { HistoryStore } from "../storage/history-store.js";

export interface CommandContext {
  client: BilibiliClient;
  historyStore: HistoryStore;
  lastItems: VideoItem[];
  out?: Pick<Console, "log">;
}

export function createCommandContext(client: BilibiliClient, historyStore: HistoryStore, out: Pick<Console, "log"> = console): CommandContext {
  return { client, historyStore, lastItems: [], out };
}

export function resolveTarget(target: string, lastItems: VideoItem[]): string {
  if (/^\d+$/.test(target) && lastItems.length > 0) {
    const index = Number(target) - 1;
    if (index < 0 || index >= lastItems.length) {
      throw new Error(`序号超出范围: ${target}`);
    }
    return lastItems[index].bvid ?? String(lastItems[index].aid ?? "");
  }
  return target;
}

export async function resolveItemForFavorite(target: string, ctx: CommandContext): Promise<VideoItem> {
  if (/^\d+$/.test(target) && ctx.lastItems.length > 0) {
    const index = Number(target) - 1;
    if (index < 0 || index >= ctx.lastItems.length) {
      throw new Error(`序号超出范围: ${target}`);
    }
    return ctx.lastItems[index];
  }
  return ctx.client.video(resolveTarget(target, ctx.lastItems));
}

export function resolveFavoriteItem(target: string, historyStore: HistoryStore): VideoItem {
  const favorites = historyStore.getFavoriteVideos();
  if (/^\d+$/.test(target)) {
    const index = Number(target) - 1;
    if (index < 0 || index >= favorites.length) {
      throw new Error(`收藏夹序号超出范围: ${target}`);
    }
    return favorites[index];
  }
  const [refType, value] = parseVideoRef(target);
  const key = videoKeyFromRef(refType, value);
  const item = favorites.find((candidate) => videoKeyFromItem(candidate) === key);
  if (!item) {
    throw new Error("收藏夹中不存在该视频");
  }
  return item;
}

export async function runHot(page: number, limit: number, ctx: CommandContext): Promise<void> {
  const items = await ctx.client.popular(page, limit);
  ctx.lastItems = items;
  printVideoList(items, `热门视频 第 ${page} 页`, ctx.out);
}

export async function runRecommend(page: number, limit: number, ctx: CommandContext): Promise<void> {
  const items = await ctx.client.recommend(page, limit);
  ctx.lastItems = items;
  printVideoList(items, `首页推荐 第 ${page} 页`, ctx.out);
}

export async function runPrecious(page: number, limit: number, ctx: CommandContext): Promise<void> {
  const items = await ctx.client.precious(page, limit);
  ctx.lastItems = items;
  printVideoList(items, `入站必刷 第 ${page} 页`, ctx.out);
}

export async function runSearch(keyword: string, page: number, limit: number, ctx: CommandContext): Promise<void> {
  const items = await ctx.client.search(keyword, page, limit);
  ctx.historyStore.addKeyword(keyword);
  ctx.lastItems = items;
  printVideoList(items, `搜索结果: ${keyword} | 第 ${page} 页`, ctx.out);
}

export async function runVideo(ref: string, ctx: CommandContext): Promise<void> {
  const item = await ctx.client.video(resolveTarget(ref, ctx.lastItems));
  ctx.historyStore.addVideo(item);
  printVideoDetail(item, ctx.out);
}

export async function runComments(ref: string, limit: number, ctx: CommandContext): Promise<void> {
  const item = await ctx.client.video(resolveTarget(ref, ctx.lastItems));
  if (item.aid == null) {
    throw new Error("当前视频缺少 AID，无法加载评论");
  }
  const comments = await ctx.client.comments(item.aid, limit, item.bvid);
  printComments(item, comments, ctx.out);
}

export async function runOpen(ref: string, ctx: CommandContext): Promise<void> {
  if (/^\d+$/.test(ref) && ctx.lastItems.length > 0) {
    const index = Number(ref) - 1;
    if (index < 0 || index >= ctx.lastItems.length) {
      throw new Error(`序号超出范围: ${ref}`);
    }
    const item = ctx.lastItems[index];
    ctx.historyStore.addVideo(item);
    await openUrl(item.url);
    ctx.out?.log(`已打开: ${item.url}`);
    return;
  }
  try {
    const url = await openVideoTarget(ref);
    ctx.out?.log(`已打开: ${url}`);
  } catch {
    await openUrl(ref);
    ctx.out?.log(`已打开: ${ref}`);
  }
}

export async function runFavorite(ref: string, ctx: CommandContext): Promise<void> {
  const item = await resolveItemForFavorite(ref, ctx);
  const added = ctx.historyStore.addFavorite(item);
  ctx.out?.log(`${added ? "已收藏" : "收藏夹已更新"}: ${item.title}`);
}

export function runFavoritesList(ctx: CommandContext): void {
  ctx.lastItems = ctx.historyStore.getFavoriteVideos();
  printFavorites(ctx.historyStore, ctx.out);
}

export async function runFavoritesOpen(ref: string, ctx: CommandContext): Promise<void> {
  const item = resolveFavoriteItem(ref, ctx.historyStore);
  await openUrl(item.url);
  ctx.historyStore.addVideo(item);
  ctx.out?.log(`已打开收藏: ${item.url}`);
}

export function runFavoritesRemove(ref: string, ctx: CommandContext): void {
  const item = resolveFavoriteItem(ref, ctx.historyStore);
  ctx.historyStore.removeFavorite(item);
  ctx.out?.log(`已移出收藏: ${item.title}`);
}

export function runHistory(ctx: CommandContext): void {
  ctx.lastItems = ctx.historyStore.getRecentVideos(10);
  printHistory(ctx.historyStore, ctx.out);
}

export async function runTrending(limit: number, ctx: CommandContext): Promise<void> {
  ctx.out?.log("\n首页热搜");
  ctx.out?.log("========");
  const words = await ctx.client.trendingKeywords(limit);
  words.forEach((keyword, index) => ctx.out?.log(`${String(index + 1).padStart(2, " ")}. ${keyword}`));
}

export async function executeParsedCommand(command: string, args: Record<string, unknown>, ctx: CommandContext): Promise<void> {
  switch (command) {
    case "hot":
      return runHot(Number(args.page ?? 1), Number(args.limit ?? 10), ctx);
    case "recommend":
      return runRecommend(Number(args.page ?? 1), Number(args.limit ?? 10), ctx);
    case "precious":
      return runPrecious(Number(args.page ?? 1), Number(args.limit ?? 10), ctx);
    case "search":
      return runSearch(String(args.keyword), Number(args.page ?? 1), Number(args.limit ?? 10), ctx);
    case "video":
      return runVideo(String(args.ref), ctx);
    case "comments":
      return runComments(String(args.ref), Number(args.limit ?? 5), ctx);
    case "open":
      return runOpen(String(args.ref), ctx);
    case "favorite":
      return runFavorite(String(args.ref), ctx);
    case "favorites": {
      const action = args.favoritesAction as string | undefined;
      if (!action) {
        return runFavoritesList(ctx);
      }
      if (action === "open") {
        return runFavoritesOpen(String(args.ref), ctx);
      }
      if (action === "remove") {
        return Promise.resolve(runFavoritesRemove(String(args.ref), ctx));
      }
      throw new Error("未知收藏夹动作");
    }
    case "history":
      return Promise.resolve(runHistory(ctx));
    case "trending":
      return runTrending(Number(args.limit ?? 10), ctx);
    default:
      throw new Error(`未知命令: ${command}`);
  }
}
