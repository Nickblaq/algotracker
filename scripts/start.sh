#!/bin/bash
# Start the Next.js dev server (port 3000) and the Python FastAPI backend (port 8000).
# Next proxies /api/* to the backend, so the browser only ever talks to :3000.

set -e

echo "🎨 Starting Next.js dev server on port 3000..."
npm run dev &
NEXT_PID=$!

# Give Next a moment to bind
sleep 3

if kill -0 $NEXT_PID 2>/dev/null; then
  echo "✅ Next.js dev server started (PID $NEXT_PID)"
else
  echo "❌ Next.js dev server failed to start"
  exit 1
fi

echo "🚀 Starting Python backend on port 8000..."
python3 -m uvicorn server.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Give the backend a moment to bind
sleep 2

if kill -0 $BACKEND_PID 2>/dev/null; then
  echo "✅ Python backend started (PID $BACKEND_PID)"
else
  echo "❌ Python backend failed to start"
  exit 1
fi

echo "🔗 Both servers running — Next on :3000, Python API on :8000"

# Cleanup on exit
cleanup() {
  echo "🛑 Shutting down..."
  kill $BACKEND_PID 2>/dev/null || true
  kill $NEXT_PID 2>/dev/null || true
  wait $BACKEND_PID 2>/dev/null || true
  wait $NEXT_PID 2>/dev/null || true
}
trap cleanup EXIT

# Wait for either process to exit
wait
