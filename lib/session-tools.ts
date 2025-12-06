import { tool } from "@openai/agents";
import { z } from "zod";
import { getSessionContext } from "./session-context";

export const getSessionIdTool = tool({
  name: "get_session_id",
  description:
    "Returns the persistent session identifier for this conversation so you can pass it to other session-aware tools without re-asking the user.",
  parameters: z.object({}),
  execute: async () => {
    const context = getSessionContext();
    if (!context?.sessionId) {
      throw new Error("Session ID is not available yet. Try again in a moment.");
    }
    return { sessionId: context.sessionId };
  },
});
