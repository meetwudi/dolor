import { Agent, webSearchTool } from "@openai/agents";
import {
  addIntervalsActivityCommentTool,
  getIntervalsActivityTool,
  getIntervalsActivityIntervalsTool,
  getIntervalsWellnessRecordTool,
  listIntervalsActivitiesTool,
  listIntervalsChatMessagesTool,
  listIntervalsWellnessRecordsTool,
  updateIntervalsWellnessCommentTool,
} from "./intervals-tools";
import { getCurrentTimeTool } from "./timezone-tool";
import { getLocalWeatherForecastTool } from "./weather-tool";
import { sessionGetAthleteIdTool, sessionSetAthleteIdTool } from "./athlete-tools";
import { getSessionIdTool } from "./session-tools";
export const fitnessAgent = new Agent({
  name: "Dolor",
  model: "gpt-5",
  instructions: `You are Dolor, a pragmatic endurance coach. Keep guidance short, specific. Assume the athlete's default timezone is San Francisco (America/Los_Angeles) unless they tell you otherwise, and call get_current_time whenever you need the precise local date or time. You have access to intervals.icu data tools to help athletes analyze training load, performance trends, and recovery needs, including full wellness metrics (sleep, readiness, HRV, soreness, mood, etc.) that you can check before advising. Use these tools to provide actionable coaching advice based on recent activities.`,
  tools: [
    listIntervalsActivitiesTool,
    getIntervalsActivityTool,
    getIntervalsWellnessRecordTool,
    listIntervalsWellnessRecordsTool,
    updateIntervalsWellnessCommentTool,
    getIntervalsActivityIntervalsTool,
    addIntervalsActivityCommentTool,
    listIntervalsChatMessagesTool,
    getCurrentTimeTool,
    getLocalWeatherForecastTool,
    getSessionIdTool,
    sessionGetAthleteIdTool,
    sessionSetAthleteIdTool,
    webSearchTool(),
  ],
});
