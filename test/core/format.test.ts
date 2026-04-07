import { describe, expect, it } from "vitest";
import { buildDetailLines, compactDescription, mergeDetailAndComments, normalizeDuration } from "../../src/core/format.js";
import { makeVideoItem } from "../support/fixtures.js";

describe("core/format", () => {
  it("normalizeDuration 会补齐搜索接口风格的秒数字段", () => {
    expect(normalizeDuration("5:5")).toBe("5:05");
    expect(normalizeDuration(65)).toBe("1:05");
    expect(normalizeDuration(3661)).toBe("1:01:01");
  });

  it("buildDetailLines 包含关键元信息", () => {
    const lines = buildDetailLines(makeVideoItem(), 40);
    expect(lines).toContain("👤 UP主: UP");
    expect(lines).toContain("📝 简介:");
  });

  it("mergeDetailAndComments 会合并热评与报错提示", () => {
    const lines = mergeDetailAndComments(["标题"], [{ author: "评论者", message: "评论内容", like: 9, ctime: 1_710_000_000 }], null, 40);
    expect(lines.join("\n")).toContain("💬 热评:");
    expect(lines.join("\n")).toContain("评论内容");

    const errorLines = mergeDetailAndComments(["标题"], [], "访问权限不足", 40);
    expect(errorLines.join("\n")).toContain("评论加载失败");
  });

  it("compactDescription 会压缩多余空白", () => {
    expect(compactDescription("  多余   空格  ")).toBe("多余 空格");
  });
});
