import process from "node:process";
import React from "react";
import { render } from "ink";
import { BilibiliAPIError } from "./core/types.js";
import { BilibiliClient } from "./api/bilibili-client.js";
import { HistoryStore } from "./storage/history-store.js";
import { createCommandContext } from "./cli/commands.js";
import { buildProgram } from "./cli/parser.js";
import { runRepl } from "./cli/repl.js";
import { BiliTerminalApp } from "./tui/App.js";

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const client = new BilibiliClient();
  const historyStore = new HistoryStore();
  const ctx = createCommandContext(client, historyStore);

  try {
    if (argv.length === 0 || argv[0] === "tui") {
      const app = render(<BiliTerminalApp client={client} historyStore={historyStore} />, {
        exitOnCtrlC: false,
        patchConsole: true,
      });
      await app.waitUntilExit();
      return 0;
    }

    if (argv[0] === "repl") {
      await runRepl(ctx);
      return 0;
    }

    const program = buildProgram(ctx);
    await program.parseAsync([process.argv[0] ?? "node", process.argv[1] ?? "biliterminal", ...argv], { from: "node" });
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`错误: ${message}\n`);
    return error instanceof BilibiliAPIError || error instanceof Error ? 1 : 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main().then((code) => {
    process.exitCode = code;
  });
}
