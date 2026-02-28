import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  MoreHorizontal,
  PencilLine,
  Archive,
  LogOut,
  Square,
  ArrowUp,
} from "lucide-react";
import { Button } from "./components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./components/ui/dropdown-menu";
import "./index.css";

type UserInfo = {
  id: string;
  displayName: string;
  linkedIdentities: {
    intervals: {
      athleteId: string;
      athleteName: string | null;
    } | null;
  };
};

type Thread = {
  id: string;
  title: string;
  sourceType: "web" | "telegram";
  readOnly: boolean;
  archived: boolean;
  lastMessageAt: string;
  messageCount: number;
};

type Message = {
  id: string;
  threadId: string;
  role: "user" | "assistant" | "system";
  content: string;
  source: string;
  createdAt: string;
  thinking?: boolean;
};

const api = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? `${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
};

const sseTextDecoder = new TextDecoder();

const parseSseChunk = (buffer: string, onEvent: (event: string, data: any) => void) => {
  let remaining = buffer;
  const chunks = remaining.split("\n\n");
  remaining = chunks.pop() ?? "";
  for (const chunk of chunks) {
    const lines = chunk.split("\n");
    let event = "message";
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith("event:")) {
        event = line.slice("event:".length).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice("data:".length).trim());
      }
    }
    if (!dataLines.length) continue;
    try {
      onEvent(event, JSON.parse(dataLines.join("\n")));
    } catch {
      // Ignore malformed event payloads to keep stream resilient.
    }
  }
  return remaining;
};

export function App() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [composerText, setComposerText] = useState("");
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamAbortController, setStreamAbortController] = useState<AbortController | null>(null);
  const [errorLine, setErrorLine] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const messageListRef = useRef<HTMLElement | null>(null);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? null,
    [threads, activeThreadId],
  );

  const refreshThreads = async () => {
    const data = await api<{ threads: Thread[] }>("/api/web/threads");
    setThreads(data.threads);
    if (!activeThreadId && data.threads.length > 0) {
      setActiveThreadId(data.threads[0]!.id);
    }
    if (activeThreadId && !data.threads.some((thread) => thread.id === activeThreadId)) {
      setActiveThreadId(data.threads[0]?.id ?? null);
    }
  };

  const loadMessages = async (threadId: string) => {
    const data = await api<{ messages: Message[] }>(`/api/web/threads/${threadId}/messages?limit=50`);
    setMessages(data.messages);
  };

  useEffect(() => {
    (async () => {
      try {
        const data = await api<{ user: UserInfo }>("/api/web/me");
        setUser(data.user);
        await refreshThreads();
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!activeThreadId) {
      setMessages([]);
      return;
    }
    loadMessages(activeThreadId).catch((error) => {
      setErrorLine(error instanceof Error ? error.message : String(error));
    });
  }, [activeThreadId]);

  const createThread = async () => {
    const data = await api<{ thread: Thread }>("/api/web/threads", {
      method: "POST",
      body: JSON.stringify({ title: "New thread" }),
    });
    await refreshThreads();
    setActiveThreadId(data.thread.id);
    setDrawerOpen(false);
  };

  const archiveThread = async (threadId: string) => {
    await api<{ thread: Thread }>(`/api/web/threads/${threadId}`, {
      method: "PATCH",
      body: JSON.stringify({ archived: true }),
    });
    await refreshThreads();
  };

  const renameThread = async (threadId: string) => {
    const next = prompt("Thread name");
    if (!next || !next.trim()) return;
    await api<{ thread: Thread }>(`/api/web/threads/${threadId}`, {
      method: "PATCH",
      body: JSON.stringify({ title: next.trim() }),
    });
    await refreshThreads();
  };

  const signOut = async () => {
    await api("/api/web/logout", { method: "POST" });
    setUser(null);
    setThreads([]);
    setMessages([]);
    setActiveThreadId(null);
  };

  const submitMessage = async () => {
    if (!activeThread || activeThread.readOnly || !composerText.trim() || streaming) return;
    const text = composerText.trim();
    setComposerText("");
    setStreaming(true);
    setErrorLine(null);

    const tempUserMessage: Message = {
      id: `temp-user-${Date.now()}`,
      threadId: activeThread.id,
      role: "user",
      content: text,
      source: "web_user",
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    let pendingAssistantId = "";
    let pendingAssistantText = "";
    const pendingProgress: string[] = [];

    try {
      const abortController = new AbortController();
      setStreamAbortController(abortController);
      const response = await fetch(`/api/web/threads/${activeThread.id}/messages/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: abortController.signal,
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to stream response.");
      }

      const reader = response.body.getReader();
      let sseBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += sseTextDecoder.decode(value, { stream: true });
        sseBuffer = parseSseChunk(sseBuffer, (eventName, data) => {
          if (eventName === "message_start") {
            pendingAssistantId = data.assistantMessageId;
            const assistantMessage: Message = {
              id: pendingAssistantId,
              threadId: activeThread.id,
              role: "assistant",
              content: "Thinking...",
              source: "web_assistant",
              createdAt: new Date().toISOString(),
              thinking: true,
            };
            setMessages((prev) => [...prev, assistantMessage]);
            return;
          }
          if (eventName === "token") {
            pendingAssistantText += data.delta ?? "";
            setMessages((prev) =>
              prev.map((message) =>
                message.id === pendingAssistantId
                  ? { ...message, content: pendingAssistantText, thinking: false }
                  : message),
            );
            return;
          }
          if (eventName === "progress") {
            const label = typeof data.label === "string" ? data.label.trim() : "";
            if (!label || !pendingAssistantId || pendingAssistantText.trim()) return;
            if (pendingProgress[pendingProgress.length - 1] !== label) {
              pendingProgress.push(label);
            }
            const visible = pendingProgress.slice(-3);
            const thinkingText = ["Thinking...", ...visible.map((item) => `- ${item}`)].join("\n");
            setMessages((prev) =>
              prev.map((message) =>
                message.id === pendingAssistantId
                  ? { ...message, content: thinkingText, thinking: true }
                  : message),
            );
            return;
          }
          if (eventName === "error") {
            setErrorLine(data.message ?? "Streaming failed.");
            return;
          }
        });
      }
      await refreshThreads();
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        if (pendingAssistantId && !pendingAssistantText.trim()) {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === pendingAssistantId
                ? { ...message, content: "Stopped.", thinking: false }
                : message),
          );
        }
        return;
      }
      setErrorLine(error instanceof Error ? error.message : String(error));
    } finally {
      setStreaming(false);
      setStreamAbortController(null);
    }
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    await submitMessage();
  };

  const resizeComposer = () => {
    const elem = composerRef.current;
    if (!elem) return;
    elem.style.height = "0px";
    elem.style.height = `${Math.min(elem.scrollHeight, 180)}px`;
  };

  useEffect(() => {
    resizeComposer();
  }, [composerText]);

  useEffect(() => {
    const elem = messageListRef.current;
    if (!elem) return;
    elem.scrollTo({ top: elem.scrollHeight, behavior: "smooth" });
  }, [messages, activeThreadId]);

  const stopStreaming = () => {
    streamAbortController?.abort();
  };

  if (loading) {
    return <div className="shell loading">Loading Dolor...</div>;
  }

  if (!user) {
    return (
      <div className="shell auth-shell">
        <div className="welcome-wrap">
          <div className="auth-card">
            <p className="eyebrow">Dolor</p>
            <h1>Your training co-pilot, now on web.</h1>
            <p>
              Ask questions, review sessions, and get coaching guidance with live streaming responses.
            </p>
            <a className="primary-button" href="/auth/web/login">
              Continue with Intervals
            </a>
            <p className="auth-note">Sign in takes a few seconds and keeps your athlete context linked.</p>
          </div>
          <div className="welcome-points">
            <article>
              <h2>Live responses</h2>
              <p>See Dolor think and respond in real time instead of waiting for long blocks.</p>
            </article>
            <article>
              <h2>Organized threads</h2>
              <p>Keep race prep, recovery questions, and workout analysis in separate conversations.</p>
            </article>
            <article>
              <h2>Built for phone + desktop</h2>
              <p>Fast, full-screen chat UX that feels natural on mobile and roomy on larger screens.</p>
            </article>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shell app-shell">
      <button
        className={`drawer-backdrop ${drawerOpen ? "open" : ""}`}
        onClick={() => setDrawerOpen(false)}
        aria-label="Close thread list"
      />
      <aside className={`thread-drawer ${drawerOpen ? "open" : ""}`}>
        <header className="drawer-header">
          <h2>Threads</h2>
          <button onClick={createThread} className="primary-button">
            New
          </button>
        </header>
        <div className="thread-list">
          {threads.length === 0 && <p className="muted">No threads yet. Create one to start chatting.</p>}
          {threads.map((thread) => (
            <div key={thread.id} className={`thread-item ${thread.id === activeThreadId ? "active" : ""}`}>
              <button
                className="thread-open-button"
                onClick={() => {
                  setActiveThreadId(thread.id);
                  setDrawerOpen(false);
                }}
              >
                <div className="thread-title-row">
                  <span className="thread-title">{thread.title}</span>
                  {thread.sourceType === "telegram" && <span className="thread-tag">Telegram</span>}
                </div>
                <span className="thread-meta">{thread.messageCount} messages</span>
              </button>
              {!thread.readOnly && (
                <div className="thread-inline-actions">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${thread.title}`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => renameThread(thread.id)}>
                        <PencilLine />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => archiveThread(thread.id)}
                        variant="destructive"
                      >
                        <Archive />
                        Archive
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
              {thread.readOnly && (
                <div className="thread-inline-actions">
                  <span className="thread-readonly-label">Read-only</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>

      <main className="chat-main">
        <header className="chat-header">
          <button
            className="ghost-button mobile-only"
            onClick={() => setDrawerOpen((open) => !open)}
          >
            Threads
          </button>
          <div>
            <h1>{activeThread?.title ?? "Dolor"}</h1>
            <p>
              {user.displayName}
              {user.linkedIdentities.intervals?.athleteName
                ? ` • ${user.linkedIdentities.intervals.athleteName}`
                : ""}
            </p>
          </div>
          <div className="thread-actions">
            <Button variant="ghost" onClick={signOut}>
              <LogOut />
              Sign out
            </Button>
          </div>
        </header>

        <section ref={messageListRef} className="message-list">
          {messages.map((message) => (
            <article
              key={message.id}
              className={`bubble ${message.role === "user" ? "user" : "assistant"} ${message.thinking ? "thinking" : ""}`}
            >
              {message.thinking ? (
                <>
                  <span className="thinking-head">
                    <span className="thinking-spinner" />
                    Thinking
                  </span>
                  {message.content
                    .split("\n")
                    .slice(1)
                    .filter((line) => line.trim())
                    .map((line, idx) => (
                      <div key={`${message.id}-thinking-${idx}`} className="thinking-line">
                        {line.replace(/^- /, "")}
                      </div>
                    ))}
                </>
              ) : (
                message.content
              )}
            </article>
          ))}
        </section>

        {errorLine && <div className="error-line">{errorLine}</div>}

        {!activeThread && (
          <div className="composer-blocked">
            <button className="primary-button" onClick={createThread}>
              Create your first thread
            </button>
          </div>
        )}

        {activeThread && (
          <form className="composer" onSubmit={sendMessage}>
            <div className="composer-shell">
              <textarea
                ref={composerRef}
                className="composer-input"
                value={composerText}
                onChange={(event) => setComposerText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void submitMessage();
                  }
                }}
                placeholder={
                  activeThread.readOnly
                    ? "Telegram mirrored thread is read-only."
                    : "Ask Dolor anything about your training."
                }
                rows={1}
                disabled={activeThread.readOnly || streaming}
              />
              {streaming ? (
                <Button
                  variant="destructive"
                  type="button"
                  className="composer-action"
                  onClick={stopStreaming}
                  aria-label="Stop generation"
                >
                  <Square />
                </Button>
              ) : (
                <Button
                  className="composer-action"
                  type="submit"
                  disabled={activeThread.readOnly || !composerText.trim()}
                  aria-label="Send message"
                >
                  <ArrowUp />
                </Button>
              )}
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

export default App;
