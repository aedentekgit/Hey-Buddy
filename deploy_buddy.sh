#!/bin/bash

# --- Buddy Deployment Script (Run on VPS) ---
# This script will re-build the frontend and restart all backend processes.

set -e

echo "🚀 Starting Buddy Deployment Workflow..."

# 1. Update Dependencies (Backend)
echo "📦 Updating Backend Dependencies..."
cd backend
npm install
cd ..

# 2. Update Dependencies (AI Service)
echo "📦 Updating AI Service Dependencies..."
cd ai-service
pip install -r requirements.txt || pip3 install -r requirements.txt
cd ..

# 3. Build Frontend (for Staging/Production)
echo "🏗️  Building Frontend..."
cd frontend
npm install
npm run build
# (Assumes your site serves from the 'dist' or 'build' folder)
cd ..

# 4. Starting/Restarting Node Backend with PM2
echo "🔄 Restarting Node Backend..."
cd backend
pm2 restart server.js --name Buddy-Backend || pm2 start server.js --name Buddy-Backend
cd ..

# 5. Starting/Restarting Python AI Service with PM2
echo "🔄 Restarting Python AI Service..."
cd ai-service
pm2 restart "python3 run.py" --name Buddy-AI-Service || pm2 start "python3 run.py" --name Buddy-AI-Service
cd ..

# 6. Success
echo "✅ Buddy Deployment Complete!"
echo "📡 Node Backend: Running on 5001"
echo "🧠 AI Service: Running on 8000"
echo "🌐 Make sure Nginx is configured to proxy /api and /socket.io correctly."
echo "   Refer to STAGING_DEPLOY_GUIDE.md for details."
