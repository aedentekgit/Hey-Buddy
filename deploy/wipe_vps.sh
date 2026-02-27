#!/bin/bash

# WARNING: This script is highly destructive!
# It will completely delete all buddy projects on this VPS,
# kill all node processes, wipe the Nginx configs, AND wipe the databases.
# Make sure you have backed up any databases or .env files first.

echo "🚨 WARNING: Completely wiping the Buddy deployment AND databases."

echo "🧹 1/4: Killing old PM2 processes..."
pm2 delete all || true
pm2 save --force

echo "🗑️  2/4: Deleting old web directories (/var/www/buddy*)..."
rm -rf /var/www/buddy*

echo "⚙️  3/4: Clearing old Nginx configurations..."
rm -f /etc/nginx/sites-enabled/buddy.conf
rm -f /etc/nginx/sites-available/buddy.conf
systemctl reload nginx || true

echo "💥 4/4: Dropping Staging and Production MongoDB Databases..."
mongosh buddy_production --eval "db.dropDatabase()" || true
mongosh staging_Heybuddy --eval "db.dropDatabase()" || true
mongosh test --eval "db.dropDatabase()" || true

echo "✅ WIPE COMPLETE: The VPS and Databases are now completely clean."
echo "You can now run 'bash setup_vps.sh' to start fresh."
