import { describe, expect, it } from "vitest";
import { HOME_CHANNELS, type ListState } from "../../src/core/types.js";
import { clampSelection, modeToken, popListState, pushListState } from "../../src/tui/state.js";

const searchState: ListState = {
  mode: "search",
  page: 2,
  keyword: "原神",
  selectedIndex: 3,
  channelIndex: 0,
};

const historyState: ListState = {
  mode: "history",
  page: 1,
  keyword: "",
  selectedIndex: 0,
  channelIndex: 0,
};

describe("tui/state", () => {
  it("clampSelection 会把选中索引限制在合法范围", () => {
    expect(clampSelection(-1, 5)).toBe(0);
    expect(clampSelection(2, 5)).toBe(2);
    expect(clampSelection(9, 5)).toBe(4);
    expect(clampSelection(9, 0)).toBe(0);
  });

  it("pushListState 会去重并保留最近 20 条", () => {
    const duplicated = pushListState([searchState], searchState);
    expect(duplicated).toEqual([searchState]);

    const stack = Array.from({ length: 25 }, (_, index) => ({ ...searchState, page: index + 1 }));
    const trimmed = stack.reduce<ListState[]>((acc, item) => pushListState(acc, item), []);
    expect(trimmed).toHaveLength(20);
    expect(trimmed[0].page).toBe(6);
    expect(trimmed.at(-1)?.page).toBe(25);
  });

  it("popListState 会返回最近一次保存的状态", () => {
    const result = popListState([searchState, historyState]);
    expect(result.stack).toEqual([searchState]);
    expect(result.state).toEqual(historyState);
  });

  it("modeToken 会根据模式与分区生成标题", () => {
    expect(modeToken(true, "hot", HOME_CHANNELS, 0)).toBe("详情");
    expect(modeToken(false, "search", HOME_CHANNELS, 0)).toBe("搜索");
    expect(modeToken(false, "favorites", HOME_CHANNELS, 0)).toBe("收藏夹");
    expect(modeToken(false, "hot", HOME_CHANNELS, 1)).toBe(HOME_CHANNELS[1].label);
  });
});
