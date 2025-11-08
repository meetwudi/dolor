import {
  extractAllTextOutput,
  type Agent,
  type RunResult,
  type RunStreamEvent,
  type RunItemStreamEvent,
  type RunRawModelStreamEvent,
  type StreamedRunResult,
} from "@openai/agents";

const LARGE_INTERVAL_TOOLS = new Set([
  "list_intervals_activities",
  "get_intervals_activity",
  "get_intervals_activity_intervals",
  "list_intervals_chat_messages",
  "list_intervals_wellness_records",
]);

type LogAudience = "cli" | "user";

const TOOL_LABELS: Record<
  string,
  {
    cliCall?: string;
    cliDone?: string;
    userCall?: string;
    userDone?: string;
    hideUser?: boolean;
  }
> = {
  get_current_time: {
    userCall: "",
    userDone: "",
  },
  list_intervals_activities: {
    cliCall: "[tool] Calling list_intervals_activities (large payload hidden)",
    cliDone: "[tool] list_intervals_activities finished (output hidden)",
    userCall: "Fetching your recent activities…",
    userDone: "Activities ready.",
  },
  get_intervals_activity_intervals: {
    cliCall: "[tool] Calling get_intervals_activity_intervals (large payload hidden)",
    cliDone:
      "[tool] get_intervals_activity_intervals finished (output hidden)",
    userCall: "Pulling detailed interval data…",
    userDone: "Interval details ready.",
  },
  list_intervals_chat_messages: {
    cliCall: "[tool] Calling list_intervals_chat_messages (large payload hidden)",
    cliDone:
      "[tool] list_intervals_chat_messages finished (output hidden)",
    userCall: "Loading your chat history…",
    userDone: "Chat history loaded.",
  },
  add_intervals_activity_comment: {
    userCall: "Posting your note to the activity…",
    userDone: "Note posted.",
  },
  get_intervals_activity: {
    cliCall: "[tool] Calling get_intervals_activity (large payload hidden)",
    cliDone: "[tool] get_intervals_activity finished (output hidden)",
    userCall: "Loading the full activity details…",
    userDone: "Activity details ready.",
  },
  get_intervals_wellness_record: {
    cliCall: "[tool] Calling get_intervals_wellness_record",
    cliDone: "[tool] get_intervals_wellness_record completed",
    userCall: "Reviewing the wellness record for that day…",
    userDone: "Wellness record ready.",
  },
  list_intervals_wellness_records: {
    cliCall: "[tool] Calling list_intervals_wellness_records (large payload hidden)",
    cliDone: "[tool] list_intervals_wellness_records finished (output hidden)",
    userCall: "Fetching those wellness records…",
    userDone: "Wellness history ready.",
  },
  get_local_weather_forecast: {
    cliCall: "[tool] Calling get_local_weather_forecast",
    cliDone: "[tool] get_local_weather_forecast completed",
    userCall: "Checking the local weather forecast…",
    userDone: "Forecast ready.",
  },
};

const truncate = (text: string, max = 280) =>
  text.length > max ? `${text.slice(0, max)}…` : text;

const extractContentText = (content: unknown): string => {
  if (!Array.isArray(content)) return "";
  return content
    .map((entry) => {
      if (
        entry &&
        typeof entry === "object" &&
        "text" in entry &&
        typeof (entry as { text?: unknown }).text === "string"
      ) {
        return (entry as { text: string }).text;
      }
      return "";
    })
    .join("");
};

const isLargeIntervalsTool = (name?: string) =>
  !!name && LARGE_INTERVAL_TOOLS.has(name);

const getToolName = (item: any) =>
  typeof item?.rawItem?.name === "string"
    ? (item.rawItem.name as string)
    : "tool";

export const getTextDeltaFromEvent = (event: RunStreamEvent) => {
  if (event.type !== "raw_model_stream_event") return "";
  const data = event.data as RunRawModelStreamEvent["data"] & {
    delta?: string;
  };
  if (
    typeof data?.type === "string" &&
    data.type.includes("output_text") &&
    typeof data.delta === "string"
  ) {
    return data.delta;
  }
  return "";
};

const describeReasoningItem = (
  event: RunItemStreamEvent,
  audience: LogAudience,
) => {
  if (audience === "user") return "";
  const text = extractContentText((event.item as any)?.rawItem?.content);
  if (!text.trim()) return "";
  return `[thinking] ${truncate(text.trim())}`;
};

const describeToolEvent = (
  event: RunItemStreamEvent,
  audience: LogAudience,
) => {
  const name = getToolName(event.item);
  const hidden = isLargeIntervalsTool(name);
  const labels = TOOL_LABELS[name] ?? {};
  const callLabel =
    audience === "user"
      ? labels.userCall ?? (hidden ? "" : `Running ${name}…`)
      : labels.cliCall ??
        (hidden ? `[tool] Calling ${name} (output hidden)` : `[tool] Calling ${name}`);
  const doneLabel =
    audience === "user"
      ? labels.userDone ?? (hidden ? "" : `${name} done.`)
      : labels.cliDone ??
        (hidden ? `[tool] ${name} finished (output hidden)` : `[tool] ${name} completed`);

  if (audience === "user" && labels.hideUser) {
    return "";
  }
  if (event.name === "tool_called") {
    return callLabel?.trim() || "";
  }
  if (event.name === "tool_output") {
    return doneLabel?.trim() || "";
  }
  return "";
};

const describeHandoffEvent = (
  event: RunItemStreamEvent,
  audience: LogAudience,
) => {
  if (audience === "user") {
    return "";
  }
  const targetAgentName: string | undefined =
    (event.item as { agent?: Agent })?.agent?.name;
  if (event.name === "handoff_requested") {
    return targetAgentName
      ? `[handoff] Requesting ${targetAgentName}`
      : "[handoff] Requesting downstream agent";
  }
  if (event.name === "handoff_occurred") {
    return targetAgentName
      ? `[handoff] Handed off to ${targetAgentName}`
      : "[handoff] Handed off";
  }
  return "";
};

export const getLogLineFromEvent = (
  event: RunStreamEvent,
  audience: LogAudience = "cli",
) => {
  if (event.type === "run_item_stream_event") {
    if (event.name === "reasoning_item_created") {
      return describeReasoningItem(event, audience);
    }
    if (event.name === "tool_called" || event.name === "tool_output") {
      return describeToolEvent(event, audience);
    }
    if (
      event.name === "handoff_requested" ||
      event.name === "handoff_occurred"
    ) {
      return describeHandoffEvent(event, audience);
    }
  }
  if (event.type === "agent_updated_stream_event" && audience === "cli") {
    return `[agent] Switched to ${event.agent.name}`;
  }
  if (
    event.type === "raw_model_stream_event" &&
    typeof event.data?.type === "string" &&
    event.data.type.includes("reflection") &&
    typeof (event.data as { delta?: string }).delta === "string"
  ) {
    return audience === "cli"
      ? `[thinking] ${truncate(
        ((event.data as { delta: string }).delta || "").trim(),
      )}`
      : "";
  }
  return "";
};

export const getFinalResponseText = (
  result: RunResult<any, any> | StreamedRunResult<any, any>,
) =>
  typeof result.finalOutput === "string"
    ? result.finalOutput
    : extractAllTextOutput(result.newItems) || "[No response]";
