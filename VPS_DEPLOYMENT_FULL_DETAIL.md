# 🚀 Full VPS Deployment Guide: Dev, Staging & Live

This document provides exact details on how the **YQPAY-NOW** project is deployed to a VPS, including the environment-specific configurations for databases and document uploads.

---

## 🏗️ Architecture Overview

The system is designed with three distinct environments:

| Environment | Purpose | Database | Uploaded Docs (Images/PDFs) | Port (Backend) |
| :--- | :--- | :--- | :--- | :--- |
| **Dev** | Local Coding | **Staging DB** | **Shared Staging Directory** | `3000`/`8080` (Local) |
| **Staging** | Testing on VPS | **Staging DB** | **Shared Staging Directory** | `8081` (VPS) |
| **Live** | Production | **Live DB** | **Separate Production Directory** | `8080` (VPS) |

---

## 📂 1. VPS Directory Structure

Log in to your VPS and set up the following folder structure:

```bash
# Main Project Directory
mkdir -p /var/www/yqpaynow

# Environment Directories
mkdir -p /var/www/yqpaynow/staging/releases
mkdir -p /var/www/yqpaynow/production/releases

# Shared Resources (Shared by Dev & Staging)
mkdir -p /var/www/yqpaynow/shared/logs
mkdir -p /var/www/yqpaynow/shared/uploads

# Production Resources (Isolated)
mkdir -p /var/www/html/uploads

# Permissions
chown -R root:www-data /var/www/yqpaynow
chmod -R 775 /var/www/yqpaynow
```

---

## ⚙️ 2. Environment Configurations (`.env`)

Each environment requires a specific `.env` file located in its respective root.

### A. Dev (Local PC)
To work locally but see/upload files to the Staging server, use these settings in your local `backend/.env`:

```env
NODE_ENV=development
PORT=8080

# Connect to Staging DB
MONGODB_URI=mongodb://user:pass@your-vps-ip:27017/yqpay_staging?authSource=admin

# SFTP Upload Mode (Uploads directly to VPS from local)
USE_SFTP_UPLOAD=true
VPS_HOST=your-vps-ip
VPS_SSH_PORT=22
VPS_SSH_USER=root
VPS_SSH_PASSWORD=your_password
VPS_UPLOAD_PATH=/var/www/yqpaynow/shared/uploads
BASE_URL=http://your-vps-ip:8081  # Point to Staging URL to see images
```

### B. Staging (VPS)
Located at `/var/www/yqpaynow/staging/.env`:

```env
NODE_ENV=production
PORT=8081
MONGODB_URI=mongodb://user:pass@127.0.0.1:27017/yqpay_staging?authSource=admin
FRONTEND_URL=http://your-vps-ip:3001
BASE_URL=http://your-vps-ip:8081
# Local uploads on VPS point to the shared directory
UPLOAD_DIR=/var/www/yqpaynow/shared/uploads
```

### C. Live (VPS)
Located at `/var/www/yqpaynow/production/.env`:

```env
NODE_ENV=production
PORT=8080
MONGODB_URI=mongodb://user:pass@127.0.0.1:27017/yqpay_production?authSource=admin
FRONTEND_URL=https://yqpaynow.com
BASE_URL=https://yqpaynow.com
# Isolated Production upload directory
UPLOAD_DIR=/var/www/html/uploads
```

---

## 🚀 3. Deployment Scripts

The project uses custom Node.js scripts to automate deployment.

### Automated Setup
1. **Initialize Infrastructure**: `node backend/scripts/setup-vps-infrastructure.js`
   *(Creates folders and sets permissions)*
2. **Setup Staging Env**: `node backend/scripts/setup-staging-env.js`
   *(Writes the `.env` file to the staging folder on VPS)*

### Deploying Code
Use the professional deployment script which handles zero-downtime symlinking:

```bash
# To Deploy to Staging
node backend/scripts/deploy-vps-pro.js staging

# To Deploy to Live
node backend/scripts/deploy-vps-pro.js production
```

**What the script does:**
1. Connects via SSH/SFTP.
2. Creates a new release folder with a timestamp (e.g., `releases/20240101-120000`).
3. Uploads `backend` and `frontend/dist` files.
4. Runs `npm install --production` remotely.
5. Swaps the `current` symlink to the new release.
6. Restarts the PM2 process (`yqpaynow-staging` or `yqpaynow-production`).

---

## 🌐 4. Nginx Configuration

Nginx acts as the gatekeeper, routing traffic to the correct ports.

### Staging Nginx (`/etc/nginx/sites-available/staging`)
```nginx
server {
    listen 3001; # Staging Port
    root /var/www/yqpaynow/staging/current/frontend;
    
    location /api {
        proxy_pass http://127.0.0.1:8081; # Staging Backend
    }
    
    location /uploads {
        alias /var/www/yqpaynow/shared/uploads; # Shared Dev/Staging Uploads
    }
}
```

### Live Nginx (`/etc/nginx/sites-available/production`)
```nginx
server {
    listen 80;
    server_name yqpaynow.com;
    root /var/www/yqpaynow/production/current/frontend;

    location /api {
        proxy_pass http://127.0.0.1:8080; # Production Backend
    }

    location /uploads {
        alias /var/www/html/uploads; # Isolated Live Uploads
    }
}
```

---

## 📱 5. PM2 Process Management

Use PM2 to keep the apps running forever.

```bash
# List all processes
pm2 list

# Restart specifically
pm2 restart yqpaynow-staging
pm2 restart yqpaynow-production

# View logs
pm2 logs yqpaynow-staging
```

---

## 📝 6. Summary of Upload Logic

1. **Dev Mode**: When you upload a file from your Local PC, the `sftpUploadUtil.js` uses your `.env` credentials to connect to the VPS and place the file in `/var/www/yqpaynow/shared/uploads`.
2. **Staging Mode**: When the VPS Staging app saves a file, it saves it directly to `/var/www/yqpaynow/shared/uploads`.
3. **Live Mode**: When the Live app saves a file, it saves it to `/var/www/html/uploads`. It has **no access** to the staging files, ensuring separation.

---

## �️ 8. Security & Firewall (Hostinger VPS)

If your app is unreachable, ensure the following ports are open in your VPS provider's firewall (e.g., Hostinger hPanel):

| Port | Protocol | Purpose |
| :--- | :--- | :--- |
| `80` | TCP | HTTP (Redirection) |
| `443` | TCP | HTTPS (Live App) |
| `22` | TCP | SSH (Deployment/SFTP) |
| `8080` | TCP | Production API (Standard) |
| `3001` | TCP | Staging Frontend |
| `8081` | TCP | Staging API |
| `27017` | TCP | MongoDB (Must be restricted to your IP only!) |

---

## 🔒 9. SSL Configuration (Certbot)

To enable HTTPS on Live:

1. Install Certbot: `sudo apt install certbot python3-certbot-nginx`
2. Run Certbot for your domain: `sudo certbot --nginx -d yqpaynow.com -d www.yqpaynow.com`
3. Certbot will automatically update your Nginx configuration with the SSL certificate paths.

---

## 💡 10. Key Tips for New Projects

- **Shared Directory**: Always use the `alias` directive in Nginx if you want two different environments (Dev/Staging) to serve the same physical files.
- **Symlinking**: The use of a `current` symlink is the industry standard for "Atomic Deployments." If a deployment fails, the `current` link still points to the old working version.
- **PM2 Names**: Always name your processes with the environment suffix (`-staging`, `-prod`) to avoid accidentally stopping the wrong one.
- **Environment Logic**: Keep your SFTP logic inside a utility like `sftpUploadUtil.js` so you can easily toggle it with one variable (`USE_SFTP_UPLOAD`).
