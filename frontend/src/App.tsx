import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

type ChatItem = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  createdAt: string;
};

const CHAT_STORAGE_KEY = "perplexity-clone-chat-history";

type StreamEvent =
  | { type: "delta"; delta: string }
  | { type: "done"; sources: string[] }
  | { type: "error"; message: string };

function getSessionId() {
  const key = "perplexity-clone-session-id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(key, created);
  return created;
}

export default function App() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatItem[]>(() => {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as ChatItem[];
    } catch {
      return [];
    }
  });
  const sessionId = useMemo(() => getSessionId(), []);
  const [copyState, setCopyState] = useState<Record<string, "idle" | "copied">>({});
  const endRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  async function copyText(messageId: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState((prev) => ({ ...prev, [messageId]: "copied" }));
      setTimeout(() => {
        setCopyState((prev) => ({ ...prev, [messageId]: "idle" }));
      }, 1200);
    } catch {
      // Ignore clipboard errors for unsupported environments.
    }
  }

  async function sendQuery(rawQuery: string) {
    const trimmed = rawQuery.trim();
    if (!trimmed || loading) return;

    const now = new Date().toISOString();
    const userMessage: ChatItem = { id: crypto.randomUUID(), role: "user", content: trimmed, createdAt: now };
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: assistantId, role: "assistant", content: "", createdAt: new Date().toISOString() }
    ]);
    setQuery("");
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, query: trimmed })
      });
      if (!response.ok || !response.body) throw new Error("Streaming request failed.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const rawEvent of events) {
          const dataLine = rawEvent
            .split("\n")
            .find((line) => line.startsWith("data: "))
            ?.slice(6);
          if (!dataLine) continue;

          const eventPayload = JSON.parse(dataLine) as StreamEvent;
          if (eventPayload.type === "delta") {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + eventPayload.delta } : m))
            );
          } else if (eventPayload.type === "done") {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, sources: eventPayload.sources } : m))
            );
          } else if (eventPayload.type === "error") {
            throw new Error(eventPayload.message);
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  function clearChat() {
    setMessages([]);
    setError(null);
  }

  function startEdit(content: string) {
    setQuery(content);
    textareaRef.current?.focus();
  }

  async function retryLast() {
    if (loading) return;
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    await sendQuery(lastUser.content);
  }

  async function exportMarkdown() {
    const lines: string[] = ["# Chat Export", ""];
    for (const message of messages) {
      const title = message.role === "user" ? "User" : "Assistant";
      lines.push(`## ${title} (${formatTime(message.createdAt)})`);
      lines.push("");
      lines.push(message.content || "...");
      lines.push("");
      if (message.role === "assistant" && message.sources?.length) {
        lines.push("### Sources");
        for (const source of message.sources) {
          lines.push(`- ${source}`);
        }
        lines.push("");
      }
    }

    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `perplexity-chat-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendQuery(query);
  }

  return (
    <main className="app">
      <div className="hero">
        <div className="badge">Live Search + Streaming</div>
        <h1>Perplexity Clone</h1>
        <p className="subtitle">
          Ask anything and get ranked web-backed answers with source citations in real time.
        </p>
        <div className="hero-actions">
          <button type="button" className="ghost-btn" onClick={retryLast} disabled={loading || messages.length === 0}>
            Retry last
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={exportMarkdown}
            disabled={loading || messages.length === 0}
          >
            Export .md
          </button>
        </div>
      </div>

      <form className="search-form" onSubmit={onSubmit} ref={formRef}>
        <textarea
          ref={textareaRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder="Ask a follow-up question..."
          rows={2}
        />
        <div className="action-row">
          <button type="submit" disabled={loading}>
            {loading ? "Thinking..." : "Ask"}
          </button>
          <button type="button" className="ghost-btn" onClick={clearChat} disabled={loading || messages.length === 0}>
            Clear
          </button>
        </div>
      </form>

      {error && <p className="error">{error}</p>}

      {messages.length === 0 ? (
        <section className="empty-state">
          <h3>Start your first query</h3>
          <p>Try topics like "latest AI tools", "who owns WWE", or "best React architecture patterns".</p>
        </section>
      ) : (
        <section className="chat-list">
          {messages.map((message) => (
            <article className={`answer-card ${message.role}`} key={message.id}>
              <div className="card-head">
                <div className="card-meta">
                  <h3>{message.role === "user" ? "You" : "Assistant"}</h3>
                  <span>{formatTime(message.createdAt)}</span>
                </div>
                <div className="card-actions">
                  {message.role === "user" && (
                    <button type="button" className="copy-btn" onClick={() => startEdit(message.content)}>
                      Edit & resend
                    </button>
                  )}
                  {message.role === "assistant" && message.content && (
                    <button
                      type="button"
                      className="copy-btn"
                      onClick={() => copyText(message.id, message.content)}
                    >
                      {copyState[message.id] === "copied" ? "Copied" : "Copy"}
                    </button>
                  )}
                  {message.role === "assistant" && loading && !message.sources && <span className="pulse">live</span>}
                </div>
              </div>
              <p>
                {message.content || "..."}
                {message.role === "assistant" && loading && !message.sources && <span className="typing-cursor" />}
              </p>
              {message.role === "assistant" && message.sources && message.sources.length > 0 && (
                <>
                  <h4>Sources</h4>
                  <ul className="source-list">
                    {message.sources.map((source) => (
                      <li key={source}>
                        <a href={source} target="_blank" rel="noreferrer">
                          {source}
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </article>
          ))}
          <div ref={endRef} />
        </section>
      )}
    </main>
  );
}
