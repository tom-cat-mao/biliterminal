import { compactWhitespace, wrapDisplay } from "./text.js";
import type { CommentItem, VideoItem } from "./types.js";

export function humanCount(value: number | null | undefined): string {
  if (value == null) {
    return "-";
  }
  if (value >= 100_000_000) {
    return `${(value / 100_000_000).toFixed(1)}亿`;
  }
  if (value >= 10_000) {
    return `${(value / 10_000).toFixed(1)}万`;
  }
  return String(value);
}

export function formatTimestamp(value: number | null | undefined): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value * 1000);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function normalizeDuration(value: string | number | null | undefined): string {
  if (value == null) {
    return "-";
  }
  if (typeof value === "string") {
    const stripped = value.trim();
    if (/^\d+$/.test(stripped)) {
      return normalizeDuration(Number(stripped));
    }
    if (stripped.includes(":")) {
      const parts = stripped.split(":");
      if (parts.every((part) => /^\d+$/.test(part))) {
        const numbers = parts.map(Number);
        if (numbers.length === 2) {
          return `${numbers[0]}:${String(numbers[1]).padStart(2, "0")}`;
        }
        if (numbers.length === 3) {
          return `${numbers[0]}:${String(numbers[1]).padStart(2, "0")}:${String(numbers[2]).padStart(2, "0")}`;
        }
      }
    }
    return stripped;
  }
  const totalSeconds = Math.max(0, Math.trunc(value));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours > 0) {
    return `${hours}:${String(remainingMinutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${remainingMinutes}:${String(seconds).padStart(2, "0")}`;
}

export function buildDetailLines(item: VideoItem, width: number): string[] {
  const titleLines = wrapDisplay(item.title, Math.max(20, width));
  const descriptionLines = item.description ? wrapDisplay(item.description, Math.max(20, width)) : ["无简介"];
  return [
    ...titleLines,
    "",
    `👤 UP主: ${item.author}`,
    `🔗 BV号: ${item.bvid ?? "-"}`,
    `🔗 AID: ${item.aid ?? "-"}`,
    `🕒 时长: ${item.duration}`,
    `📅 发布时间: ${formatTimestamp(item.pubdate)}`,
    `▶ 播放: ${humanCount(item.play)}`,
    `≡ 弹幕: ${humanCount(item.danmaku)}`,
    `👍 点赞: ${humanCount(item.like)}`,
    `⭐ 收藏: ${humanCount(item.favorite)}`,
    `🌐 链接: ${item.url}`,
    "",
    "📝 简介:",
    ...descriptionLines,
  ];
}

export function mergeDetailAndComments(lines: string[], comments: CommentItem[], commentError?: string | null, width = 80): string[] {
  const merged = [...lines];
  if (commentError && comments.length === 0) {
    merged.push("", `评论加载失败: ${commentError}`, "提示: 按 o 在浏览器中查看完整评论");
  }
  if (comments.length > 0) {
    merged.push("", "💬 热评:");
    for (const [index, comment] of comments.entries()) {
      merged.push(`${index + 1}. 👤 ${comment.author} · 👍 ${humanCount(comment.like)} · 📅 ${formatTimestamp(comment.ctime)}`);
      merged.push(...wrapDisplay(comment.message || "暂无评论内容", Math.max(20, width)));
      merged.push("");
    }
  }
  return merged;
}

export function compactDescription(value: unknown): string {
  return compactWhitespace(String(value ?? ""));
}
