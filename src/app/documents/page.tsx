"use client";

import { useEffect, useMemo, useState } from "react";

type DocumentsResponse =
  | { ok: true; documents: Array<{ name: string; text: string }> }
  | { ok: false; error: string; message?: string };

async function getJson<TResponse>(url: string): Promise<TResponse> {
  const res = await fetch(url, { method: "GET" });
  const json = (await res.json()) as TResponse;
  return json;
}

export default function DocumentsPage() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [documents, setDocuments] = useState<Array<{ name: string; text: string }>>([]);

  const hasDocuments = documents.length > 0;

  const totalChars = useMemo(() => {
    return documents.reduce((sum, d) => sum + d.text.length, 0);
  }, [documents]);

  async function load() {
    setError("");
    setIsLoading(true);
    try {
      const res = await getJson<DocumentsResponse>("/api/documents");
      if ("ok" in res && res.ok) {
        setDocuments(res.documents);
        return;
      }
      setError(res.message ? `${res.error}: ${res.message}` : res.error);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(`Failed to load documents: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main
      style={{
        maxWidth: 920,
        margin: "0 auto",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ marginBottom: 8 }}>Uploaded Documents</h1>
      <p style={{ marginTop: 0, color: "var(--muted)" }}>
        Preview ingested raw texts. Each document is collapsible by name.
      </p>

      <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
        <button type="button" onClick={load} disabled={isLoading} style={{ padding: "10px 14px" }}>
          {isLoading ? "Refreshing…" : "Refresh"}
        </button>
        <div style={{ color: "var(--muted)" }}>
          <strong>{documents.length}</strong> document(s), <strong>{totalChars}</strong> characters
        </div>
      </div>

      {error ? <p style={{ marginTop: 12, color: "#b00" }}>{error}</p> : null}

      <section style={{ marginTop: 16 }}>
        {!hasDocuments ? (
          <p style={{ marginTop: 0, color: "var(--muted)" }}>
            No documents ingested yet. Go to the Ingest page to upload one.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {documents.map((d) => (
              <details
                key={d.name}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: 12,
                  background: "var(--panel)",
                }}
              >
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>{d.name}</summary>
                <pre
                  style={{
                    marginTop: 10,
                    background: "var(--input)",
                    padding: 12,
                    borderRadius: 6,
                    whiteSpace: "pre-wrap",
                    fontSize: 12,
                    color: "var(--foreground)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {d.text}
                </pre>
              </details>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}


