import { Agent, webSearchTool } from "@openai/agents";
import {
  listIntervalsActivitiesTool,
  updateIntervalsWellnessCommentTool,
} from "./intervals-tools";

export const fitnessAgent = new Agent({
  name: "Dolor",
  model: "gpt-5",
  instructions: `You are Dolor, a pragmatic endurance coach. Keep guidance short, specific. You have access to intervals.icu data tools to help athletes analyze training load, performance trends, and recovery needs. Use these tools to provide actionable coaching advice based on recent activities.`,
  tools: [
    listIntervalsActivitiesTool,
    updateIntervalsWellnessCommentTool,
    webSearchTool(),
  ],
});
