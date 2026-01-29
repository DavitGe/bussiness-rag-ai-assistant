import "server-only";

import { InMemoryVectorStore } from "@/lib/vectorStore";

export type StoredDocument = {
  name: string;
  text: string;
  ingestedAt: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __ragVectorStore: InMemoryVectorStore | undefined;
  // eslint-disable-next-line no-var
  var __ragDocuments: Map<string, StoredDocument> | undefined;
}

export function getVectorStore(): InMemoryVectorStore {
  // Keep a singleton store for the lifetime of the Node.js process.
  // Note: in-memory stores are not shared across serverless instances.
  globalThis.__ragVectorStore ??= new InMemoryVectorStore();
  return globalThis.__ragVectorStore;
}

export function upsertDocument(params: {
  name: string;
  text: string;
}): StoredDocument {
  const name = params.name.trim();
  const text = params.text;

  if (name.length === 0) {
    throw new Error("upsertDocument: name must be non-empty");
  }

  globalThis.__ragDocuments ??= new Map<string, StoredDocument>();

  const doc: StoredDocument = {
    name,
    text,
    ingestedAt: new Date().toISOString(),
  };

  globalThis.__ragDocuments.set(name, doc);
  return doc;
}

export function listDocuments(): StoredDocument[] {
  globalThis.__ragDocuments ??= new Map<string, StoredDocument>();
  return Array.from(globalThis.__ragDocuments.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}


