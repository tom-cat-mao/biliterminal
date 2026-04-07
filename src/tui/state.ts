import type { AppMode, HomeChannel, ListState } from "../core/types.js";

export function clampSelection(index: number, length: number): number {
  if (length <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(index, length - 1));
}

export function pushListState(stack: ListState[], state: ListState): ListState[] {
  const next = [...stack];
  const last = next.at(-1);
  if (!last || JSON.stringify(last) !== JSON.stringify(state)) {
    next.push(state);
  }
  return next.slice(-20);
}

export function popListState(stack: ListState[]): { stack: ListState[]; state?: ListState } {
  if (stack.length === 0) {
    return { stack };
  }
  return {
    stack: stack.slice(0, -1),
    state: stack.at(-1),
  };
}

export function modeToken(detailMode: boolean, mode: AppMode, channels: HomeChannel[], channelIndex: number): string {
  if (detailMode) {
    return "详情";
  }
  if (mode === "search") {
    return "搜索";
  }
  if (mode === "history") {
    return "历史";
  }
  if (mode === "favorites") {
    return "收藏夹";
  }
  return channels[channelIndex]?.label ?? "首页";
}
