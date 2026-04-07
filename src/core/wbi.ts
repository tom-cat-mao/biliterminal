import crypto from "node:crypto";

const COMMENT_WBI_MIXIN_TABLE = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
  22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
] as const;

const WBI_KEY_SANITIZE_PATTERN = /[!'()*]/g;

export function mixinWbiKey(imgKey: string, subKey: string): string {
  const merged = imgKey + subKey;
  return COMMENT_WBI_MIXIN_TABLE.map((index) => merged[index] ?? "").join("").slice(0, 32);
}

export function signWbiParams(params: Record<string, string | number>, imgKey: string, subKey: string, timestamp?: number): Record<string, string> {
  const signed: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    signed[key] = typeof value === "string" ? value.replace(WBI_KEY_SANITIZE_PATTERN, "") : String(value);
  }
  signed.wts = String(timestamp ?? Math.round(Date.now() / 1000));
  const query = Object.keys(signed)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(signed[key])}`)
    .join("&");
  signed.w_rid = crypto.createHash("md5").update(`${query}${mixinWbiKey(imgKey, subKey)}`, "utf8").digest("hex");
  return signed;
}
