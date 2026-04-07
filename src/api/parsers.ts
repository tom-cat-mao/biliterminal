import { buildVideoUrl } from "../core/video-ref.js";
import { compactDescription, normalizeDuration } from "../core/format.js";
import { compactWhitespace, stripHtml } from "../core/text.js";
import type { CommentItem, VideoItem } from "../core/types.js";

function numberValue(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function itemFromPayload(payload: Record<string, unknown>): VideoItem {
  const stat = (payload.stat ?? {}) as Record<string, unknown>;
  const owner = payload.owner;
  let author = "-";
  if (owner && typeof owner === "object" && typeof (owner as Record<string, unknown>).name === "string") {
    author = String((owner as Record<string, unknown>).name);
  } else if (typeof owner === "string" && owner.trim()) {
    author = owner.trim();
  } else {
    const fallback = payload.author ?? payload.owner_name ?? payload.up_name;
    author = typeof fallback === "string" && fallback.trim() ? fallback.trim() : "-";
  }

  return {
    title: stripHtml(String(payload.title ?? "")),
    author,
    bvid: typeof payload.bvid === "string" ? payload.bvid : null,
    aid: payload.aid == null ? null : numberValue(payload.aid),
    duration: normalizeDuration((payload.duration as string | number | null | undefined) ?? null),
    play: numberValue(payload.play ?? stat.view),
    danmaku: numberValue(payload.video_review ?? payload.danmaku ?? stat.danmaku),
    like: numberValue(payload.like ?? stat.like),
    favorite: numberValue(payload.favorites ?? stat.favorite),
    pubdate: payload.pubdate == null ? null : numberValue(payload.pubdate),
    description: compactDescription(payload.description ?? payload.desc),
    url: buildVideoUrl(payload),
    raw: payload,
  };
}

export function itemToHistoryPayload(item: VideoItem): Record<string, unknown> {
  return {
    title: item.title,
    author: item.author,
    bvid: item.bvid,
    aid: item.aid,
    duration: item.duration,
    play: item.play,
    danmaku: item.danmaku,
    like: item.like,
    favorites: item.favorite,
    pubdate: item.pubdate,
    description: item.description,
    url: item.url,
  };
}

export function videoKeyFromPayload(payload: Record<string, unknown>): string | null {
  if (typeof payload.bvid === "string" && payload.bvid) {
    return payload.bvid;
  }
  if (payload.aid != null && payload.aid !== "") {
    return `av${payload.aid}`;
  }
  if (typeof payload.url === "string" && payload.url) {
    return payload.url;
  }
  return null;
}

export function videoKeyFromItem(item: VideoItem | null | undefined): string | null {
  if (!item) {
    return null;
  }
  return videoKeyFromPayload(itemToHistoryPayload(item));
}

export function videoKeyFromRef(refType: "bvid" | "aid", value: string): string {
  return refType === "bvid" ? value : `av${value}`;
}

export function commentsFromPayload(payload: Array<Record<string, unknown>>): CommentItem[] {
  return payload.map((item) => {
    const member = (item.member ?? {}) as Record<string, unknown>;
    const content = (item.content ?? {}) as Record<string, unknown>;
    return {
      author: typeof member.uname === "string" && member.uname ? member.uname : "-",
      message: compactWhitespace(String(content.message ?? "")),
      like: numberValue(item.like),
      ctime: item.ctime == null ? null : numberValue(item.ctime),
    };
  });
}

export function commentsFromThreadPayload(payload: Record<string, unknown>, limit: number): CommentItem[] {
  const merged: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  for (const field of ["top_replies", "replies"] as const) {
    const items = payload[field];
    if (!Array.isArray(items)) {
      continue;
    }
    for (const raw of items) {
      if (!raw || typeof raw !== "object") {
        continue;
      }
      const item = raw as Record<string, unknown>;
      const key = String(item.rpid_str ?? item.rpid ?? merged.length);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      merged.push(item);
      if (merged.length >= limit) {
        return commentsFromPayload(merged);
      }
    }
  }
  return commentsFromPayload(merged);
}
