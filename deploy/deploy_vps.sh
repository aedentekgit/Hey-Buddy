#!/bin/bash

# Exit on error
set -e

echo "Starting Deployment on VPS..."

# 1. Unpack Backend
cd /var/www/buddy
tar -xzf backend.tar.gz
rm backend.tar.gz

# 2. Unpack Frontend
mkdir -p frontend
tar -xzf frontend.tar.gz -C frontend
rm frontend.tar.gz

# 3. Install Backend Dependencies
cd /var/www/buddy/backend
npm install --omit=dev

# 4. Restore Database
node restore_db.js

# 5. Configure Nginx
ln -sf /etc/nginx/sites-available/buddy.conf /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

# 6. Start/Restart Backend with PM2
pm2 stop buddy-backend || true
pm2 start server.js --name buddy-backend --env production

# 7. Save PM2 list
pm2 save

echo "Deployment Complete!"
