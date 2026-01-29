"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  registerMessageEnqueue,
  type MessageOptions,
  type MessageVariant,
} from "@/lib/message";

type Toast = {
  id: string;
  variant: MessageVariant;
  text: string;
};

function getDefaultDurationMs(variant: MessageVariant): number {
  if (variant === "error") return 6000;
  if (variant === "warning") return 4500;
  return 3500;
}

function randomId(): string {
  // Deterministic uniqueness is not required here; this is UI-only.
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function MessageProvider(props: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const enqueue = useMemo(() => {
    return (variant: MessageVariant, text: string, options?: MessageOptions) => {
      const id = randomId();
      setToasts((prev) => [...prev, { id, variant, text }]);

      const durationMs =
        options?.durationMs ?? getDefaultDurationMs(variant);
      if (durationMs <= 0) return;

      const timerId = window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        timersRef.current.delete(id);
      }, durationMs);

      timersRef.current.set(id, timerId);
    };
  }, []);

  useEffect(() => {
    registerMessageEnqueue(enqueue);
    return () => {
      registerMessageEnqueue(null);
      for (const timerId of timersRef.current.values()) {
        window.clearTimeout(timerId);
      }
      timersRef.current.clear();
    };
  }, [enqueue]);

  function dismiss(id: string) {
    const timerId = timersRef.current.get(id);
    if (timerId) {
      window.clearTimeout(timerId);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <>
      {props.children}

      <div
        aria-live="polite"
        aria-relevant="additions removals"
        style={{
          position: "fixed",
          top: 12,
          right: 12,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          zIndex: 9999,
          width: 360,
          maxWidth: "calc(100vw - 24px)",
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => {
          const accent =
            t.variant === "success"
              ? "#22c55e"
              : t.variant === "warning"
                ? "#f59e0b"
                : "#ef4444";

          return (
            <div
              key={t.id}
              role="status"
              style={{
                pointerEvents: "auto",
                border: "1px solid var(--border)",
                borderLeft: `6px solid ${accent}`,
                background: "var(--panel)",
                color: "var(--foreground)",
                borderRadius: 10,
                padding: "10px 10px 10px 12px",
                boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
              }}
            >
              <div style={{ flex: 1, whiteSpace: "pre-wrap" }}>{t.text}</div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                style={{
                  background: "transparent",
                  color: "var(--muted)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "4px 8px",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}


