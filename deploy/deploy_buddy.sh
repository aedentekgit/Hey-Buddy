#!/bin/bash

# --- Buddy Deployment Script (Run on VPS) ---
# Usage: ./deploy_buddy.sh [staging|production]

set -e

ENV=$1

if [[ "$ENV" != "staging" && "$ENV" != "production" ]]; then
    echo "❌ Usage: ./deploy_buddy.sh [staging|production]"
    exit 1
fi

echo "🚀 Starting Buddy Deployment Workflow for environment: $ENV..."

# 1. Update Dependencies (Backend)
echo "📦 Updating Backend Dependencies..."
cd backend
npm install
cp .env.$ENV .env
cd ..

# 2. Update Dependencies (AI Service)
echo "📦 Updating AI Service Dependencies..."
cd python
pip install -r requirements.txt || pip3 install -r requirements.txt
cp .env.$ENV .env
cd ..

# 3. Build Frontend
echo "🏗️  Building Frontend..."
cd frontend
npm install
# Copy correct env for frontend build
cp .env.$ENV .env
npm run build
cd ..

# 4. Starting/Restarting Node Backend with PM2
echo "🔄 Restarting Node Backend..."
cd backend
pm2 restart server.js --name Buddy-Backend-$ENV || pm2 start server.js --name Buddy-Backend-$ENV
cd ..

# 5. Starting/Restarting Python AI Service with PM2
echo "🔄 Restarting Python AI Service..."
cd python
pm2 restart "python3 run.py" --name Buddy-AI-Service-$ENV || pm2 start "python3 run.py" --name Buddy-AI-Service-$ENV
cd ..

# 6. Success
echo "✅ Buddy Deployment Complete ($ENV)!"
echo "📡 Node Backend: Running on 5001"
echo "🧠 AI Service: Running on 8000"
echo "🌐 URL: $(grep VITE_FRONTEND_URL frontend/.env.$ENV | cut -d'=' -f2)"

