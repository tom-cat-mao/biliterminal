import open from "open";
import { buildWatchUrl, parseVideoRef } from "../core/video-ref.js";

export async function openUrl(url: string): Promise<void> {
  await open(url);
}

export async function openVideoTarget(target: string): Promise<string> {
  const [refType, value] = parseVideoRef(target);
  const url = buildWatchUrl(refType, value);
  await openUrl(url);
  return url;
}
