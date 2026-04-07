import { describe, expect, it } from "vitest";
import { mixinWbiKey, signWbiParams } from "../../src/core/wbi.js";

describe("core/wbi", () => {
  const imgKey = "abcdef1234567890abcdef1234567890";
  const subKey = "zyxwvutsrqponmlkjihgfedcba098765";

  it("mixinWbiKey 会按规则生成 32 位混合 key", () => {
    expect(mixinWbiKey(imgKey, subKey)).toBe("lkcce32z0h500dmw6ofiy4pd879s7tq8");
  });

  it("signWbiParams 会清洗字符串并生成稳定签名", () => {
    expect(signWbiParams({ oid: 123, pagination_str: "!(test)*", mode: 3 }, imgKey, subKey, 1_700_000_000)).toEqual({
      oid: "123",
      pagination_str: "test",
      mode: "3",
      wts: "1700000000",
      w_rid: "c3b4e6ea247311c548eb23111db1170b",
    });
  });
});
