import { run, user, type AgentInputItem, type Session } from "@openai/agents";
import { appendHistory } from "./dolor-chat";
import { fitnessAgent } from "./fitness-agent";
import { withSessionContext } from "./session-context";
import { sessionExtraStore } from "./session-extra-store";
import { getLogLineFromEvent, getTextDeltaFromEvent } from "./run-stream-utils";
import { UpstashSession } from "./upstash-session";
import {
  appendMessage,
  createThread,
  deleteWebSession,
  getCookieName,
  getStoredThread,
  getUserById,
  getWebSession,
  listMessages,
  listThreads,
  updateThread,
  type ChatThread,
} from "./web-data-store";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status });

const unauthorized = () =>
  json({ error: "Unauthorized" }, 401);

const badRequest = (message: string) => json({ error: message }, 400);

const parseCookieHeader = (value: string | null) => {
  const output = new Map<string, string>();
  if (!value) return output;
  const parts = value.split(";");
  for (const part of parts) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (!rawKey || rawValue.length === 0) continue;
    output.set(rawKey, rawValue.join("="));
  }
  return output;
};

class LocalSession implements Session {
  private readonly sessionId: string;
  private readonly items: AgentInputItem[] = [];

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  async getSessionId() {
    return this.sessionId;
  }

  async getItems(limit?: number) {
    if (limit === undefined) return this.items.slice();
    return this.items.slice(Math.max(this.items.length - limit, 0));
  }

  async addItems(items: AgentInputItem[]) {
    this.items.push(...items);
  }

  async popItem() {
    return this.items.pop();
  }

  async clearSession() {
    this.items.length = 0;
  }
}

const localSessions = new Map<string, LocalSession>();

type AuthContext = {
  userId: string;
};

const requireAuth = async (request: Request): Promise<AuthContext | null> => {
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const sessionId = cookies.get(getCookieName());
  if (!sessionId) return null;
  const session = await getWebSession(sessionId);
  if (!session) return null;
  const user = await getUserById(session.userId);
  if (!user) return null;
  return { userId: user.id };
};

const resolveThreadForUser = async (userId: string, threadId: string) => {
  const thread = await getStoredThread(threadId);
  if (!thread) return null;
  if (thread.userId !== userId) return null;
  return thread;
};

const threadSummary = (thread: ChatThread) => ({
  id: thread.id,
  title: thread.title,
  sourceType: thread.sourceType,
  readOnly: thread.readOnly,
  archived: thread.archived,
  createdAt: thread.createdAt,
  updatedAt: thread.updatedAt,
  lastMessageAt: thread.lastMessageAt,
  messageCount: thread.messageCount,
});

export const handleMeRequest = async (request: Request) => {
  const auth = await requireAuth(request);
  if (!auth) return unauthorized();
  const user = await getUserById(auth.userId);
  if (!user) return unauthorized();
  return json({
    user: {
      id: user.id,
      displayName: user.displayName ?? "Athlete",
      linkedIdentities: {
        intervals: user.linkedIdentities.intervals
          ? {
              athleteId: user.linkedIdentities.intervals.athleteId,
              athleteName: user.linkedIdentities.intervals.athleteName ?? null,
            }
          : null,
      },
    },
  });
};

export const handleLogoutRequest = async (request: Request) => {
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const sessionId = cookies.get(getCookieName());
  if (sessionId) {
    await deleteWebSession(sessionId);
  }
  const response = json({ ok: true });
  response.headers.set(
    "Set-Cookie",
    `${getCookieName()}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure`,
  );
  return response;
};

export const handleListThreadsRequest = async (request: Request) => {
  const auth = await requireAuth(request);
  if (!auth) return unauthorized();
  const url = new URL(request.url);
  const archived = url.searchParams.get("archived") === "true";
  const threads = await listThreads(auth.userId, archived);
  return json({
    threads: threads.map(threadSummary),
  });
};

export const handleCreateThreadRequest = async (request: Request) => {
  const auth = await requireAuth(request);
  if (!auth) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const title =
    typeof body?.title === "string" && body.title.trim() ? body.title.trim() : "New thread";
  const thread = await createThread(auth.userId, title);
  return json({ thread: threadSummary(thread) }, 201);
};

export const handlePatchThreadRequest = async (
  request: Request,
  threadId: string,
) => {
  const auth = await requireAuth(request);
  if (!auth) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const patch = {
    title: typeof body?.title === "string" ? body.title : undefined,
    archived: typeof body?.archived === "boolean" ? body.archived : undefined,
  };
  const thread = await updateThread(auth.userId, threadId, patch);
  if (!thread) return json({ error: "Thread not found" }, 404);
  return json({ thread: threadSummary(thread) });
};

export const handleThreadMessagesRequest = async (
  request: Request,
  threadId: string,
) => {
  const auth = await requireAuth(request);
  if (!auth) return unauthorized();
  const thread = await resolveThreadForUser(auth.userId, threadId);
  if (!thread) return json({ error: "Thread not found" }, 404);
  const url = new URL(request.url);
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "50", 10);
  const messages = await listMessages(threadId, Number.isFinite(limit) ? limit : 50);
  return json({ messages });
};

const sseFrame = (event: string, data: unknown) => {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
};

const generateTitleFromFirstMessage = (text: string) => {
  const cleaned = text
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s'’\-:]/gu, "")
    .trim();
  if (!cleaned) return "New thread";
  const words = cleaned.split(" ").filter(Boolean);
  const short = words.slice(0, 8).join(" ");
  const titled = short.charAt(0).toUpperCase() + short.slice(1);
  return titled.length > 52 ? `${titled.slice(0, 49).trim()}...` : titled;
};

const getProgressLabel = (event: any): string | null => {
  if (event?.type === "run_item_stream_event") {
    if (event.name === "reasoning_item_created") {
      return "Analyzing your request...";
    }
    if (event.name === "tool_called" || event.name === "tool_output") {
      const fromLabels = getLogLineFromEvent(event, "user");
      if (fromLabels && fromLabels.trim()) return fromLabels;
      const rawName =
        typeof event?.item?.rawItem?.name === "string"
          ? event.item.rawItem.name
          : "tool";
      return event.name === "tool_output"
        ? `Finished ${rawName.replaceAll("_", " ")}.`
        : `Running ${rawName.replaceAll("_", " ")}...`;
    }
  }
  if (event?.type === "agent_updated_stream_event") {
    return `Using ${event.agent?.name ?? "assistant"}...`;
  }
  if (
    event?.type === "raw_model_stream_event" &&
    typeof event.data?.type === "string" &&
    event.data.type.includes("reflection")
  ) {
    return "Refining the recommendation...";
  }
  return null;
};

export const handleStreamMessageRequest = async (
  request: Request,
  threadId: string,
) => {
  const auth = await requireAuth(request);
  if (!auth) return unauthorized();
  const thread = await resolveThreadForUser(auth.userId, threadId);
  if (!thread) return json({ error: "Thread not found" }, 404);
  if (thread.readOnly) return badRequest("This thread is read-only.");

  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return badRequest("Message text is required.");

  if (thread.messageCount === 0 && /^new thread$/i.test(thread.title.trim())) {
    await updateThread(auth.userId, threadId, {
      title: generateTitleFromFirstMessage(text),
    });
  }

  const userMessage = await appendMessage(threadId, {
    threadId,
    role: "user",
    content: text,
    source: "web_user",
  });

  if (!userMessage) return json({ error: "Thread not found" }, 404);

  const userRecord = await getUserById(auth.userId);
  const intervals = userRecord?.linkedIdentities.intervals;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const assistantMessageId = crypto.randomUUID().replace(/-/g, "");
      const createdAt = new Date().toISOString();
      let assistantText = "";
      let closed = false;
      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };
      const keepAlive = setInterval(() => {
        safeEnqueue(": keep-alive\n\n");
      }, 5000);

      safeEnqueue(
        sseFrame("message_start", {
          userMessageId: userMessage.id,
          assistantMessageId,
          createdAt,
        }),
      );

      try {
        let session: Session;
        try {
          session = new UpstashSession({ sessionId: thread.agentSessionId });
        } catch {
          let local = localSessions.get(thread.agentSessionId);
          if (!local) {
            local = new LocalSession(thread.agentSessionId);
            localSessions.set(thread.agentSessionId, local);
          }
          session = local;
        }
        if (intervals) {
          const sessionId = await session.getSessionId();
          await sessionExtraStore.merge(sessionId, {
            athleteId: intervals.athleteId,
            intervalsAccessToken: intervals.accessToken,
            intervalsScope: intervals.scope ?? "",
            intervalsAthleteName: intervals.athleteName ?? "",
          });
        }

        const sessionId = await session.getSessionId();
        const result = await withSessionContext({ sessionId }, () =>
          run(fitnessAgent, [user(text)], {
            session,
            sessionInputCallback: appendHistory,
            stream: true,
          }),
        );

        for await (const event of result) {
          const delta = getTextDeltaFromEvent(event);
          if (delta) {
            assistantText += delta;
            safeEnqueue(sseFrame("token", { delta }));
          }
          const progressLabel = getProgressLabel(event);
          if (progressLabel) {
            safeEnqueue(
              sseFrame("progress", {
                phase: event.type === "run_item_stream_event" && event.name === "tool_output"
                  ? "done"
                  : "called",
                label: progressLabel,
              }),
            );
          }
        }
        await result.completed;
        await appendMessage(threadId, {
          id: assistantMessageId,
          threadId,
          role: "assistant",
          content: assistantText.trim() || "Sorry, I could not generate a response.",
          source: "web_assistant",
          createdAt,
        });
        safeEnqueue(sseFrame("done", { assistantMessageId }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Web stream message request failed", error);
        if (assistantText.trim()) {
          await appendMessage(threadId, {
            threadId,
            role: "assistant",
            content: assistantText,
            source: "web_assistant",
            meta: { interrupted: true },
          });
        }
        safeEnqueue(sseFrame("error", { message }));
      } finally {
        clearInterval(keepAlive);
        if (!closed) {
          try {
            controller.close();
          } catch {
            // Ignore close failures when stream has already terminated.
          }
        }
        closed = true;
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
};

export const handleWebApiRequest = async (request: Request) => {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method.toUpperCase();

  if (pathname === "/api/web/me" && method === "GET") {
    return handleMeRequest(request);
  }
  if (pathname === "/api/web/logout" && method === "POST") {
    return handleLogoutRequest(request);
  }
  if (pathname === "/api/web/threads" && method === "GET") {
    return handleListThreadsRequest(request);
  }
  if (pathname === "/api/web/threads" && method === "POST") {
    return handleCreateThreadRequest(request);
  }

  const threadMatch = pathname.match(/^\/api\/web\/threads\/([^/]+)$/);
  if (threadMatch && method === "PATCH") {
    return handlePatchThreadRequest(request, decodeURIComponent(threadMatch[1] ?? ""));
  }

  const messagesMatch = pathname.match(/^\/api\/web\/threads\/([^/]+)\/messages$/);
  if (messagesMatch && method === "GET") {
    return handleThreadMessagesRequest(request, decodeURIComponent(messagesMatch[1] ?? ""));
  }

  const streamMatch = pathname.match(
    /^\/api\/web\/threads\/([^/]+)\/messages\/stream$/,
  );
  if (streamMatch && method === "POST") {
    return handleStreamMessageRequest(
      request,
      decodeURIComponent(streamMatch[1] ?? ""),
    );
  }

  return json({ error: "Not Found" }, 404);
};
