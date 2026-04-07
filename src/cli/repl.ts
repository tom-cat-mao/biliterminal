import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { parseArgsStringToArgv } from "string-argv";
import type { CommandContext } from "./commands.js";
import {
  runComments,
  runFavorite,
  runFavoritesList,
  runFavoritesOpen,
  runFavoritesRemove,
  runHistory,
  runHot,
  runOpen,
  runSearch,
  runTrending,
  runVideo,
} from "./commands.js";

const INTRO = [
  "Bilibili CLI 已启动。",
  "可用命令: hot [页码] [数量], search <关键词> [页码] [数量], video <BV号|av号|URL|序号>, favorite <序号|BV号|URL>, favorites [open|remove], open <序号|BV号|URL>, exit",
].join("\n");

export async function runRepl(ctx: CommandContext): Promise<void> {
  const rl = readline.createInterface({ input, output });
  ctx.out?.log(INTRO);
  try {
    while (true) {
      let answer: string;
      try {
        answer = await rl.question("bili> ");
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
        if (message.includes("aborted") || message.includes("closed") || message.includes("cancel")) {
          break;
        }
        throw error;
      }
      const line = answer.trim();
      if (!line) {
        continue;
      }
      if (["exit", "quit"].includes(line)) {
        break;
      }
      try {
        const argv = parseArgsStringToArgv(line);
        const [command, ...rest] = argv;
        switch (command) {
          case "hot":
            await runHot(Number(rest[0] ?? 1), Number(rest[1] ?? 10), ctx);
            break;
          case "search": {
            if (rest.length === 0) {
              throw new Error("用法: search <关键词> [页码] [数量]");
            }
            let page = 1;
            let limit = 10;
            const parts = [...rest];
            if (parts.length >= 2 && /^\d+$/.test(parts.at(-1)!)) {
              limit = Number(parts.pop());
            }
            if (parts.length >= 2 && /^\d+$/.test(parts.at(-1)!)) {
              page = Number(parts.pop());
            }
            await runSearch(parts.join(" "), page, limit, ctx);
            break;
          }
          case "video":
            if (!rest[0]) throw new Error("用法: video <BV号|av号|URL|序号>");
            await runVideo(rest[0], ctx);
            break;
          case "history":
            runHistory(ctx);
            break;
          case "favorite":
            if (!rest[0]) throw new Error("用法: favorite <序号|BV号|av号|URL>");
            await runFavorite(rest[0], ctx);
            break;
          case "favorites":
            if (!rest[0]) {
              runFavoritesList(ctx);
              break;
            }
            if (rest[0] === "open" && rest[1]) {
              await runFavoritesOpen(rest[1], ctx);
              break;
            }
            if (rest[0] === "remove" && rest[1]) {
              runFavoritesRemove(rest[1], ctx);
              break;
            }
            throw new Error("用法: favorites [open <序号|BV号|av号|URL> | remove <序号|BV号|av号|URL>]");
          case "comments": {
            if (!rest[0]) throw new Error("用法: comments <BV号|av号|URL|序号> [数量]");
            let limit = 5;
            const parts = [...rest];
            if (/^\d+$/.test(parts.at(-1)!)) {
              limit = Number(parts.pop());
            }
            await runComments(parts.join(" "), limit, ctx);
            break;
          }
          case "open":
            if (!rest[0]) throw new Error("用法: open <序号|BV号|URL>");
            await runOpen(rest[0], ctx);
            break;
          case "trending":
            await runTrending(Number(rest[0] ?? 10), ctx);
            break;
          default:
            throw new Error(`未知命令: ${command}`);
        }
      } catch (error) {
        ctx.out?.log(`错误: ${(error as Error).message}`);
      }
    }
  } finally {
    rl.close();
  }
}
