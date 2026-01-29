"use client";

import { message } from "@/lib/message";
import { useMemo, useState } from "react";

type IngestResponse =
  | { ok: true; chunksAdded: number }
  | { ok: false; error: string; message?: string };

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

export default function IngestPage() {
  const [documentName, setDocumentName] = useState<string>("");
  const [documentText, setDocumentText] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const canSubmit = useMemo(() => {
    return documentName.trim().length > 0 && documentText.trim().length > 0;
  }, [documentName, documentText]);

  async function handleIngest() {
    message.warning("You don't have permission to ingest documents.");
    return;
    // setStatus("");

    // const name = documentName.trim();
    // const text = documentText.trim();
    // if (!name || !text) {
    //   setStatus("Please provide both document name and text.");
    //   return;
    // }

    // setIsSubmitting(true);
    // try {
    //   const res = await postJson<IngestResponse>("/api/ingest", {
    //     documentName: name,
    //     text,
    //   });

    //   if ("ok" in res && res.ok) {
    //     setStatus(`Ingested successfully. Chunks added: ${res.chunksAdded}.`);
    //     return;
    //   }

    //   setStatus(res.message ? `${res.error}: ${res.message}` : res.error);
    // } catch (err) {
    //   const message = err instanceof Error ? err.message : "Unknown error";
    //   setStatus(`Ingestion failed: ${message}`);
    // } finally {
    //   setIsSubmitting(false);
    // }
  }

  return (
    <main
      style={{
        maxWidth: 920,
        margin: "0 auto",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ marginBottom: 8 }}>Ingest Documents</h1>
      <p style={{ marginTop: 0, color: "var(--muted)" }}>
        Paste raw text to ingest.
      </p>

      <section
        style={{
          border: "1px solid var(--border)",
          padding: 16,
          borderRadius: 8,
          marginTop: 16,
          background: "var(--panel)",
        }}
      >
        <label style={{ display: "block", marginBottom: 10 }}>
          Document name
          <input
            value={documentName}
            onChange={(e) => setDocumentName(e.target.value)}
            placeholder="e.g., Employee Handbook v3"
            style={{
              display: "block",
              width: "100%",
              padding: 10,
              marginTop: 6,
              background: "var(--input)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
              borderRadius: 8,
            }}
          />
        </label>

        <label style={{ display: "block", marginBottom: 10 }}>
          Document text
          <textarea
            value={documentText}
            onChange={(e) => setDocumentText(e.target.value)}
            placeholder="Paste raw document text here…"
            rows={14}
            style={{
              display: "block",
              width: "100%",
              padding: 10,
              marginTop: 6,
              resize: "vertical",
              background: "var(--input)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
              borderRadius: 8,
            }}
          />
        </label>

        <button
          type="button"
          onClick={handleIngest}
          disabled={!canSubmit || isSubmitting}
          style={{
            padding: "10px 14px",
            background: "var(--user-bubble)",
            color: "#fff",
            border: "1px solid var(--user-bubble)",
            borderRadius: 8,
          }}
        >
          {isSubmitting ? "Ingesting…" : "Ingest"}
        </button>

        {status ? (
          <p
            style={{
              marginTop: 12,
              color: status.startsWith("Ingested") ? "#0a6" : "#b00",
            }}
          >
            {status}
          </p>
        ) : null}
      </section>
    </main>
  );
}


