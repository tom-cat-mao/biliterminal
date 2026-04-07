import got, { HTTPError, RequestError } from "got";
import { CookieJar } from "tough-cookie";
import { BilibiliAPIError, DEFAULT_TIMEOUT, DEFAULT_USER_AGENT } from "../core/types.js";
import { buildWatchUrl, parseVideoRef } from "../core/video-ref.js";
import { signWbiParams } from "../core/wbi.js";
import { compactWhitespace } from "../core/text.js";
import { commentsFromThreadPayload, itemFromPayload } from "./parsers.js";
import type { CommentItem, VideoItem } from "../core/types.js";

const INITIAL_STATE_PATTERN = /window\.__INITIAL_STATE__=(\{.*?\});\(function/s;
const INITIAL_STATE_FALLBACK_PATTERN = /window\.__INITIAL_STATE__=(\{.*?\})\s*var\s+isBilibili/s;
const COMMENT_WBI_KEYS_PATTERN = /encWbiKeys:\{wbiImgKey:"([^"]+)",wbiSubKey:"([^"]+)"\}/;
const COMMENT_WEB_LOCATION = 1315875;

function toApiError(error: unknown): BilibiliAPIError {
  if (error instanceof BilibiliAPIError) {
    return error;
  }
  if (error instanceof HTTPError) {
    return new BilibiliAPIError(`HTTP ${error.response.statusCode}: ${error.response.statusMessage || error.message}`);
  }
  if (error instanceof RequestError) {
    return new BilibiliAPIError(`网络请求失败: ${error.message}`);
  }
  if (error instanceof Error) {
    return new BilibiliAPIError(error.message);
  }
  return new BilibiliAPIError("请求失败");
}

function is412(error: unknown): boolean {
  return error instanceof HTTPError && error.response.statusCode === 412;
}

export class BilibiliClient {
  private readonly timeout: number;
  private readonly userAgent: string;
  private readonly cookieJar: CookieJar;
  private readonly commentWbiKeys = new Map<string, [string, string]>();

  constructor(options: { timeout?: number; userAgent?: string } = {}) {
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.cookieJar = new CookieJar();
  }

  private buildHeaders(referer: string, accept = "application/json, text/plain, */*"): Record<string, string> {
    const parsed = new URL(referer);
    return {
      "User-Agent": this.userAgent,
      Accept: accept,
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      Origin: `${parsed.protocol}//${parsed.host}`,
      Referer: referer,
    };
  }

  private async requestText(url: string, referer: string, accept = "text/html,application/xhtml+xml"): Promise<string> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await got(url, {
          cookieJar: this.cookieJar,
          headers: this.buildHeaders(referer, accept),
          retry: { limit: 0 },
          timeout: { request: this.timeout },
        }).text();
      } catch (error) {
        if (attempt === 0 && is412(error)) {
          await this.warmup(referer);
          continue;
        }
        throw toApiError(error);
      }
    }
    throw new BilibiliAPIError("请求失败");
  }

  private async requestJson(url: string, params: Record<string, string | number>, referer: string): Promise<Record<string, unknown>> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const body = await got(url, {
          cookieJar: this.cookieJar,
          headers: this.buildHeaders(referer),
          retry: { limit: 0 },
          searchParams: params,
          timeout: { request: this.timeout },
        }).text();
        const payload = JSON.parse(body) as Record<string, unknown>;
        const code = Number(payload.code ?? 0);
        if (code !== 0) {
          throw new BilibiliAPIError(`Bilibili 接口错误 code=${code}: ${String(payload.message ?? "unknown")}`);
        }
        const data = payload.data;
        return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
      } catch (error) {
        if (attempt === 0 && is412(error)) {
          await this.warmup(referer);
          continue;
        }
        if (error instanceof SyntaxError) {
          throw new BilibiliAPIError("接口没有返回合法 JSON");
        }
        throw toApiError(error);
      }
    }
    throw new BilibiliAPIError("请求失败");
  }

  async warmup(referer: string): Promise<void> {
    const targets = ["https://www.bilibili.com/"];
    if (!targets.includes(referer)) {
      targets.push(referer);
    }
    for (const target of targets) {
      await got(target, {
        cookieJar: this.cookieJar,
        headers: this.buildHeaders(target, "text/html,application/xhtml+xml"),
        retry: { limit: 0 },
        timeout: { request: this.timeout },
      }).text();
    }
  }

  private async videoPageState(bvid: string): Promise<Record<string, unknown>> {
    const html = await this.requestText(buildWatchUrl("bvid", bvid), "https://www.bilibili.com/");
    const match = html.match(INITIAL_STATE_PATTERN) ?? html.match(INITIAL_STATE_FALLBACK_PATTERN);
    if (!match) {
      throw new BilibiliAPIError("无法解析视频页状态");
    }
    try {
      return JSON.parse(match[1]) as Record<string, unknown>;
    } catch {
      throw new BilibiliAPIError("视频页状态不是合法 JSON");
    }
  }

  private async commentWbiScriptKeys(bvid: string, forceRefresh = false): Promise<[string, string]> {
    const state = await this.videoPageState(bvid);
    const abtest = (state.abtest ?? {}) as Record<string, unknown>;
    const commentHash = typeof abtest.comment_version_hash === "string" ? abtest.comment_version_hash : "";
    if (commentHash && forceRefresh) {
      this.commentWbiKeys.delete(commentHash);
    }
    if (commentHash && this.commentWbiKeys.has(commentHash)) {
      return this.commentWbiKeys.get(commentHash)!;
    }
    if (commentHash) {
      const scriptUrl = `https://s1.hdslb.com/bfs/seed/jinkela/commentpc/bili-comments.${commentHash}.js`;
      let script = "";
      try {
        script = await this.requestText(scriptUrl, buildWatchUrl("bvid", bvid), "text/javascript, application/javascript, */*");
      } catch {
        script = "";
      }
      const match = script.match(COMMENT_WBI_KEYS_PATTERN);
      if (match) {
        const keys: [string, string] = [match[1], match[2]];
        this.commentWbiKeys.set(commentHash, keys);
        return keys;
      }
    }

    const defaultWbiKey = (state.defaultWbiKey ?? {}) as Record<string, unknown>;
    if (typeof defaultWbiKey.wbiImgKey === "string" && typeof defaultWbiKey.wbiSubKey === "string") {
      return [defaultWbiKey.wbiImgKey, defaultWbiKey.wbiSubKey];
    }
    throw new BilibiliAPIError("无法解析评论接口签名参数");
  }

  private async commentsViaWbi(oid: number, bvid: string, referer: string, forceRefresh = false): Promise<Record<string, unknown>> {
    const [imgKey, subKey] = await this.commentWbiScriptKeys(bvid, forceRefresh);
    return this.requestJson(
      "https://api.bilibili.com/x/v2/reply/wbi/main",
      signWbiParams(
        {
          oid,
          type: 1,
          mode: 3,
          pagination_str: JSON.stringify({ offset: "" }),
          plat: 1,
          web_location: COMMENT_WEB_LOCATION,
        },
        imgKey,
        subKey,
      ),
      referer,
    );
  }

  async popular(page = 1, pageSize = 10): Promise<VideoItem[]> {
    const data = await this.requestJson("https://api.bilibili.com/x/web-interface/popular", { pn: page, ps: pageSize }, "https://www.bilibili.com/");
    return Array.isArray(data.list) ? data.list.map((item) => itemFromPayload(item as Record<string, unknown>)) : [];
  }

  async recommend(page = 1, pageSize = 10): Promise<VideoItem[]> {
    const data = await this.requestJson(
      "https://api.bilibili.com/x/web-interface/index/top/feed/rcmd",
      {
        fresh_idx: page,
        fresh_type: 3,
        feed_version: "SEO_VIDEO",
        homepage_ver: 1,
        brush: 0,
        y_num: 5,
        ps: pageSize,
      },
      "https://www.bilibili.com/",
    );
    return Array.isArray(data.item)
      ? data.item
          .filter((item) => item && typeof item === "object" && (item as Record<string, unknown>).goto === "av")
          .map((item) => itemFromPayload(item as Record<string, unknown>))
      : [];
  }

  async precious(page = 1, pageSize = 10): Promise<VideoItem[]> {
    const data = await this.requestJson(
      "https://api.bilibili.com/x/web-interface/popular/precious",
      { page, page_size: pageSize },
      "https://www.bilibili.com/",
    );
    const items = Array.isArray(data.list) ? data.list : [];
    const start = Math.max(0, (page - 1) * pageSize);
    return items.slice(start, start + pageSize).map((item) => itemFromPayload(item as Record<string, unknown>));
  }

  async regionRanking(rid: number, day = 3, page = 1, pageSize = 10): Promise<VideoItem[]> {
    const data = await this.requestJson(
      "https://api.bilibili.com/x/web-interface/ranking/region",
      { rid, day, original: 0 },
      "https://www.bilibili.com/",
    );
    const items = Array.isArray(data) ? data : [];
    const start = Math.max(0, (page - 1) * pageSize);
    return items.slice(start, start + pageSize).map((item) => itemFromPayload(item as Record<string, unknown>));
  }

  async search(keyword: string, page = 1, pageSize = 10): Promise<VideoItem[]> {
    const referer = `https://search.bilibili.com/all?keyword=${encodeURIComponent(keyword)}`;
    const data = await this.requestJson(
      "https://api.bilibili.com/x/web-interface/search/type",
      { search_type: "video", keyword, page },
      referer,
    );
    const items = Array.isArray(data.result) ? data.result : [];
    return items
      .filter((item) => item && typeof item === "object" && (item as Record<string, unknown>).type === "video")
      .map((item) => itemFromPayload(item as Record<string, unknown>))
      .slice(0, pageSize);
  }

  async video(ref: string): Promise<VideoItem> {
    const [key, value] = parseVideoRef(ref);
    const data = await this.requestJson("https://api.bilibili.com/x/web-interface/view", { [key]: value }, "https://www.bilibili.com/");
    return itemFromPayload(data);
  }

  async searchDefault(): Promise<string> {
    const data = await this.requestJson("https://api.bilibili.com/x/web-interface/wbi/search/default", {}, "https://www.bilibili.com/");
    return compactWhitespace(String(data.show_name ?? data.name ?? ""));
  }

  async trendingKeywords(limit = 8): Promise<string[]> {
    const data = await this.requestJson(
      "https://api.bilibili.com/x/web-interface/search/square",
      { limit, from_source: "home_search" },
      "https://www.bilibili.com/",
    );
    const trending = (data.trending ?? {}) as Record<string, unknown>;
    const items = Array.isArray(trending.list) ? trending.list : [];
    return items
      .map((item) => compactWhitespace(String((item as Record<string, unknown>).show_name ?? (item as Record<string, unknown>).keyword ?? "")))
      .filter(Boolean);
  }

  async comments(oid: number, pageSize = 4, bvid?: string | null): Promise<CommentItem[]> {
    const referer = bvid ? `https://www.bilibili.com/video/${bvid}` : `https://www.bilibili.com/video/av${oid}`;
    try {
      if (bvid) {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            const data = await this.commentsViaWbi(oid, bvid, referer, attempt > 0);
            return commentsFromThreadPayload(data, pageSize);
          } catch (error) {
            const message = toApiError(error).message;
            if (attempt === 0 && message.includes("访问权限不足")) {
              continue;
            }
            throw error;
          }
        }
      }
      const data = await this.requestJson(
        "https://api.bilibili.com/x/v2/reply/main",
        { next: 0, type: 1, oid, mode: 3, ps: pageSize },
        referer,
      );
      return commentsFromThreadPayload(data, pageSize);
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.message.includes("访问权限不足") || apiError.message.includes("HTTP 412")) {
        throw new BilibiliAPIError("评论接口受限，请稍后重试或按 o 在浏览器中查看");
      }
      throw apiError;
    }
  }
}
