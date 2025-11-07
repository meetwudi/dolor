#!/usr/bin/env bun
/**
 * Usage:
 *   bun run agent
 *   bun run agent -- --athlete-id 123456
 *   bun scripts/chat-agent-cli.ts --athlete-id 123456
 */
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { parseArgs } from "node:util";
import {
  extractAllTextOutput,
  MemorySession,
  run,
  user,
} from "@openai/agents";
import { fitnessAgent } from "../lib/fitness-agent";
import { appendHistory, sendDolorGreeting } from "../lib/dolor-chat";

const EXIT_COMMANDS = new Set(["exit", "quit", "q", ":q"]);

async function main() {
  if (!Bun.env.OPENAI_API_KEY) {
    console.error("Missing OPENAI_API_KEY environment variable.");
    process.exitCode = 1;
    return;
  }

  const parsed = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      "athlete-id": { type: "string", short: "a" },
    },
    allowPositionals: true,
  });

  const athleteId = parsed.values["athlete-id"];

  const rl = readline.createInterface({ input: stdin, output: stdout });
  const session = new MemorySession();

  console.log(
    athleteId
      ? `Chatting with Dolor using athlete ${athleteId}. Type 'exit' to leave.\n`
      : "Chatting with Dolor. Pass --athlete-id <id> to auto-fill tool calls. Type 'exit' to leave.\n",
  );

  const greeting = await sendDolorGreeting({ session, athleteId });
  console.log(`Dolor: ${greeting.trim()}\n`);

  while (true) {
    const input = (await rl.question("me: ")).trim();
    if (!input) continue;
    if (EXIT_COMMANDS.has(input.toLowerCase())) break;

    try {
      const result = await run(fitnessAgent, [user(input)], {
        session,
        sessionInputCallback: appendHistory,
      });
      const reply =
        typeof result.finalOutput === "string"
          ? result.finalOutput
          : extractAllTextOutput(result.newItems) || "[No response]";

      console.log(`Dolor: ${reply.trim()}\n`);
    } catch (error) {
      console.error(
        `Dolor (error): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  rl.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
