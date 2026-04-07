import { describe, expect, it } from "vitest";
import { createCommandContext } from "../../src/cli/commands.js";
import { buildProgram } from "../../src/cli/parser.js";

describe("cli/parser", () => {
  it("会公开全部主命令与交互入口", () => {
    const program = buildProgram(createCommandContext({} as never, {} as never));
    const commandNames = program.commands.map((command) => command.name());

    expect(commandNames).toEqual(
      expect.arrayContaining(["repl", "tui", "hot", "recommend", "precious", "search", "comments", "trending", "video", "open", "favorite", "favorites", "history"]),
    );

    const favorites = program.commands.find((command) => command.name() === "favorites");
    expect(favorites?.commands.map((command) => command.name())).toEqual(["open", "remove"]);
  });
});
