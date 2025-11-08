import { tool } from "@openai/agents";
import { z } from "zod";
import {
  WorkoutPlanInputSchema,
  buildIntervalsWorkoutText,
  validateIntervalsWorkoutText,
} from "./intervals-workout";

const WORKOUT_SYNTAX_GUIDE = `
Intervals.icu Workout DSL
- Section headers (e.g., "Warmup", "Main Set 4x", "Cooldown") are plain lines with optional "Nx" suffix for repeats.
- Steps start with "- " followed by duration or distance. Accepted tokens:
  • Time: "30s", "5m", "1m30", "1h15".
  • Distance: "400m", "1km", "2.5mi".
  • Intensity targets: percents of FTP/HR/LTHR/pace ("90% FTP", "75-85% HR"), power ("280w", "250-300w"), pace ("4:30/km", "4:15-4:25/km"), or zones ("Z2", "Z3 HR", "Z2 Pace").
  • Ramps: "ramp 60-90% FTP", "ramp 200-350w".
  • Cadence: "95rpm", "70-80rpm".
  • Text before the first duration/distance becomes the on-device prompt; trailing "# note" becomes a comment.
  • You can mix multiple targets (e.g., "90% FTP 95rpm").
  • Durations and distances use whole numbers—write 5h30m instead of 5.5h, 1500m instead of 1.5km.
- Pick one modality per workout: do not mix HR-targeted and power-targeted steps in the same plan (pace-only workouts are fine on their own).
- Repeats: put "Nx" on the section line or in free text ("Main Set 3x") then enumerate the repeated steps.
- Examples:
  Warmup
  - 10m ramp 55-75% FTP 90-100rpm

  Main Set 3x
  - 5m 95% FTP 95rpm
  - 3m 65% FTP 85rpm

  Cooldown
  - 10m 60% FTP easy spin

  Long Endurance
  - 5h30m 70% FTP smooth endurance
`.trim();

export const buildIntervalsWorkoutTool = tool({
  name: "build_intervals_workout",
  description:
    "Generate Intervals.icu workout Markdown deterministically from structured sections and steps (durations, targets, cadence, ramps, etc.). Use this whenever you want consistent formatting without relying on free-form replies.\n\n" +
    WORKOUT_SYNTAX_GUIDE,
  parameters: z.object({
    plan_json: z
      .string()
      .min(2)
      .describe(
        "Stringified JSON matching { sections: [{ title, repeat, steps: [{ prompt, duration, distance, segments, notes }] }] }. Supply empty strings or [] when a field is unused.",
      ),
  }),
  execute: async ({ plan_json }) => {
    let plan;
    try {
      const parsed = JSON.parse(plan_json);
      plan = WorkoutPlanInputSchema.parse(parsed);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid plan_json payload.";
      throw new Error(`Failed to parse plan_json: ${message}`);
    }
    const text = buildIntervalsWorkoutText(plan);
    const validation = validateIntervalsWorkoutText(text);
    return {
      text,
      validation,
    };
  },
});

export const validateIntervalsWorkoutTool = tool({
  name: "validate_intervals_workout",
  description:
    "Validate existing Intervals.icu workout text. Returns parsed sections, steps, and any formatting errors so you can fix and regenerate if needed.\n\n" +
    WORKOUT_SYNTAX_GUIDE,
  parameters: z.object({
    text: z.string().min(1, "Workout text is required."),
  }),
  execute: async ({ text }) => validateIntervalsWorkoutText(text),
});
