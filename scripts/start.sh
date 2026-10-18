#!/bin/bash
set -e

echo "Starting Next.js on port 3000..."
npm run start &
NEXT_PID=$!

sleep 3

if kill -0 $NEXT_PID 2>/dev/null; then
  echo "✅ Next.js started (PID $NEXT_PID)"
else
  echo "❌ Next.js failed to start"
  exit 1
fi

echo "Starting Python FastAPI backend on port 8000..."
python3 -m uvicorn server.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

sleep 2

if kill -0 $BACKEND_PID 2>/dev/null; then
  echo "✅ Python backend started (PID $BACKEND_PID)"
else
  echo "❌ Python backend failed to start"
  exit 1
fi

echo "🔗 Both servers running — Next on :3000, Python API on :8000"

cleanup() {
  echo "🛑 Shutting down..."
  kill $NEXT_PID $BACKEND_PID 2>/dev/null || true
  wait $NEXT_PID $BACKEND_PID 2>/dev/null || true
}
trap cleanup EXIT

wait
