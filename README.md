# Hierarchical Memory for LLMs

A five-tier memory system for LLM conversations. Memories are stored in
sensory, short term, long term, episodic and procedural tiers, scored by text
similarity, recency, importance and access count, and promoted or pruned over
time. Relevant memories are retrieved on each message and injected into the
model prompt.

## Stack

- Next.js 16.3 (App Router) + React 19
- Python FastAPI + async SQLAlchemy + SQLite
- scikit-learn TF-IDF for retrieval scoring

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

There are no environment variables. The two settings live as constants at the
top of the file that uses them:

- `PYTHON_API` in `next.config.ts` — where FastAPI runs
- `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` in `src/app/api/llm/route.ts`

The model key is only read by that route handler, which runs on the server, so
it is never bundled into the browser.

## Endpoints

```
GET    /api/health
GET    /api/memories            ?tier=
POST   /api/memories            {content, tier, importance, tags}
GET    /api/memories/{uid}
DELETE /api/memories/{uid}
POST   /api/memories/search     {query, tier, top_k}
POST   /api/memories/retrieve   {query, top_k}
POST   /api/memories/decay
POST   /api/memories/consolidate
POST   /api/memories/prune
POST   /api/chat/send           {content, session_id}
POST   /api/chat/respond        {content, session_id}
GET    /api/chat/history        ?session_id=&limit=
POST   /api/chat/clear          ?session_id=
```

## Notes

The SQLite database is created on first start as `hmm_data.db` and seeded with
twelve demo memories when empty.
