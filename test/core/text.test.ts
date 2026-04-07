import { describe, expect, it } from "vitest";
import { displayWidth, normalizeKeyword, truncateDisplay, wrapDisplay } from "../../src/core/text.js";

describe("core/text", () => {
  it("能修复 UTF-8 被当作 latin1 的关键词乱码", () => {
    expect(normalizeKeyword("ä¸­æ")).toBe("中文");
  });

  it("会丢弃可疑乱码关键词", () => {
    expect(normalizeKeyword("ã, æ")).toBe("");
  });

  it("能按终端显示宽度计算中英文混排", () => {
    expect(displayWidth("abc")).toBe(3);
    expect(displayWidth("中文A")).toBe(5);
  });

  it("truncateDisplay 会遵守终端宽度", () => {
    expect(truncateDisplay("原神启动测试", 8)).toBe("原神...");
  });

  it("wrapDisplay 生成的每一行都不会超宽", () => {
    const lines = wrapDisplay("哔哩哔哩终端首页", 8);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line) => displayWidth(line) <= 8)).toBe(true);
  });
});
