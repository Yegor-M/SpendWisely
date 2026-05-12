#!/usr/bin/env bash
set -e

echo "=== SpendWisely setup ==="

# Backend
cd v2/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "Created v2/backend/.env — open it and set ANTHROPIC_API_KEY before importing data."
  echo ""
fi

# Frontend
cd ../frontend
npm install

echo ""
echo "Done. To start:"
echo "  Terminal 1: cd v2/backend && source .venv/bin/activate && uvicorn app.main:app --reload"
echo "  Terminal 2: cd v2/frontend && npm run dev"
echo ""
echo "Then open http://localhost:3000"
