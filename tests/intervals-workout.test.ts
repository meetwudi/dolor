import { describe, expect, test } from "bun:test";
import {
  buildIntervalsWorkoutText,
  validateIntervalsWorkoutText,
} from "../lib/intervals-workout";

describe("buildIntervalsWorkoutText", () => {
  test("builds a structured workout text", () => {
    const text = buildIntervalsWorkoutText({
      sections: [
        {
          title: "Warmup",
          steps: [
            {
              duration: { minutes: 10 },
              segments: [
                {
                  kind: "ramp",
                  start: 55,
                  end: 75,
                },
                {
                  kind: "cadence",
                  min: 90,
                  max: 100,
                },
              ],
            },
          ],
        },
        {
          title: "Main Set",
          repeat: 3,
          steps: [
            {
              duration: { minutes: 5 },
              segments: [
                { kind: "percent", value: 90 },
                { kind: "cadence", value: 95 },
              ],
            },
            {
              duration: { minutes: 3 },
              segments: [
                { kind: "percent", value: 65 },
                { kind: "cadence", value: 85 },
              ],
            },
          ],
        },
        {
          title: "Cooldown",
          steps: [
            {
              duration: { minutes: 10 },
              segments: [
                {
                  kind: "ramp",
                  start: 75,
                  end: 55,
                },
                { kind: "cadence", value: 85 },
              ],
            },
          ],
        },
      ],
    });

    expect(text).toBe(
      [
        "Warmup",
        "- 10m ramp 55-75% FTP 90-100rpm",
        "",
        "Main Set 3x",
        "- 5m 90% FTP 95rpm",
        "- 3m 65% FTP 85rpm",
        "",
        "Cooldown",
        "- 10m ramp 75-55% FTP 85rpm",
      ].join("\n"),
    );
  });

  test("merges prompt and note into inline text", () => {
    const text = buildIntervalsWorkoutText({
      sections: [
        {
          title: "Main Set",
          steps: [
            {
              prompt: "Settle into Z2. Fuel 60-90g carbs/h; sip every 10-15m.",
              notes: "Stay relaxed.",
              duration: { minutes: 75 },
              segments: [
                { kind: "percentRange", min: 65, max: 75 },
                { kind: "cadence", min: 85, max: 95 },
              ],
            },
          ],
        },
      ],
    });

    expect(text).toBe(
      [
        "Main Set",
        "- Settle into Z2. Fuel 60-90g carbs/h; sip every 10-15m. Stay relaxed. 75m 65-75% FTP 85-95rpm",
      ].join("\n"),
    );
  });

  test("supports zone-based ramps", () => {
    const text = buildIntervalsWorkoutText({
      sections: [
        {
          title: "Tempo",
          steps: [
            {
              duration: { minutes: 10 },
              segments: [
                {
                  kind: "ramp",
                  start: "z1",
                  end: "z2",
                },
                {
                  kind: "cadence",
                  min: 90,
                  max: 100,
                },
              ],
            },
            {
              duration: { minutes: 5 },
              segments: [
                {
                  kind: "ramp",
                  start: "z2",
                },
              ],
            },
          ],
        },
      ],
    });

    expect(text).toBe(
      [
        "Tempo",
        "- 10m ramp Z1-Z2 90-100rpm",
        "- 5m ramp Z2",
      ].join("\n"),
    );
  });
});

describe("validateIntervalsWorkoutText", () => {
  test("parses a valid workout", () => {
    const result = validateIntervalsWorkoutText(
      [
        "Warmup",
        "- 10m ramp 55-75% FTP 90-100rpm",
        "",
        "Main Set 3x",
        "- 5m 90% FTP 95rpm",
        "- 3m 65% FTP 85rpm",
        "",
        "Cooldown",
        "- 10m ramp 75-55% FTP 85rpm",
      ].join("\n"),
    );

    expect(result.valid).toBe(true);
    if (!result.sections) {
      throw new Error("Expected parsed sections");
    }
    expect(result.sections.length).toBe(3);
    const mainSet = result.sections[1];
    if (!mainSet) {
      throw new Error("Expected main set section");
    }
    expect(mainSet.repeat).toBe(3);
    const firstStep = mainSet.steps[0];
    if (!firstStep) {
      throw new Error("Expected first step");
    }
    expect(firstStep.durations).toContain("5m");
    expect(firstStep.percents).toContain("90% FTP");
  });

  test("detects missing duration", () => {
    const result = validateIntervalsWorkoutText(
      ["Warmup", "- steady ride Z2"].join("\n"),
    );

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    const firstError = result.errors[0];
    expect(firstError).toMatch("missing a duration");
  });

  test("recognizes zone ramps", () => {
    const result = validateIntervalsWorkoutText(
      [
        "Tempo",
        "- 10m ramp Z1-Z2 90-95rpm",
        "- 5m ramp Z2",
      ].join("\n"),
    );

    expect(result.valid).toBe(true);
    if (!result.sections) {
      throw new Error("Expected sections");
    }
    const tempo = result.sections[0];
    if (!tempo) {
      throw new Error("Expected tempo section");
    }
    const firstTempoStep = tempo.steps[0];
    const secondTempoStep = tempo.steps[1];
    if (!firstTempoStep || !secondTempoStep) {
      throw new Error("Expected both tempo steps");
    }
    expect(firstTempoStep.ramps).toContain("ramp Z1-Z2");
    expect(secondTempoStep.ramps).toContain("ramp Z2");
  });

  test("rejects decimal durations and distances", () => {
    const result = validateIntervalsWorkoutText(
      [
        "Bad Plan",
        "- 5.5h endurance Z2",
        "- 1.5km easy jog",
      ].join("\n"),
    );

    expect(result.valid).toBe(false);
    expect(result.errors.some((msg) => msg.includes("whole-number"))).toBe(true);
  });
});
