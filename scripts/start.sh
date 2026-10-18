#!/bin/bash
set -e

echo "Starting Python FastAPI backend on port 8000..."
PYTHONPATH=./python-modules python3 -m uvicorn server.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo "Starting Next.js on port 3000..."
npm run start &
NEXT_PID=$!

cleanup() {
  kill $BACKEND_PID $NEXT_PID 2>/dev/null || true
  wait $BACKEND_PID $NEXT_PID 2>/dev/null || true
}
trap cleanup EXIT

wait
