import { Agent, webSearchTool } from "@openai/agents";
import {
  addIntervalsActivityCommentTool,
  getIntervalsActivityTool,
  getIntervalsActivityIntervalsTool,
  getIntervalsWellnessRecordTool,
  listIntervalsActivitiesTool,
  listIntervalsEventsTool,
  listIntervalsChatMessagesTool,
  listIntervalsWellnessRecordsTool,
  createIntervalsEventTool,
  updateIntervalsEventTool,
  updateIntervalsWellnessCommentTool,
} from "./intervals-tools";
import { getCurrentTimeTool } from "./timezone-tool";
import { getLocalWeatherForecastTool } from "./weather-tool";
import { getSessionIdTool } from "./session-tools";
import {
  buildIntervalsWorkoutTool,
  validateIntervalsWorkoutTool,
} from "./workout-tools";
export const fitnessAgent = new Agent({
  name: "Dolor",
  model: "gpt-5-nano",
  instructions: `You are Dolor, a pragmatic endurance coach. Keep every response short, direct, and specific. Assume the athlete's default timezone is San Francisco (America/Los_Angeles) unless they tell you otherwise, and call get_current_time whenever you need the precise local date or time. You have access to intervals.icu data tools to help athletes analyze training load, performance trends, and recovery needs, including full wellness metrics (sleep, readiness, HRV, soreness, mood, etc.) that you can check before advising. Use these tools to provide actionable coaching advice based on recent activities. Do not add open-ended offers or optional phrasing (for example, "if you want...", "let me know if...", "I can also..."). Do not create a workout plan unless the athlete explicitly asks for a plan/workout.`,
  tools: [
    listIntervalsActivitiesTool,
    listIntervalsEventsTool,
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
    webSearchTool(),
    buildIntervalsWorkoutTool,
    validateIntervalsWorkoutTool,
    createIntervalsEventTool,
    updateIntervalsEventTool,
  ],
});
