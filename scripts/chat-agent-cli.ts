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
import { run, user, type StreamedRunResult } from "@openai/agents";
import { fitnessAgent } from "../lib/fitness-agent";
import { appendHistory, sendDolorGreeting } from "../lib/dolor-chat";
import { UpstashSession } from "../lib/upstash-session";
import {
  getFinalResponseText,
  getLogLineFromEvent,
  getTextDeltaFromEvent,
} from "../lib/run-stream-utils";
import { withSessionContext } from "../lib/session-context";
import isProduction from "../lib/environment";

const EXIT_COMMANDS = new Set(["exit", "quit", "q", ":q"]);
const SESSION_TTL_SECONDS: number | undefined = isProduction() ? undefined : 600;

const streamCliRun = async (
  result: StreamedRunResult<any, any>,
) => {
  let printedAssistantLabel = false;
  let textBuffer = "";
  for await (const event of result) {
    const logLine = getLogLineFromEvent(event, "cli");
    if (logLine) {
      stdout.write(`\n${logLine}\n`);
    }
    const delta = getTextDeltaFromEvent(event);
    if (delta) {
      if (!printedAssistantLabel) {
        stdout.write("Dolor: ");
        printedAssistantLabel = true;
      }
      textBuffer += delta;
      stdout.write(delta);
    }
  }
  await result.completed.catch(() => {});
  if (printedAssistantLabel) {
    stdout.write("\n\n");
  }
  if (!textBuffer.trim()) {
    const fallback = (await getFinalResponseText(result)).trim();
    if (fallback) {
      stdout.write(`Dolor: ${fallback}\n\n`);
    }
  }
};

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
  const session = new UpstashSession(
    SESSION_TTL_SECONDS !== undefined ? { ttlSeconds: SESSION_TTL_SECONDS } : undefined,
  );

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
      const sessionId = await session.getSessionId();
      const result = await withSessionContext({ sessionId }, () =>
        run(fitnessAgent, [user(input)], {
          session,
          sessionInputCallback: appendHistory,
          stream: true,
        }),
      );
      await streamCliRun(result as any);
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
