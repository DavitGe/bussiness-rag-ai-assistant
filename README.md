# RAG-based Business Assistant (Next.js)

Production-minded **RAG (Retrieval-Augmented Generation)** business assistant built with:

- **Next.js App Router** + **TypeScript**
- **Server-side only** AI calls (OpenAI-compatible API)
- **In-memory vector store** (MVP) with cosine similarity
- **Zod** for request/response validation and strict schema enforcement

The UI has three routes:

- `/` – chat experience (messaging style)
- `/ingest` – ingest raw document text
- `/documents` – preview ingested documents (collapsible by document name)

---

## Getting started

### Prerequisites

- Node.js 20+
- An OpenAI-compatible API key

### Environment variables

Set the following variables (e.g., in `.env.local`):

- `OPENAI_API_KEY` (**required**)
- `OPENAI_BASE_URL` (optional; for OpenAI-compatible providers/gateways)
- `OPENAI_EMBEDDINGS_MODEL` (optional; defaults to `text-embedding-3-small`)
- `OPENAI_CHAT_MODEL` (optional; defaults to `gpt-3.5-turbo` in `src/lib/queryRag.ts`)

### Run locally

```bash
npm run dev
```

Then open `http://localhost:3000`.

---

## Architecture overview

### Frontend (client)

- Pages are simple client UIs that call server routes:
  - Chat UI: `src/app/page.tsx`
  - Ingest UI: `src/app/ingest/page.tsx`
  - Documents preview UI: `src/app/documents/page.tsx`
- A global toast system is available via:
  - `message.success("...")`, `message.warning("...")`, `message.error("...")`
  - See `src/lib/message.ts` + `src/components/MessageProvider.tsx`

### Backend (server)

All AI logic runs on the server:

- **API routes**
  - `POST /api/ingest`: `src/app/api/ingest/route.ts`
  - `POST /api/query`: `src/app/api/query/route.ts`
  - `GET /api/documents`: `src/app/api/documents/route.ts`

- **Shared in-memory state**
  - `src/lib/ragState.ts` keeps a **process-level singleton**:
    - `InMemoryVectorStore` for retrieval
    - in-memory document registry for `/documents` preview
  - Note: in-memory state is per Node.js process and not shared across instances.

---

## RAG flow (end-to-end)

### Ingestion: `POST /api/ingest`

1. Validate request with Zod.
2. Chunk raw text deterministically (paragraph-first, target ~500 “tokens” via a stable heuristic).
3. Embed each chunk server-side (`src/lib/embeddings.ts`).
4. Store `{ embedding, metadata }` in the vector store (`src/lib/vectorStore.ts`).
5. Store raw document text in the document registry for preview (`/documents`).

Implementation:

- `src/lib/ingestion.ts`
- `src/lib/embeddings.ts`
- `src/lib/vectorStore.ts`
- `src/lib/ragState.ts`

### Query: `POST /api/query`

1. Validate request with Zod (including input size limits + trim).
2. Embed the user query.
3. Retrieve top-K chunks using cosine similarity.
4. Build a prompt containing only the user question + retrieved excerpts.
5. Call the LLM with deterministic settings (`temperature: 0`).
6. Parse model output as JSON and validate with Zod.
7. Retry once if the output is invalid JSON or fails schema validation.

Implementation:

- `src/lib/queryRag.ts`
- `src/lib/ragPrompts.ts`
- `src/lib/ragResponseSchema.ts`

---

## Prompt strategy

Prompts are designed to minimize hallucinations and prompt-injection risks:

- **Grounding**: the assistant must answer **only** from retrieved excerpts.
- **Citations**: responses must include the exact excerpts used.
- **JSON-only output**: no prose outside JSON.
- **Prompt injection defense**:
  - retrieved excerpts are treated as **untrusted data**
  - the assistant is told to ignore any “instructions” inside excerpts

See `src/lib/ragPrompts.ts`.

---

## Schema enforcement (strict JSON)

The assistant output must match the Zod schema in:

- `src/lib/ragResponseSchema.ts`

The pipeline validates:

- the model returns a JSON object (tolerant extraction if the provider adds a preamble)
- the JSON matches the schema (types + bounds such as `confidenceScore` in `[0, 1]`)
- a single retry is performed with a “fix output” instruction on invalid output

---

## Safeguards

Built-in guardrails in the query pipeline:

- **Empty query protection**: server rejects whitespace-only queries.
- **No relevant docs**: if retrieval finds nothing above a relevance threshold, the system returns a deterministic “insufficient information” response **without calling the LLM**.
- **Low confidence**: if the model returns a low confidence score, the system forces an “insufficient information” response.
- **Excerpt size bounds**: retrieved excerpts are truncated to reduce injection surface and cost.

---

## Trade-offs and limitations (current MVP)

- **In-memory vector store**:
  - lost on server restart/cold start
  - not shared across multiple instances
  - suitable only for MVP and development

- **Chunking is heuristic**:
  - token estimation uses a deterministic approximation (`chars/4`)
  - PDF cleanup/parsing is not included yet (raw text only)

- **Default data seeding**:
  - The default documents are seeded via `src/lib/regState.ts`.
  - Seeding happens when the server begins handling requests (e.g., first call to `/api/query`).
  - This triggers embedding calls and can add latency to the first request.

---

## Future improvements

- **Persistence**
  - Replace in-memory store with FAISS-on-disk or a managed vector DB.
  - Persist ingested documents and metadata.

- **Better document ingestion**
  - Add PDF/DOCX parsing (already listed as a future step).
  - Add cleaning, de-duplication, and section-aware chunking.

- **Stronger retrieval**
  - Hybrid retrieval (BM25 + embeddings)
  - Re-ranking (cross-encoder or lightweight reranker)
  - Source filtering and per-document access controls

- **Security hardening**
  - Auth for ingestion and document preview
  - Multi-tenant isolation and per-user vector stores
  - Structured logging + audit trails

- **Observability**
  - Trace request timing (embed/retrieve/model/validation)
  - Monitoring for invalid JSON rates and retry frequency

