# Hierarchical Memory for LLMs

A weighted graph memory system for LLM conversations. Every memory carries an
emergent weight that rises with use (recency-weighted access, query similarity,
graph neighbourhood strength) and decays against time since it was last used.
Memories retrieved together are linked by edges that strengthen on co-retrieval
and decay when they stop being used together. Chat turns read from the graph
and, only once the assistant reply is stored, write back to it.

## Stack

- Next.js 16.3 (App Router) + React 19
- Python FastAPI + async SQLAlchemy + SQLite
- scikit-learn TF-IDF for retrieval scoring
- react-markdown + remark-gfm for assistant message rendering

The browser only talks to the Next.js origin. `next.config.ts` rewrites `/api/*`
to the FastAPI server, so no CORS handling is needed in development.

## Layout

```
src/app/          routes: /chat, /memories, /api/llm (server-side model proxy)
src/components/   shell, chat panel, memory toolbar, tier view
src/hooks/        useMemoryStore — one shared store for every page
src/lib/          api client for the Python endpoints
server/           FastAPI app, models, memory manager, routes
server/           /api/memories, /api/chat
```

`app/globals.css` holds every style. There is no CSS framework.

## Running

```bash
npm install
pip install -r requirements.txt
./scripts/start.sh
```

Or separately:

```bash
npm run dev                                            # http://localhost:3000
python3 -m uvicorn server.main:app --port 8000
```

## Configuration

There are no environment variables. Settings are constants:

- `PYTHON_API` in `next.config.ts` — where FastAPI runs
- `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` in `src/lib/config.ts` — the single
  source for the model and key

The config is imported only by `src/app/api/llm/route.ts`, which runs on the
server, so the key is never bundled into the browser. Do not import it from a
client component.

## Endpoints

```
GET    /api/health
GET    /api/memories
POST   /api/memories            {content, importance, tags}
GET    /api/memories/{uid}
DELETE /api/memories/{uid}
POST   /api/memories/search     {query, top_k}
POST   /api/memories/retrieve   {query, top_k}   (reinforces the graph)
POST   /api/memories/prune
POST   /api/memories/recompute                    (repair: rebuild weights, drop dead edges, prune)
POST   /api/chat/send           {content, session_id}   (read-only retrieval; builds the model prompt)
POST   /api/chat/respond        {content, session_id, reinforce}
GET    /api/chat/history        ?session_id=&limit=
GET    /api/chat/sessions                            (every session, newest activity first)
POST   /api/chat/truncate       {session_id, after_uid, before_uid}  (edit-and-resend cleanup)
POST   /api/chat/clear          ?session_id=
```

## Chat behaviour

- **Enter is newline-only.** Sending is the send button.
- **Stop** replaces the send button while a reply is generating. It aborts the
  in-flight model call; the assistant reply is never stored, so the graph is
  untouched. The user message itself was already stored (that is what retrieval
  ran on), so a stopped turn leaves an unanswered last message.
- **Edit a message** with the pencil on any user bubble. The edit is stored as a
  normal turn first; only after the new reply lands are the old copy of the
  edited message and the stale turns after it deleted, so the edit becomes the
  newest message. Memories learned from removed messages stay in the graph —
  chat history is corrected, memory history is not.
- **History** in the chat topbar lists past sessions with title, message count
  and last activity; clicking one loads it.

## Notes

The SQLite database is created on first start as `hmm_data.db`. Nothing is
seeded — the graph starts empty, and the only writers are chat and the
Add-memory form on the Memories page. `POST /api/memories/recompute` rebuilds
all weights deterministically from importance plus access history, drops edges
pointing at deleted memories and prunes faded isolated ones, so the graph can
always be repaired rather than trusted.
