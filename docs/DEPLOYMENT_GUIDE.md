# 🚀 Buddy Deployment Guide (Staging & Live)

This guide covers how to deploy Buddy to either the Staging or Live environment. The codebase now supports environment-specific configurations for the AI Assistant, Node.js Backend, and React Frontend.

---

## 1. Environment Details

| Feature | Staging | Live (Production) |
| :--- | :--- | :--- |
| **URL** | [https://staging.ayuskart.com](https://staging.ayuskart.com) | [https://ayuskart.com](https://ayuskart.com) |
| **Database** | `staging_Heybuddy` | `live_Heybuddy` |
| **Uploads** | Staging Directory | Live Directory |
| **Node Port** | 5001 | 5001 |
| **AI Port** | 8000 | 8000 |

---

## 2. Update Nginx Configuration (CRITICAL)
Nginx must be configured to proxy requests to the correct backend services. Add these blocks inside the `server` block for **both** domains (staging and live).

```nginx
# Proxy API requests to Node.js backend
location /api/ {
    proxy_pass http://localhost:5001/api/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    
    # Increase body limits for image/doc uploads
    client_max_body_size 50M;
}

# Proxy Socket.io for Real-time Status
location /socket.io/ {
    proxy_pass http://localhost:5001/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Host $host;
}
```

Reload Nginx after changes:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 3. Automated Deployment
I have updated the `deploy_buddy.sh` script to handle both environments.

### For Staging:
```bash
chmod +x deploy_buddy.sh
./deploy_buddy.sh staging
```

### For Live (Production):
```bash
chmod +x deploy_buddy.sh
./deploy_buddy.sh production
```

**What this script does:**
1.  Sets the correct environment variables (`.env`).
2.  Updates Node.js and Python dependencies.
3.  Builds the React frontend with environment-specific URLs.
4.  Restarts services using PM2 with unique names (e.g., `Buddy-Backend-production`).

---

## 4. Manual Service Management (PM2)
If you need to manage services manually:

```bash
# View all services
pm2 list

# View logs
pm2 logs Buddy-Backend-production
pm2 logs Buddy-AI-Service-production

# Restart specific service
pm2 restart Buddy-Backend-production
```

---

## 5. Verification Checklist
1.  **Login**: Verify [staging.ayuskart.com/login](https://staging.ayuskart.com/login) and [ayuskart.com/login](https://ayuskart.com/login).
2.  **AI Assistant**: Test voice/text input. Should show "Online" status.
3.  **Document Upload**: Upload a doc in staging and ensure it doesn't appear in live (and vice versa).
4.  **Database**: Verify that live data is saved to the live DB.
