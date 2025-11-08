import { z } from "zod";

type NonEmptyArray<T> = [T, ...T[]];

const formatNumber = (value: number) => {
  if (Number.isInteger(value)) return `${value}`;
  return value.toFixed(2).replace(/\.?0+$/, "");
};

const hasAnyValue = (record: Record<string, number | undefined>) =>
  Object.values(record).some((value) => typeof value === "number" && value > 0);

export type TimeDurationInput = {
  hours?: number;
  minutes?: number;
  seconds?: number;
};

export type DistanceInput = {
  value: number;
  unit: "m" | "km" | "mi" | "yd";
};

const renderTimeDuration = (duration: TimeDurationInput) => {
  if (!hasAnyValue(duration)) {
    throw new Error("Time duration must include hours, minutes, or seconds.");
  }
  const parts: string[] = [];
  if (duration.hours) parts.push(`${duration.hours}h`);
  if (duration.minutes) parts.push(`${duration.minutes}m`);
  if (duration.seconds) {
    const suffix = duration.hours || duration.minutes ? `${duration.seconds}` : `${duration.seconds}s`;
    parts.push(suffix);
  }
  return parts.join("") || "0s";
};

const renderDistance = (distance: DistanceInput) => {
  if (!distance.value || distance.value <= 0) {
    throw new Error("Distance must be greater than zero.");
  }
  return `${formatNumber(distance.value)}${distance.unit}`;
};

export type PercentSegment = {
  kind: "percent";
  value: number;
  of?: string;
};

export type PercentRangeSegment = {
  kind: "percentRange";
  min: number;
  max: number;
  of?: string;
};

export type ZoneSegment = {
  kind: "zone";
  zone: number | string;
  modality?: "power" | "hr" | "pace";
};

export type PowerSegment = {
  kind: "power";
  value: number;
  unit?: "w" | "w/kg";
};

export type PowerRangeSegment = {
  kind: "powerRange";
  min: number;
  max: number;
  unit?: "w" | "w/kg";
};

export type CadenceSegment = {
  kind: "cadence";
  value?: number;
  min?: number;
  max?: number;
  unit?: "rpm";
};

type RampEndpoint = number | string;

export type RampSegment = {
  kind: "ramp";
  start: RampEndpoint;
  end?: RampEndpoint;
  unit?: "percent" | "w" | "w/kg";
  of?: string;
};

export type PaceSegment = {
  kind: "pace";
  value: string;
};

export type PaceRangeSegment = {
  kind: "paceRange";
  min: string;
  max: string;
};

export type TextSegment = {
  kind: "text";
  text: string;
};

export type PressLapSegment = {
  kind: "pressLap";
  text?: string;
};

export type WorkoutStepSegmentInput =
  | PercentSegment
  | PercentRangeSegment
  | ZoneSegment
  | PowerSegment
  | PowerRangeSegment
  | CadenceSegment
  | RampSegment
  | PaceSegment
  | PaceRangeSegment
  | TextSegment
  | PressLapSegment
  | string;

export type WorkoutStepInput = {
  prompt?: string;
  duration?: TimeDurationInput;
  distance?: DistanceInput;
  segments?: WorkoutStepSegmentInput[];
  notes?: string;
};

export type WorkoutSectionInput = {
  title: string;
  repeat?: number;
  steps: NonEmptyArray<WorkoutStepInput>;
};

export type WorkoutPlanInput = {
  sections: NonEmptyArray<WorkoutSectionInput>;
};

const renderPercentLabel = (label?: string) => (label ? label.toUpperCase() : "FTP");

const isZoneToken = (value: string) =>
  /^z\d+(?:\s*(?:hr|pace))?$/i.test(value.trim());

const normalizeZoneToken = (value: string) => {
  const match = value.trim().match(/^z(\d+)(?:\s*(hr|pace))?$/i);
  if (!match) return value.trim().toUpperCase();
  const [, zone, modality] = match;
  return `Z${zone}${modality ? ` ${modality.toUpperCase()}` : ""}`;
};

const formatRampLabel = (value: RampEndpoint | undefined) => {
  if (value === undefined) return "";
  if (typeof value === "string") {
    return isZoneToken(value) ? normalizeZoneToken(value) : value.trim().toUpperCase();
  }
  return formatNumber(value);
};

const renderSegment = (segment: WorkoutStepSegmentInput) => {
  if (typeof segment === "string") {
    return segment.trim();
  }
  switch (segment.kind) {
    case "percent":
      return `${formatNumber(segment.value)}% ${renderPercentLabel(segment.of)}`.trim();
    case "percentRange":
      return `${formatNumber(segment.min)}-${formatNumber(segment.max)}% ${renderPercentLabel(segment.of)}`.trim();
    case "zone": {
      const modality = segment.modality ? ` ${segment.modality.toUpperCase()}` : "";
      return `Z${segment.zone}${modality}`.trim();
    }
    case "power":
      return `${formatNumber(segment.value)}${segment.unit ?? "w"}`;
    case "powerRange":
      return `${formatNumber(segment.min)}-${formatNumber(segment.max)}${segment.unit ?? "w"}`;
    case "cadence": {
      const unit = segment.unit ?? "rpm";
      if (typeof segment.value === "number") {
        return `${formatNumber(segment.value)}${unit}`;
      }
      if (
        typeof segment.min === "number" &&
        typeof segment.max === "number"
      ) {
        return `${formatNumber(segment.min)}-${formatNumber(segment.max)}${unit}`;
      }
      throw new Error("Cadence segment needs value or min+max.");
    }
    case "ramp": {
      if (segment.start === undefined) {
        throw new Error("Ramp segment requires a start value.");
      }
      const numericStart = typeof segment.start === "number";
      const numericEnd =
        segment.end === undefined || typeof segment.end === "number";
      const numericRamp = numericStart && numericEnd;
      const startLabel = formatRampLabel(segment.start);
      const endLabel = formatRampLabel(segment.end);
      const range = endLabel ? `${startLabel}-${endLabel}` : startLabel;

      if (numericRamp) {
        const unit = segment.unit ?? "percent";
        const suffix =
          unit === "percent"
            ? "%"
            : unit === "w"
              ? "w"
              : unit === "w/kg"
                ? "w/kg"
                : "";
        const label =
          segment.of && segment.of.trim()
            ? ` ${renderPercentLabel(segment.of)}`
            : unit === "percent"
              ? " FTP"
              : "";
        return `ramp ${range}${suffix}${label}`.trim();
      }

      const modalityLabel =
        segment.of && segment.of.trim()
          ? ` ${renderPercentLabel(segment.of)}`
          : "";
      return `ramp ${range}${modalityLabel}`.trim();
    }
    case "pace":
      return segment.value;
    case "paceRange":
      return `${segment.min}-${segment.max}`;
    case "pressLap":
      return segment.text?.trim() ?? "Press lap to continue";
    case "text":
      return segment.text.trim();
    default:
      return "";
  }
};

export const buildIntervalsWorkoutText = ({ sections }: WorkoutPlanInput) => {
  if (!sections?.length) {
    throw new Error("At least one section is required.");
  }
  const sectionTexts = sections.map((section) => {
    if (!section.steps?.length) {
      throw new Error(`Section "${section.title}" needs at least one step.`);
    }
    const heading = section.repeat
      ? `${section.title} ${section.repeat}x`
      : section.title;
    const stepLines = section.steps.map((step) => {
      if (!step.duration && !step.distance) {
        throw new Error(
          `Step in "${section.title}" needs a duration or distance.`,
        );
      }
      const tokens: string[] = [];
      if (step.duration) tokens.push(renderTimeDuration(step.duration));
      if (step.distance) tokens.push(renderDistance(step.distance));
      if (step.segments?.length) {
        for (const segment of step.segments) {
          const rendered = renderSegment(segment);
          if (rendered) tokens.push(rendered);
        }
      }

      const prompt = step.prompt?.trim();
      const note = step.notes?.trim();
      const textPrefix = [prompt, note].filter(Boolean).join(" ").trim();
      const metrics = tokens.join(" ");
      const fullLine = [textPrefix, metrics]
        .filter((chunk) => chunk && chunk.length)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      return `- ${fullLine}`;
    });
    return [heading, ...stepLines].join("\n");
  });

  return sectionTexts.join("\n\n");
};

const STEP_PREFIX = /^-\s+/;

const DURATION_PATTERN = /\b\d+(?:h|hr|hrs|hour|hours|m|min|mins|minute|minutes|s|sec|secs|second|seconds)\b|\b\d+m\d+\b/gi;
const DISTANCE_PATTERN = /\b\d+(?:km|mi|m|meter|meters|yd|yds)\b/gi;
const PERCENT_PATTERN = /\b\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?%\s*(?:FTP|HR|max|LTHR|pace)?\b/gi;
const ZONE_PATTERN = /\bZ\d+(?:\s*(?:HR|Pace))?\b/gi;
const POWER_PATTERN = /\b\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?\s*(?:w|W|w\/kg|W\/kg)\b/gi;
const CADENCE_PATTERN = /\b\d+(?:-\d+)?\s*(?:rpm|RPM)\b/gi;
const RAMP_PATTERN =
  /\bramp\s+(?:z\d+(?:\s*(?:hr|pace))?|\d+(?:\.\d+)?)(?:-(?:z\d+(?:\s*(?:hr|pace))?|\d+(?:\.\d+)?))?(?:\s*(?:%|% FTP|% HR|% LTHR|w|W|w\/kg|W\/kg))?\b/gi;
const PACE_PATTERN = /\b\d+:\d+(?:-\d+:\d+)?\/(?:km|mi)\b/gi;
const DECIMAL_DURATION_DISTANCE_PATTERN =
  /\b\d+\.\d+(?:h|hr|hrs|hour|hours|m|min|mins|minute|minutes|s|sec|secs|second|seconds|km|mi|m|meter|meters|yd|yds)\b/gi;

export type ParsedWorkoutStep = {
  raw: string;
  prompt?: string;
  durations: string[];
  distances: string[];
  percents: string[];
  zones: string[];
  power: string[];
  cadence: string[];
  ramps: string[];
  paces: string[];
  notes?: string;
};

export type ParsedWorkoutSection = {
  title: string;
  repeat?: number;
  steps: ParsedWorkoutStep[];
};

export type WorkoutValidationResult = {
  valid: boolean;
  errors: string[];
  sections?: ParsedWorkoutSection[];
};

const findMatches = (pattern: RegExp, text: string) => {
  pattern.lastIndex = 0;
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    matches.push(match[0]);
  }
  return matches;
};

const findFirstMatchIndex = (pattern: RegExp, text: string) => {
  pattern.lastIndex = 0;
  const match = pattern.exec(text);
  return match ? match.index : -1;
};

const parseRepeatSuffix = (line: string) => {
  const repeatMatch = line.match(/^(.*?)(?:\s+(\d+)\s*x)?$/i);
  if (!repeatMatch) return { title: line.trim(), repeat: undefined };
  const [, title, repeatRaw] = repeatMatch;
  return {
    title: title?.trim() || "Section",
    repeat: repeatRaw ? Number.parseInt(repeatRaw, 10) : undefined,
  };
};

const parseStepLine = (line: string, lineNumber: number): ParsedWorkoutStep & { errors: string[] } => {
  const errors: string[] = [];
  const withoutPrefix = line.replace(STEP_PREFIX, "").trim();
  if (!withoutPrefix) {
    errors.push(`Line ${lineNumber}: Empty step.`);
    return {
      raw: line,
      durations: [],
      distances: [],
      percents: [],
      zones: [],
      power: [],
      cadence: [],
      ramps: [],
      paces: [],
      errors,
    };
  }

  const hashIndex = withoutPrefix.indexOf("#");
  const content =
    hashIndex >= 0 ? withoutPrefix.slice(0, hashIndex).trim() : withoutPrefix;
  const notePart =
    hashIndex >= 0 ? withoutPrefix.slice(hashIndex + 1).trim() : undefined;
  if (hashIndex >= 0) {
    errors.push(
      `Line ${lineNumber}: Replace '#${notePart ? ` ${notePart}` : ""}' comments with inline text before the duration (e.g., '- Seated smooth 3m ...').`,
    );
  }
  const decimalMatches = findMatches(DECIMAL_DURATION_DISTANCE_PATTERN, withoutPrefix);
  if (decimalMatches.length) {
    errors.push(
      `Line ${lineNumber}: Use whole-number durations/distances (e.g., replace ${decimalMatches[0]} with 5h30m or 1500m).`,
    );
  }
  const durations = findMatches(DURATION_PATTERN, content);
  const distances = findMatches(DISTANCE_PATTERN, content);
  if (!durations.length && !distances.length) {
    errors.push(`Line ${lineNumber}: Step is missing a duration or distance.`);
  }

  const firstDurationIndex = findFirstMatchIndex(DURATION_PATTERN, content);
  const firstDistanceIndex = findFirstMatchIndex(DISTANCE_PATTERN, content);
  const firstMetricIndex = [firstDurationIndex, firstDistanceIndex]
    .filter((value) => value >= 0)
    .sort((a, b) => a - b)[0] ?? -1;

  const prompt =
    firstMetricIndex > 0 ? content.slice(0, firstMetricIndex).trim() : undefined;

  return {
    raw: line,
    prompt,
    durations,
    distances,
    percents: findMatches(PERCENT_PATTERN, content),
    zones: findMatches(ZONE_PATTERN, content),
    power: findMatches(POWER_PATTERN, content),
    cadence: findMatches(CADENCE_PATTERN, content),
    ramps: findMatches(RAMP_PATTERN, content),
    paces: findMatches(PACE_PATTERN, content),
    notes: notePart || undefined,
    errors,
  };
};

export const validateIntervalsWorkoutText = (text: string): WorkoutValidationResult => {
  const lines = text.split(/\r?\n/);
  const errors: string[] = [];
  const sections: ParsedWorkoutSection[] = [];
  let currentSection: ParsedWorkoutSection | undefined;

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) return;

    if (line.startsWith("-")) {
      if (!currentSection) {
        currentSection = {
          title: "Workout",
          steps: [],
        };
        sections.push(currentSection);
      }
      const parsedStep = parseStepLine(line, idx + 1);
      currentSection.steps.push(parsedStep);
      if (parsedStep.errors.length) {
        errors.push(...parsedStep.errors);
      }
      return;
    }

    const { title, repeat } = parseRepeatSuffix(line);
    currentSection = {
      title,
      repeat,
      steps: [],
    };
    sections.push(currentSection);
  });

  if (!sections.length) {
    errors.push("Workout text is empty.");
  } else {
    const hasSteps = sections.some((section) => section.steps.length > 0);
    if (!hasSteps) {
      errors.push("Workout must include at least one step (lines starting with '- ').");
    }
  }

  if (errors.length) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    sections,
  };
};

export const WorkoutPlanInputSchema = z.object({
  sections: z
    .array(
      z.object({
        title: z.string().min(1, "Section title is required."),
        repeat: z.number().int().positive().max(99).optional(),
        steps: z
          .array(
            z.object({
              prompt: z.string().optional(),
              duration: z
                .object({
                  hours: z.number().int().nonnegative().optional(),
                  minutes: z.number().int().nonnegative().optional(),
                  seconds: z.number().int().nonnegative().optional(),
                })
                .optional(),
              distance: z
                .object({
                  value: z.number().positive(),
                  unit: z.enum(["m", "km", "mi", "yd"]),
                })
                .optional(),
              segments: z
                .array(
                  z.union([
                    z.string(),
                    z.object({
                      kind: z.literal("percent"),
                      value: z.number(),
                      of: z.string().optional(),
                    }),
                    z.object({
                      kind: z.literal("percentRange"),
                      min: z.number(),
                      max: z.number(),
                      of: z.string().optional(),
                    }),
                    z.object({
                      kind: z.literal("zone"),
                      zone: z.union([z.string(), z.number()]),
                      modality: z.enum(["power", "hr", "pace"]).optional(),
                    }),
                    z.object({
                      kind: z.literal("power"),
                      value: z.number(),
                      unit: z.enum(["w", "w/kg"]).optional(),
                    }),
                    z.object({
                      kind: z.literal("powerRange"),
                      min: z.number(),
                      max: z.number(),
                      unit: z.enum(["w", "w/kg"]).optional(),
                    }),
                    z.object({
                      kind: z.literal("cadence"),
                      value: z.number().optional(),
                      min: z.number().optional(),
                      max: z.number().optional(),
                      unit: z.literal("rpm").optional(),
                    }),
                    z.object({
                      kind: z.literal("ramp"),
                      start: z.union([z.number(), z.string()]),
                      end: z.union([z.number(), z.string()]).optional(),
                      unit: z.enum(["percent", "w", "w/kg"]).optional(),
                      of: z.string().optional(),
                    }),
                    z.object({
                      kind: z.literal("pace"),
                      value: z.string(),
                    }),
                    z.object({
                      kind: z.literal("paceRange"),
                      min: z.string(),
                      max: z.string(),
                    }),
                    z.object({
                      kind: z.literal("text"),
                      text: z.string(),
                    }),
                    z.object({
                      kind: z.literal("pressLap"),
                      text: z.string().optional(),
                    }),
                  ]),
                )
                .optional(),
              notes: z.string().optional(),
            }),
          )
          .min(1, "Each section requires at least one step."),
      }),
    )
    .min(1, "Provide at least one section."),
});
