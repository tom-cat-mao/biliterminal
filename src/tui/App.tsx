import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import type { BilibiliClient } from "../api/bilibili-client.js";
import { videoKeyFromItem } from "../api/parsers.js";
import { buildDetailLines, formatTimestamp, humanCount, mergeDetailAndComments } from "../core/format.js";
import { HOME_CHANNELS, type AppMode, type CommentItem, type ListState, type VideoItem } from "../core/types.js";
import { displayWidth, truncateDisplay, wrapDisplay } from "../core/text.js";
import { modeToken, popListState, pushListState, clampSelection } from "./state.js";
import { openUrl } from "../platform/browser.js";
import type { HistoryStore } from "../storage/history-store.js";

interface TuiAppProps {
  client: BilibiliClient;
  historyStore: HistoryStore;
  limit?: number;
}

interface PromptState {
  prompt: string;
  value: string;
}

type CommentLoadResult =
  | { status: "skipped"; itemKey?: string }
  | { status: "loaded"; itemKey: string; comments: CommentItem[] }
  | { status: "error"; itemKey: string; error: string };

function keyOf(item: VideoItem | null | undefined): string | null {
  return videoKeyFromItem(item);
}

export function BiliTerminalApp({ client, historyStore, limit = 5 }: TuiAppProps): React.JSX.Element {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const columns = stdout.columns ?? 80;
  const rows = stdout.rows ?? 24;

  const [mode, setMode] = useState<AppMode>("hot");
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [items, setItems] = useState<VideoItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [status, setStatus] = useState("正在加载...");
  const [detailCache, setDetailCache] = useState<Record<string, VideoItem>>({});
  const [listStack, setListStack] = useState<ListState[]>([]);
  const [detailMode, setDetailMode] = useState(false);
  const [detailScroll, setDetailScroll] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [channelIndex, setChannelIndex] = useState(0);
  const [defaultSearchKeyword, setDefaultSearchKeyword] = useState("");
  const [trendingKeywords, setTrendingKeywords] = useState<string[]>([]);
  const [commentCache, setCommentCache] = useState<Record<string, CommentItem[]>>({});
  const [commentErrors, setCommentErrors] = useState<Record<string, string>>({});
  const [commentLoaded, setCommentLoaded] = useState<Record<string, boolean>>({});
  const [promptState, setPromptState] = useState<PromptState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [loading, setLoading] = useState(false);
  const forceCommentsOnNextLoad = useRef(false);
  const selectedIndexRef = useRef(selectedIndex);
  const loadRequestIdRef = useRef(0);

  const selectedItem = items[selectedIndex] ?? null;
  const selectedKey = keyOf(selectedItem);
  const detailItem = selectedKey ? detailCache[selectedKey] ?? selectedItem : selectedItem;
  const comments = selectedKey ? commentCache[selectedKey] ?? [] : [];
  const commentError = selectedKey ? commentErrors[selectedKey] : undefined;
  const title =
    mode === "search" ? `搜索: ${keyword}  第 ${page} 页` : mode === "history" ? "最近浏览" : mode === "favorites" ? "收藏夹" : `${HOME_CHANNELS[channelIndex]?.label ?? "首页"}  第 ${page} 页`;

  const currentListState = useMemo<ListState>(
    () => ({ mode, page, keyword, selectedIndex, channelIndex }),
    [mode, page, keyword, selectedIndex, channelIndex],
  );

  const pushCurrentState = useCallback(() => {
    setListStack((prev) => pushListState(prev, currentListState));
  }, [currentListState]);

  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  const refreshHomeMeta = useCallback(
    async (force = false) => {
      if (force || !defaultSearchKeyword) {
        try {
          setDefaultSearchKeyword(await client.searchDefault());
        } catch {
          if (!defaultSearchKeyword) {
            setDefaultSearchKeyword("");
          }
        }
      }
      if (force || trendingKeywords.length === 0) {
        try {
          setTrendingKeywords(await client.trendingKeywords(6));
        } catch {
          if (trendingKeywords.length === 0) {
            setTrendingKeywords([]);
          }
        }
      }
    },
    [client, defaultSearchKeyword, trendingKeywords.length],
  );

  const ensureCommentsForItem = useCallback(
    async (item: VideoItem | null | undefined, force = false): Promise<CommentLoadResult> => {
      const itemKey = keyOf(item);
      if (!item || !itemKey) {
        return { status: "skipped" };
      }
      if (!force && itemKey in commentErrors) {
        return { status: "error", itemKey, error: commentErrors[itemKey] };
      }
      if (!force && itemKey in commentCache) {
        return { status: "loaded", itemKey, comments: commentCache[itemKey] ?? [] };
      }

      let aid = item.aid;
      let refererBvid = item.bvid;
      let cachedDetail = detailCache[itemKey];
      if (aid == null) {
        if (!cachedDetail) {
          try {
            cachedDetail = await client.video(itemKey);
            setDetailCache((prev) => ({ ...prev, [itemKey]: cachedDetail! }));
          } catch {
            return { status: "skipped", itemKey };
          }
        }
        aid = cachedDetail.aid;
        refererBvid = cachedDetail.bvid ?? refererBvid;
      }
      if (aid == null) {
        return { status: "skipped", itemKey };
      }

      try {
        const loadedComments = await client.comments(aid, 4, refererBvid);
        setCommentCache((prev) => ({ ...prev, [itemKey]: loadedComments }));
        setCommentLoaded((prev) => ({ ...prev, [itemKey]: true }));
        setCommentErrors((prev) => {
          const next = { ...prev };
          delete next[itemKey];
          return next;
        });
        return { status: "loaded", itemKey, comments: loadedComments };
      } catch (error) {
        const message = (error as Error).message;
        setCommentCache((prev) => ({ ...prev, [itemKey]: [] }));
        setCommentLoaded((prev) => {
          const next = { ...prev };
          delete next[itemKey];
          return next;
        });
        setCommentErrors((prev) => ({ ...prev, [itemKey]: message }));
        return { status: "error", itemKey, error: message };
      }
    },
    [commentCache, commentErrors, detailCache, client],
  );

  const ensureCommentsForSelected = useCallback(
    async (force = false): Promise<CommentLoadResult> => ensureCommentsForItem(items[selectedIndex], force),
    [ensureCommentsForItem, items, selectedIndex],
  );

  const refreshHomeMetaRef = useRef(refreshHomeMeta);
  const ensureCommentsForItemRef = useRef(ensureCommentsForItem);

  useEffect(() => {
    refreshHomeMetaRef.current = refreshHomeMeta;
  }, [refreshHomeMeta]);

  useEffect(() => {
    ensureCommentsForItemRef.current = ensureCommentsForItem;
  }, [ensureCommentsForItem]);

  useEffect(() => {
    const forceComments = forceCommentsOnNextLoad.current;
    forceCommentsOnNextLoad.current = false;
    const requestId = ++loadRequestIdRef.current;
    let disposed = false;

    const run = async () => {
      setLoading(true);
      try {
        let nextItems: VideoItem[] = [];
        if (mode === "search" && keyword) {
          nextItems = await client.search(keyword, page, limit);
        } else if (mode === "history") {
          nextItems = historyStore.getRecentVideos(limit);
        } else if (mode === "favorites") {
          nextItems = historyStore.getFavoriteVideos(limit);
        } else {
          await refreshHomeMetaRef.current();
          const channel = HOME_CHANNELS[channelIndex];
          if (channel.source === "recommend") {
            nextItems = await client.recommend(page, limit);
          } else if (channel.source === "popular") {
            nextItems = await client.popular(page, limit);
          } else if (channel.source === "precious") {
            nextItems = await client.precious(page, limit);
          } else {
            nextItems = await client.regionRanking(channel.rid ?? 1, 3, page, limit);
          }
        }

        if (disposed || requestId !== loadRequestIdRef.current) {
          return;
        }

        const nextSelectedIndex = clampSelection(selectedIndexRef.current, nextItems.length);
        setItems(nextItems);
        setSelectedIndex(nextSelectedIndex);
        setDetailMode(false);
        setDetailScroll(0);

        if (forceComments) {
          await ensureCommentsForItemRef.current(nextItems[nextSelectedIndex], true);
          if (disposed || requestId !== loadRequestIdRef.current) {
            return;
          }
        }

        setStatus(`已加载 ${nextItems.length} 条结果`);
      } catch (error) {
        if (disposed || requestId !== loadRequestIdRef.current) {
          return;
        }
        setItems([]);
        setSelectedIndex(0);
        setStatus(`错误: ${(error as Error).message}`);
      } finally {
        if (!disposed && requestId === loadRequestIdRef.current) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      disposed = true;
    };
  }, [channelIndex, client, historyStore, keyword, limit, mode, page, reloadToken]);

  useEffect(() => {
    void ensureCommentsForSelected(false);
  }, [ensureCommentsForSelected]);

  const refreshCurrentView = useCallback(async () => {
    if (mode === "hot") {
      await refreshHomeMeta(true);
    }
    forceCommentsOnNextLoad.current = true;
    setReloadToken((prev) => prev + 1);
    setStatus(`已刷新: ${title}`);
  }, [mode, refreshHomeMeta, title]);

  const refreshComments = useCallback(async () => {
    if (!selectedItem) {
      setStatus("当前没有可加载评论的视频");
      return;
    }
    const result = await ensureCommentsForSelected(true);
    if (result.status === "error") {
      setStatus(`评论加载失败: ${result.error}`);
      return;
    }
    if (result.status === "loaded") {
      setStatus(`已加载评论 ${result.comments.length} 条`);
      return;
    }
    setStatus("当前没有可加载评论的视频");
  }, [ensureCommentsForSelected, selectedItem]);

  const toggleSelectedFavorite = useCallback(() => {
    const item = detailMode ? detailItem : selectedItem;
    if (!item) {
      setStatus("当前没有可收藏的视频");
      return;
    }
    const added = historyStore.toggleFavorite(item);
    if (mode === "favorites") {
      setReloadToken((prev) => prev + 1);
    }
    setStatus(`${added ? "已收藏" : "已取消收藏"}: ${truncateDisplay(item.title, 40)}`);
  }, [detailItem, detailMode, historyStore, mode, selectedItem]);

  const openSelected = useCallback(async () => {
    if (!selectedItem) {
      setStatus("当前没有可打开的视频");
      return;
    }
    historyStore.addVideo(selectedItem);
    await openUrl(selectedItem.url);
    setStatus(`已打开: ${selectedItem.url}`);
  }, [historyStore, selectedItem]);

  const loadSelectedDetail = useCallback(async () => {
    if (!selectedItem) {
      setStatus("当前没有可查看的视频");
      return;
    }
    const itemKey = keyOf(selectedItem);
    if (!itemKey) {
      setStatus("当前视频缺少可查询标识");
      return;
    }
    try {
      const loaded = await client.video(itemKey);
      historyStore.addVideo(loaded);
      setDetailCache((prev) => ({ ...prev, [itemKey]: loaded }));
      setDetailMode(true);
      setDetailScroll(0);
      setStatus(`已加载详情: ${loaded.title}`);
    } catch (error) {
      setStatus(`错误: ${(error as Error).message}`);
    }
  }, [client, historyStore, selectedItem]);

  const rerunLastSearch = useCallback(() => {
    const recent = historyStore.getRecentKeywords(1)[0];
    if (!recent) {
      setStatus("没有最近搜索记录");
      return;
    }
    pushCurrentState();
    setMode("search");
    setPage(1);
    setKeyword(recent);
    setSelectedIndex(0);
  }, [historyStore, pushCurrentState]);

  const restorePreviousState = useCallback(() => {
    const result = popListState(listStack);
    const restored = result.state;
    setListStack(result.stack);
    if (!restored) {
      setStatus("没有可返回的列表状态");
      return;
    }
    setMode(restored.mode);
    setPage(restored.page);
    setKeyword(restored.keyword);
    setSelectedIndex(restored.selectedIndex);
    setChannelIndex(restored.channelIndex);
    setDetailMode(false);
    setDetailScroll(0);
    setStatus(`已返回: ${restored.mode === "search" ? restored.keyword : modeToken(false, restored.mode, HOME_CHANNELS, restored.channelIndex)}`);
  }, [listStack]);

  const switchMode = useCallback(
    (nextMode: AppMode, nextPage = 1, nextKeyword = keyword) => {
      pushCurrentState();
      setMode(nextMode);
      setPage(nextPage);
      setKeyword(nextKeyword);
      setSelectedIndex(0);
    },
    [keyword, pushCurrentState],
  );

  const triggerDefaultSearch = useCallback(async () => {
    let word = defaultSearchKeyword;
    if (!word) {
      try {
        word = await client.searchDefault();
        setDefaultSearchKeyword(word);
      } catch (error) {
        setStatus(`错误: ${(error as Error).message}`);
        return;
      }
    }
    if (!word) {
      setStatus("当前没有默认搜索词");
      return;
    }
    historyStore.addKeyword(word);
    switchMode("search", 1, word);
  }, [client, defaultSearchKeyword, historyStore, switchMode]);

  const cycleChannel = useCallback(
    (step: number) => {
      const nextIndex = (channelIndex + step + HOME_CHANNELS.length) % HOME_CHANNELS.length;
      if (mode !== "hot") {
        setChannelIndex(nextIndex);
        switchMode("hot", 1, keyword);
        return;
      }
      pushCurrentState();
      setChannelIndex(nextIndex);
      setPage(1);
      setSelectedIndex(0);
    },
    [channelIndex, keyword, mode, pushCurrentState, switchMode],
  );

  const setChannelDirect = useCallback(
    (index: number) => {
      const nextIndex = Math.max(0, Math.min(index, HOME_CHANNELS.length - 1));
      if (mode !== "hot") {
        setChannelIndex(nextIndex);
        switchMode("hot", 1, keyword);
        return;
      }
      pushCurrentState();
      setChannelIndex(nextIndex);
      setPage(1);
      setSelectedIndex(0);
    },
    [keyword, mode, pushCurrentState, switchMode],
  );

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      exit();
      return;
    }

    if (showHelp) {
      if (input === "?" || input === "q" || key.escape || key.return) {
        setShowHelp(false);
      }
      return;
    }

    if (promptState) {
      if (key.escape) {
        setPromptState(null);
        setStatus("已取消搜索");
        return;
      }
      if (key.return) {
        const value = promptState.value.trim();
        setPromptState(null);
        if (value) {
          historyStore.addKeyword(value);
          switchMode("search", 1, value);
        } else {
          setStatus("已取消搜索");
        }
        return;
      }
      if (key.backspace || input === "\b" || input === "\u007F") {
        setPromptState((prev) => (prev ? { ...prev, value: prev.value.slice(0, -1) } : prev));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setPromptState((prev) => (prev ? { ...prev, value: `${prev.value}${input}` } : prev));
      }
      return;
    }

    if (detailMode) {
      if (input === "?") {
        setShowHelp(true);
      } else if (key.escape || input === "b" || key.leftArrow) {
        setDetailMode(false);
        setDetailScroll(0);
        setStatus("已返回列表");
      } else if (key.upArrow || input === "k") {
        setDetailScroll((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow || input === "j") {
        setDetailScroll((prev) => prev + 1);
      } else if (key.pageUp) {
        setDetailScroll((prev) => Math.max(0, prev - 10));
      } else if (key.pageDown) {
        setDetailScroll((prev) => prev + 10);
      } else if (input === "o") {
        void openSelected();
      } else if (input === "f") {
        toggleSelectedFavorite();
      } else if (input === "c" || input === "r") {
        void refreshComments();
      } else if (input === "q") {
        exit();
      }
      return;
    }

    if (input === "q") {
      exit();
    } else if (input === "?") {
      setShowHelp(true);
    } else if (key.upArrow || input === "k") {
      setSelectedIndex((prev) => clampSelection(prev - 1, items.length));
    } else if (key.downArrow || input === "j") {
      setSelectedIndex((prev) => clampSelection(prev + 1, items.length));
    } else if (input === "b") {
      restorePreviousState();
    } else if (key.tab && key.shift) {
      cycleChannel(-1);
    } else if (key.tab) {
      cycleChannel(1);
    } else if (/^[1-9]$/.test(input)) {
      setChannelDirect(Number(input) - 1);
    } else if (input === "g") {
      setSelectedIndex(0);
    } else if (input === "G") {
      setSelectedIndex(Math.max(0, items.length - 1));
    } else if (key.return || key.rightArrow) {
      void loadSelectedDetail();
    } else if (input === "o") {
      void openSelected();
    } else if (input === "r") {
      void refreshCurrentView();
    } else if (input === "c") {
      void refreshComments();
    } else if (input === "h") {
      switchMode("hot");
    } else if (input === "v") {
      switchMode("history");
    } else if (input === "m") {
      switchMode("favorites");
    } else if (input === "f") {
      toggleSelectedFavorite();
    } else if (input === "l") {
      rerunLastSearch();
    } else if (input === "d") {
      void triggerDefaultSearch();
    } else if (input === "/" || input === "s") {
      setPromptState({ prompt: "搜索关键词: ", value: mode === "search" ? keyword : "" });
    } else if (input === "n" || key.pageDown) {
      if (mode === "history" || mode === "favorites") {
        setStatus("当前列表没有分页");
      } else {
        pushCurrentState();
        setPage((prev) => prev + 1);
        setSelectedIndex(0);
      }
    } else if (input === "p" || key.pageUp) {
      if (mode === "history" || mode === "favorites") {
        setStatus("当前列表没有分页");
      } else if (page > 1) {
        pushCurrentState();
        setPage((prev) => prev - 1);
        setSelectedIndex(0);
      } else {
        setStatus("已经是第一页");
      }
    }
  });

  const detailLines = useMemo(() => {
    if (!detailItem) {
      return ["没有结果。"];
    }
    return mergeDetailAndComments(buildDetailLines(detailItem, Math.max(20, columns - 8)), comments, commentError, Math.max(20, columns - 8));
  }, [columns, commentError, comments, detailItem]);

  const detailHeight = Math.max(4, rows - 8);
  const clampedScroll = Math.max(0, Math.min(detailScroll, Math.max(0, detailLines.length - detailHeight)));
  const visibleDetailLines = detailLines.slice(clampedScroll, clampedScroll + detailHeight);

  const listWidth = Math.max(28, Math.floor(columns * 0.42));
  const rightWidth = Math.max(28, columns - listWidth - 4);
  const commentPanelHeight = Math.max(6, Math.floor((rows - 10) * 0.45));
  const previewWidth = Math.max(20, rightWidth - 4);
  const featured = detailItem ?? selectedItem;
  const commentLoadedCurrent = selectedKey ? Boolean(commentLoaded[selectedKey]) : false;

  if (columns < 72 || rows < 18) {
    return (
      <Box flexDirection="column">
        <Text>终端太小，至少需要 72x18。</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box justifyContent="space-between">
        <Text color="magentaBright">BiliTerminal · {modeToken(detailMode, mode, HOME_CHANNELS, channelIndex)}</Text>
        <Text dimColor>{loading ? "加载中" : title}</Text>
      </Box>
      <Box justifyContent="space-between">
        <Text dimColor>{mode === "hot" ? `分区: ${HOME_CHANNELS[channelIndex]?.label ?? "首页"}` : mode === "search" ? `搜索: ${keyword}` : mode === "history" ? "最近浏览" : "收藏夹"}</Text>
        <Text dimColor>{`默认搜索: ${truncateDisplay(defaultSearchKeyword || "按 / 开始搜索", 24)}`}</Text>
      </Box>
      <Box>
        <Text dimColor>{truncateDisplay(`热搜: ${(trendingKeywords.length > 0 ? trendingKeywords.slice(0, 4).join(" · ") : "热点内容 · 分区导航 · 精选视频")}`, columns - 2)}</Text>
      </Box>

      {detailMode ? (
        <Box flexDirection="column" borderStyle="round" paddingX={1} paddingY={1} marginTop={1} minHeight={rows - 6}>
          <Text color="cyan">详情页 · j/k 滚动 · f 收藏 · o 浏览器打开 · c 刷新评论 · Esc 返回 · ? 帮助</Text>
          <Box flexDirection="column" marginTop={1}>
            {visibleDetailLines.map((line, index) => (
              <Text key={`${index}-${line}`} wrap="truncate-end" color={index === 0 ? "whiteBright" : line.includes("简介") || line.includes("热评") ? "magentaBright" : undefined} dimColor={/^([👤🔗🕒📅▶≡👍⭐🌐]|\d+\.)/.test(line) && !line.includes("热评") && !line.includes("简介") && !line.includes("评论加载失败") }>
                {line}
              </Text>
            ))}
          </Box>
          <Text dimColor>{`滚动 ${clampedScroll + 1}-${clampedScroll + visibleDetailLines.length} / ${detailLines.length}`}</Text>
        </Box>
      ) : (
        <Box flexGrow={1} marginTop={1} columnGap={1}>
          <Box flexDirection="column" width={listWidth} borderStyle="round" paddingX={1}>
            <Text color="cyan">列表 · {items.length} 条</Text>
            {items.length === 0 ? (
              <Text dimColor>{loading ? "正在加载..." : "没有结果。"}</Text>
            ) : (
              items.map((item, index) => {
                const selected = index === selectedIndex;
                const prefix = selected ? "›" : " ";
                const fav = historyStore.isFavorite(item) ? "★ " : "";
                return (
                  <Box key={item.url} flexDirection="column" marginTop={1}>
                    <Text inverse={selected}>{truncateDisplay(`${prefix} ${index + 1}. ${fav}${item.title}`, listWidth - 4)}</Text>
                    <Text dimColor>{truncateDisplay(`${item.author} · ${humanCount(item.play)} 播放 · ${item.duration}`, listWidth - 4)}</Text>
                    <Text dimColor>{truncateDisplay(`${item.bvid ?? item.aid ?? "-"} · ${formatTimestamp(item.pubdate)}`, listWidth - 4)}</Text>
                  </Box>
                );
              })
            )}
          </Box>

          <Box flexDirection="column" width={rightWidth} rowGap={1}>
            <Box flexDirection="column" borderStyle="round" paddingX={1} minHeight={Math.max(8, rows - commentPanelHeight - 8)}>
              <Text color="cyan">视频预览</Text>
              {featured ? (
                <>
                  <Text color="whiteBright">{truncateDisplay(`${historyStore.isFavorite(featured) ? "★ " : ""}${featured.title}`, previewWidth)}</Text>
                  <Text dimColor>{truncateDisplay(`UP主 ${featured.author}`, previewWidth)}</Text>
                  <Text dimColor>{truncateDisplay(`播放 ${humanCount(featured.play)} · 弹幕 ${humanCount(featured.danmaku)} · 时长 ${featured.duration}`, previewWidth)}</Text>
                  <Text dimColor>{truncateDisplay(`发布时间 ${formatTimestamp(featured.pubdate)}`, previewWidth)}</Text>
                  <Text dimColor>{truncateDisplay(`编号 ${featured.bvid ?? featured.aid ?? "-"}`, previewWidth)}</Text>
                  <Text color="magentaBright">简介</Text>
                  {wrapDisplay(featured.description || "暂无简介", previewWidth).slice(0, Math.max(3, rows - commentPanelHeight - 16)).map((line) => (
                    <Text key={line}>{line}</Text>
                  ))}
                </>
              ) : (
                <Text dimColor>当前没有选中的视频</Text>
              )}
            </Box>

            <Box flexDirection="column" borderStyle="round" paddingX={1} minHeight={commentPanelHeight}>
              <Text color="cyan">{mode === "favorites" ? "评论预览" : "热评预览"}</Text>
              {commentError && comments.length === 0 ? (
                <>
                  <Text color="red">{truncateDisplay(`评论加载失败: ${commentError}`, previewWidth)}</Text>
                  <Text dimColor>按 o 在浏览器查看完整评论</Text>
                  <Text dimColor>按 c 重试，按 r 刷新页面</Text>
                </>
              ) : comments.length === 0 ? (
                <>
                  <Text dimColor>{commentLoadedCurrent ? "当前视频暂无可显示热评" : "按 c 加载当前视频评论"}</Text>
                  <Text dimColor>{commentLoadedCurrent ? "按 r 刷新页面，按 o 浏览器查看" : "r 刷新当前视图"}</Text>
                </>
              ) : (
                comments.map((comment, index) => (
                  <Box key={`${comment.author}-${index}`} flexDirection="column" marginTop={index === 0 ? 0 : 1}>
                    <Text color={index === 0 ? "magentaBright" : "white"}>{truncateDisplay(`${index + 1}. ${comment.author} · ${humanCount(comment.like)} 赞 · ${formatTimestamp(comment.ctime)}`, previewWidth)}</Text>
                    {wrapDisplay(comment.message || "暂无评论内容", previewWidth).slice(0, 3).map((line) => (
                      <Text key={`${index}-${line}`}>{line}</Text>
                    ))}
                  </Box>
                ))
              )}
            </Box>
          </Box>
        </Box>
      )}

      <Box marginTop={1} flexDirection="column">
        <Text dimColor>{detailMode ? "j/k 滚动  f 收藏  o 浏览器打开  c 评论  Esc 返回  q 退出" : "Tab 分区  1-9 直选  / 搜索  f 收藏  m 收藏夹  c 评论  Enter 详情  q 退出"}</Text>
        <Text color="green">状态: {status}</Text>
      </Box>

      {showHelp ? (
        <Box flexDirection="column" borderStyle="double" paddingX={1} paddingY={1} marginTop={1}>
          <Text color="magentaBright">帮助</Text>
          <Text>j / k, ↑ / ↓   移动选中项</Text>
          <Text>Enter          打开详情页</Text>
          <Text>Esc / b        返回</Text>
          <Text>/ 或 s         搜索，支持中文输入</Text>
          <Text>Tab / Shift+Tab 切换首页分区</Text>
          <Text>1-9            直接切换对应分区</Text>
          <Text>l              重跑最近一次搜索</Text>
          <Text>h / v / m      首页 / 历史 / 收藏夹</Text>
          <Text>f              收藏 / 取消收藏当前视频</Text>
          <Text>n / p          下一页 / 上一页</Text>
          <Text>o / c / r      打开 / 评论 / 刷新</Text>
          <Text dimColor>{`最近搜索: ${historyStore.getRecentKeywords(3).join(", ") || "无"}`}</Text>
        </Box>
      ) : null}

      {promptState ? (
        <Box borderStyle="round" paddingX={1} marginTop={1}>
          <Text color="yellow">{promptState.prompt}{promptState.value}</Text>
        </Box>
      ) : null}
    </Box>
  );
}
