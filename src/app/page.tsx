"use client";

import { useMemo, useRef, useState } from "react";

import type { RagResponse } from "@/lib/ragResponseSchema";

type QueryErrorResponse = { ok: false; error: string; message?: string };

async function postJson<TResponse>(
  url: string,
  body: unknown,
): Promise<TResponse> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as TResponse;
  return json;
}

type ChatMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; response: RagResponse }
  | { role: "assistant"; error: string }
  | { role: "assistant"; typing: true };

export default function Home() {
  const [question, setQuestion] = useState<string>("");
  const [isQuerying, setIsQuerying] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const exampleQuestions = useMemo(
    () => [
      "How many remote work days are allowed per week?",
      "What is required for expense reimbursement?",
      "When do reimbursements get paid?",
      "What are the password requirements?",
      "What happens if overtime is not approved?",
    ],
    [],
  );

  const canQuery = useMemo(() => question.trim().length > 0, [question]);

  function scrollToBottom() {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }

  async function handleQuery() {
    const q = question.trim();
    if (!q) {
      return;
    }

    setQuestion(""); // clear input after user sends (messaging UX)
    setMessages((prev) => [
      ...prev,
      { role: "user", text: q },
      { role: "assistant", typing: true },
    ]);
    queueMicrotask(scrollToBottom);

    setIsQuerying(true);
    try {
      // No AI calls from the frontend: we only call the server-side RAG API route.
      const res = await postJson<RagResponse | QueryErrorResponse>("/api/query", {
        query: q,
      });

      if ("ok" in res) {
        setMessages((prev) => [
          ...prev.filter((m) => !("typing" in m)),
          { role: "assistant", error: res.message ? `${res.error}: ${res.message}` : res.error },
        ]);
        queueMicrotask(scrollToBottom);
        return;
      }

      setMessages((prev) => [
        ...prev.filter((m) => !("typing" in m)),
        { role: "assistant", response: res },
      ]);
      queueMicrotask(scrollToBottom);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setMessages((prev) => [
        ...prev.filter((m) => !("typing" in m)),
        { role: "assistant", error: `Query failed: ${message}` },
      ]);
      queueMicrotask(scrollToBottom);
    } finally {
      setIsQuerying(false);
    }
  }

  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ marginBottom: 8 }}>Business Assistant</h1>
      <p style={{ marginTop: 0, color: "var(--muted)" }}>
        Ask questions here. To ingest documents or preview uploaded texts, use the navigation above.
      </p>

      <section
        style={{
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 12,
          background: "var(--panel)",
        }}
      >
        <div style={{ color: "var(--muted)", marginBottom: 8 }}>
          Try an example question:
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {exampleQuestions.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                setQuestion(q);
                inputRef.current?.focus();
              }}
              style={{
                background: "var(--input)",
                color: "var(--foreground)",
                border: "1px solid var(--border)",
                borderRadius: 999,
                padding: "8px 10px",
                cursor: "pointer",
              }}
            >
              {q}
            </button>
          ))}
        </div>
      </section>

      <section style={{ border: "1px solid var(--border)", borderRadius: 8, marginTop: 16 }}>
        <div
          ref={listRef}
          style={{
            height: 420,
            overflow: "auto",
            padding: 16,
            background: "var(--panel-2)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {messages.length === 0 ? (
            <p style={{ margin: 0, color: "var(--muted)" }}>
              No messages yet. Ingest a document, then ask a question.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {messages.map((m, idx) => {
                const isUser = m.role === "user";
                return (
                  <div
                    key={idx}
                    style={{
                      alignSelf: isUser ? "flex-end" : "flex-start",
                      maxWidth: "80%",
                      border: isUser ? "1px solid var(--user-bubble)" : "1px solid var(--border)",
                      borderRadius: 10,
                      padding: 12,
                      background: isUser ? "var(--user-bubble)" : "var(--assistant-bubble)",
                      color: "var(--foreground)",
                    }}
                  >
                    {m.role === "user" ? (
                      <div>{m.text}</div>
                    ) : "error" in m ? (
                      <div style={{ color: "#b00" }}>{m.error}</div>
                    ) : "typing" in m ? (
                      <div style={{ color: "var(--muted)" }}>Typing…</div>
                    ) : (
                      <div>
                        <div style={{ whiteSpace: "pre-wrap" }}>{m.response.answer}</div>
                        {/* <div style={{ marginTop: 10, fontSize: 14, color: "var(--foreground)" }}>
                          <div>
                            <strong>Confidence:</strong> {m.response.confidenceScore}
                          </div>
                          <div style={{ marginTop: 6 }}>
                            <strong>Recommendation:</strong> {m.response.recommendation}
                          </div>
                        </div>

                        <div style={{ marginTop: 12 }}>
                          <strong>Sources</strong>
                          {m.response.sourceDocuments.length === 0 ? (
                            <div style={{ marginTop: 6, color: "#666" }}>No sources returned.</div>
                          ) : (
                            <ol style={{ paddingLeft: 18, marginTop: 6, marginBottom: 0 }}>
                              {m.response.sourceDocuments.map((s, sIdx) => (
                                <li key={`${s.name}-${s.pageOrSection}-${sIdx}`} style={{ marginBottom: 10 }}>
                                  <div style={{ fontSize: 13 }}>
                                    <strong>{s.name}</strong> — {s.pageOrSection}
                                  </div>
                                  <pre
                                    style={{
                                      background: "var(--input)",
                                      padding: 10,
                                      borderRadius: 6,
                                      whiteSpace: "pre-wrap",
                                      marginTop: 6,
                                      marginBottom: 0,
                                      fontSize: 12,
                                      color: "var(--foreground)",
                                      border: "1px solid var(--border)",
                                    }}
                                  >
                                    {s.excerpt}
                                  </pre>
                                </li>
                              ))}
                            </ol>
                          )}
                        </div> */}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ padding: 12 }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleQuery();
            }}
            style={{ display: "flex", gap: 8 }}
          >
            <input
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Type your question…"
              style={{
                flex: 1,
                padding: 10,
                background: "var(--input)",
                color: "var(--foreground)",
                border: "1px solid var(--border)",
                borderRadius: 8,
              }}
              disabled={isQuerying}
            />
            <button
              type="submit"
              disabled={!canQuery || isQuerying}
              style={{
                padding: "10px 14px",
                background: "var(--user-bubble)",
                color: "#fff",
                border: "1px solid var(--user-bubble)",
                borderRadius: 8,
              }}
            >
              {isQuerying ? "Sending…" : "Send"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
