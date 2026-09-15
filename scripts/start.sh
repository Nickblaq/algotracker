#!/bin/bash
# Start both the Vite dev server and the Python FastAPI backend.
# Vite starts first so Freebuff detects port 5173 for the preview.

set -e

echo "🎨 Starting Vite dev server on port 5173..."
bun run dev &
VITE_PID=$!

# Give Vite a moment to bind
sleep 2

# Check if Vite started
if kill -0 $VITE_PID 2>/dev/null; then
  echo "✅ Vite dev server started (PID $VITE_PID)"
else
  echo "❌ Vite dev server failed to start"
  exit 1
fi

echo "🚀 Starting Python backend on port 8000..."
python3 -m uvicorn server.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Give the backend a moment to bind
sleep 2

# Check if backend started
if kill -0 $BACKEND_PID 2>/dev/null; then
  echo "✅ Python backend started (PID $BACKEND_PID)"
else
  echo "❌ Python backend failed to start"
  exit 1
fi

echo "🔗 Both servers running — Vite on :5173, Python API on :8000"

# Cleanup on exit
cleanup() {
  echo "🛑 Shutting down..."
  kill $BACKEND_PID 2>/dev/null || true
  kill $VITE_PID 2>/dev/null || true
  wait $BACKEND_PID 2>/dev/null || true
  wait $VITE_PID 2>/dev/null || true
}
trap cleanup EXIT

# Wait for either process to exit
wait
