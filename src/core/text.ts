import stringWidth from "string-width";

const HTML_TAG_PATTERN = /<[^>]+>/g;
const WHITESPACE_PATTERN = /\s+/g;
const COMMON_MOJIBAKE_CHARS = new Set("ÃÂÐÑãäåæçèéêëìíîïðñòóôõöùúûüýþÿ".split(""));

function splitGraphemes(value: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("zh-Hans", { granularity: "grapheme" });
    return Array.from(segmenter.segment(value), (entry) => entry.segment);
  }
  return Array.from(value);
}

export function stripHtml(value: string): string {
  return (value || "").replace(HTML_TAG_PATTERN, "").trim();
}

export function compactWhitespace(value: string): string {
  return (value || "").replace(WHITESPACE_PATTERN, " ").trim();
}

export function hasCjk(value: string): boolean {
  return splitGraphemes(value).some((char) => /[\u4e00-\u9fff]/u.test(char));
}

export function repairMojibake(value: string): string {
  const cleaned = compactWhitespace(value);
  if (!cleaned || hasCjk(cleaned)) {
    return cleaned;
  }

  const graphemes = splitGraphemes(cleaned);
  if (graphemes.some((char) => char.codePointAt(0)! > 255)) {
    return cleaned;
  }

  try {
    const latin1 = Buffer.from(cleaned, "latin1");
    const repaired = compactWhitespace(latin1.toString("utf8"));
    if (repaired && repaired !== cleaned) {
      return repaired;
    }
  } catch {
    // ignore
  }
  return cleaned;
}

export function isSuspiciousKeyword(value: string): boolean {
  if (!value) {
    return true;
  }
  if (value.includes("�")) {
    return true;
  }
  if (hasCjk(value)) {
    return false;
  }
  const graphemes = splitGraphemes(value);
  const latin1Count = graphemes.filter((char) => COMMON_MOJIBAKE_CHARS.has(char)).length;
  const asciiWordCount = graphemes.filter((char) => /[A-Za-z0-9]/.test(char)).length;
  if (value.length <= 2 && latin1Count === value.length) {
    return true;
  }
  return latin1Count >= 2 && asciiWordCount <= 2;
}

export function normalizeKeyword(value: string): string {
  const cleaned = repairMojibake(value);
  return isSuspiciousKeyword(cleaned) ? "" : cleaned;
}

export function charWidth(char: string): number {
  return stringWidth(char);
}

export function displayWidth(value: string): number {
  return stringWidth(value);
}

export function truncateDisplay(value: string, width: number, placeholder = "..."): string {
  const cleaned = compactWhitespace(value);
  if (width <= 0) {
    return "";
  }
  if (displayWidth(cleaned) <= width) {
    return cleaned;
  }

  const placeholderWidth = displayWidth(placeholder);
  const clusters = splitGraphemes(cleaned);
  if (placeholderWidth >= width) {
    let result = "";
    let currentWidth = 0;
    for (const cluster of splitGraphemes(placeholder)) {
      const clusterWidth = charWidth(cluster);
      if (currentWidth + clusterWidth > width) {
        break;
      }
      result += cluster;
      currentWidth += clusterWidth;
    }
    return result;
  }

  let result = "";
  let currentWidth = 0;
  for (const cluster of clusters) {
    const clusterWidth = charWidth(cluster);
    if (currentWidth + clusterWidth + placeholderWidth > width) {
      break;
    }
    result += cluster;
    currentWidth += clusterWidth;
  }
  return result.trimEnd() + placeholder;
}

export function wrapDisplay(value: string, width: number): string[] {
  const cleaned = compactWhitespace(value);
  if (!cleaned) {
    return [""];
  }
  if (width <= 1) {
    return [cleaned];
  }

  const lines: string[] = [];
  let current = "";
  let currentWidth = 0;
  for (const cluster of splitGraphemes(cleaned)) {
    const clusterWidth = charWidth(cluster);
    if (current && currentWidth + clusterWidth > width) {
      lines.push(current.trimEnd());
      current = /\s/u.test(cluster) ? "" : cluster;
      currentWidth = displayWidth(current);
      continue;
    }
    if (!current && /\s/u.test(cluster)) {
      continue;
    }
    current += cluster;
    currentWidth += clusterWidth;
  }
  if (current) {
    lines.push(current.trimEnd());
  }
  return lines.length > 0 ? lines : [""];
}

export function shorten(value: string, width = 96): string {
  return truncateDisplay(value, width);
}
