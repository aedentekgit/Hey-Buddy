# 🚀 Buddy Deployment Guide (Staging/Production)

I have fixed the code to ensure that the AI Assistant works correctly over HTTPS without needing port numbers. Follow these steps to complete the deployment on your VPS.

---

## 1. Update Nginx Configuration (CRITICAL)
This fixes the `ERR_SSL_PROTOCOL_ERROR` and WebSocket disconnects.
Edit your Nginx site configuration (usually in `/etc/nginx/sites-available/...` or `/etc/nginx/conf.d/...`) and add these blocks inside the `server` block for your staging/live domain:

```nginx
# Proxy API requests to Node.js backend
location /api/ {
    proxy_pass http://localhost:5001/api/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    
    # Increase body limits for image uploads
    client_max_body_size 50M;
}

# Proxy Socket.io for Real-time Status indicators
location /socket.io/ {
    proxy_pass http://localhost:5001/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Host $host;
}
```

Then reload Nginx:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 2. Prepare the Python Service
Make sure you have PM2 installed on your server (`npm install -g pm2`).
Navigate to the `ai-service` folder on your server:

```bash
cd ai-service
pip install -r requirements.txt
pm2 start "python3 run.py" --name Buddy-AI-Service
```

---

## 3. Deployment Script
I have created a script called `deploy_buddy.sh` in the root of your project. You can upload this to your server and run it periodically to update everything:

```bash
# On your server root:
chmod +x deploy_buddy.sh
./deploy_buddy.sh
```

This script will rebuild the frontend and restart all backend processes using PM2.

---

## 4. Verification
Once deployed, check:
1.  **Dashboard Status**: Should show "Online" in the top right.
2.  **Voice Assistant**: Should work immediately without returning "Failed to fetch".
3.  **URL Verification**: In your browser console, it should no longer try to connect to `:5001`.
