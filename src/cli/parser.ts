import { Command } from "commander";
import type { CommandContext } from "./commands.js";
import { executeParsedCommand } from "./commands.js";

export function buildProgram(ctx: CommandContext): Command {
  const program = new Command();
  program.name("biliterminal").description("把 Bilibili 常用浏览操作搬到终端里。");

  program.command("repl").description("进入交互模式").action(async () => {
    await executeParsedCommand("repl", {}, ctx);
  });

  program.command("tui").description("进入全屏终端界面").action(async () => {
    await executeParsedCommand("tui", {}, ctx);
  });

  program.command("hot").description("查看热门视频").option("-p, --page <page>", "页码", "1").option("-n, --limit <limit>", "数量", "10").action(async (options) => {
    await executeParsedCommand("hot", { page: Number(options.page), limit: Number(options.limit) }, ctx);
  });

  program.command("recommend").description("查看首页推荐流").option("-p, --page <page>", "页码", "1").option("-n, --limit <limit>", "数量", "10").action(async (options) => {
    await executeParsedCommand("recommend", { page: Number(options.page), limit: Number(options.limit) }, ctx);
  });

  program.command("precious").description("查看入站必刷").option("-p, --page <page>", "页码", "1").option("-n, --limit <limit>", "数量", "10").action(async (options) => {
    await executeParsedCommand("precious", { page: Number(options.page), limit: Number(options.limit) }, ctx);
  });

  program.command("search").description("搜索视频").argument("<keyword>", "关键词").option("-p, --page <page>", "页码", "1").option("-n, --limit <limit>", "数量", "10").action(async (keyword, options) => {
    await executeParsedCommand("search", { keyword, page: Number(options.page), limit: Number(options.limit) }, ctx);
  });

  program.command("comments").description("查看视频热评").argument("<ref>", "BV号 / av号 / URL").option("-n, --limit <limit>", "数量", "5").action(async (ref, options) => {
    await executeParsedCommand("comments", { ref, limit: Number(options.limit) }, ctx);
  });

  program.command("trending").description("查看首页热搜词").option("-n, --limit <limit>", "数量", "10").action(async (options) => {
    await executeParsedCommand("trending", { limit: Number(options.limit) }, ctx);
  });

  program.command("video").description("查看视频详情").argument("<ref>", "BV号 / av号 / URL").action(async (ref) => {
    await executeParsedCommand("video", { ref }, ctx);
  });

  program.command("open").description("浏览器打开视频").argument("<ref>", "BV号 / av号 / URL").action(async (ref) => {
    await executeParsedCommand("open", { ref }, ctx);
  });

  program.command("favorite").description("将视频加入收藏夹").argument("<ref>", "BV号 / av号 / URL").action(async (ref) => {
    await executeParsedCommand("favorite", { ref }, ctx);
  });

  const favorites = program.command("favorites").description("查看或操作收藏夹");
  favorites.action(async () => {
    await executeParsedCommand("favorites", {}, ctx);
  });
  favorites.command("open").argument("<ref>", "收藏夹序号 / BV号 / av号 / URL").action(async (ref) => {
    await executeParsedCommand("favorites", { favoritesAction: "open", ref }, ctx);
  });
  favorites.command("remove").argument("<ref>", "收藏夹序号 / BV号 / av号 / URL").action(async (ref) => {
    await executeParsedCommand("favorites", { favoritesAction: "remove", ref }, ctx);
  });

  program.command("history").description("查看最近搜索和最近浏览").action(async () => {
    await executeParsedCommand("history", {}, ctx);
  });

  return program;
}
