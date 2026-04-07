import type { VideoRefType } from "./types.js";

const BVID_PATTERN = /(BV[0-9A-Za-z]{10})/;
const AID_PATTERN = /\bav(\d+)\b/i;

export function parseVideoRef(value: string): [VideoRefType, string] {
  const cleaned = value.trim();
  const bvidMatch = cleaned.match(BVID_PATTERN);
  if (bvidMatch) {
    return ["bvid", bvidMatch[1]];
  }
  const aidMatch = cleaned.match(AID_PATTERN);
  if (aidMatch) {
    return ["aid", aidMatch[1]];
  }
  if (/^\d+$/.test(cleaned)) {
    return ["aid", cleaned];
  }
  throw new Error(`无法识别视频标识: ${value}`);
}

export function buildWatchUrl(refType: VideoRefType, value: string): string {
  return refType === "bvid" ? `https://www.bilibili.com/video/${value}` : `https://www.bilibili.com/video/av${value}`;
}

export function buildVideoUrl(payload: Record<string, unknown>): string {
  const explicitUrl = payload.url;
  if (typeof explicitUrl === "string" && explicitUrl) {
    return explicitUrl;
  }
  const redirectUrl = payload.redirect_url;
  if (typeof redirectUrl === "string" && redirectUrl) {
    return redirectUrl;
  }
  if (typeof payload.bvid === "string" && payload.bvid) {
    return `https://www.bilibili.com/video/${payload.bvid}`;
  }
  if (typeof payload.aid === "number" || typeof payload.aid === "string") {
    return `https://www.bilibili.com/video/av${payload.aid}`;
  }
  return "https://www.bilibili.com/";
}
