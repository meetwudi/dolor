import { describe, expect, test } from "bun:test";
import { buildIntervalsInstruction } from "../lib/dolor-chat";

describe("buildIntervalsInstruction", () => {
  test("includes anti-solicitation and request-only workout guidance", () => {
    const instruction = buildIntervalsInstruction({ athleteId: "1234" });

    expect(instruction).toContain(
      "If the user did not ask for a workout, do not suggest a workout.",
    );
    expect(instruction).toContain(
      "Never add follow-up solicitation language like \"if you want...\", \"let me know if...\", \"I can also...\", or \"would you like...\".",
    );
    expect(instruction).toContain(
      "Do not end with optional offers or invitations unless the user explicitly asks for options.",
    );
    expect(instruction).toContain(
      "Do not ask follow-up questions unless needed to fill missing required information.",
    );
  });
});
