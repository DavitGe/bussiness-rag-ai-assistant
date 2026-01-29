export type MessageVariant = "success" | "warning" | "error";

export type MessageOptions = {
  /**
   * Duration in milliseconds before auto-dismiss.
   * Set to 0 to disable auto-dismiss.
   */
  durationMs?: number;
};

export type EnqueueMessage = (
  variant: MessageVariant,
  text: string,
  options?: MessageOptions,
) => void;

let enqueue: EnqueueMessage | null = null;

/**
 * Registered by the UI provider at runtime (client-side).
 * Calls are safe no-ops until a provider registers.
 */
export function registerMessageEnqueue(fn: EnqueueMessage | null): void {
  enqueue = fn;
}

function send(
  variant: MessageVariant,
  text: string,
  options?: MessageOptions,
): void {
  const trimmed = text.trim();
  if (!trimmed) return;

  // In Next.js server components / routes, there's no UI to render toasts.
  // We no-op instead of throwing so imports remain safe.
  if (typeof window === "undefined") return;

  enqueue?.(variant, trimmed, options);
}

export const message = {
  success: (text: string, options?: MessageOptions) =>
    send("success", text, options),
  warning: (text: string, options?: MessageOptions) =>
    send("warning", text, options),
  error: (text: string, options?: MessageOptions) =>
    send("error", text, options),
} as const;


