#!/bin/bash

# Exit on error
set -e

echo "Starting VPS Setup for Buddy..."

# Fix potential line ending issues
# No-op but keeps the file clean

# 1. Update System
apt update && apt upgrade -y

# 2. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 3. Install MongoDB
apt-get install -y gnupg curl
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt update
apt install -y mongodb-org
systemctl start mongod
systemctl enable mongod

# 4. Install Nginx
apt install -y nginx
systemctl start nginx
systemctl enable nginx

# 5. Install PM2
npm install -g pm2

# 6. Create Directory Structure for Staging and Production
mkdir -p /var/www/buddy_prod/shared/uploads
mkdir -p /var/www/buddy_prod/releases
mkdir -p /var/www/buddy_staging/shared/uploads
mkdir -p /var/www/buddy_staging/releases

# Optional: You can copy up any existing .env files manually 
#   -> /var/www/buddy_prod/shared/.env 
#   -> /var/www/buddy_staging/shared/.env

echo "VPS Environment Setup Complete!"
