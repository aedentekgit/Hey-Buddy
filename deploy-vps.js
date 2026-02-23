const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// 1. Configuration
const SERVER = 'root@82.29.167.22'; // Your Hostinger VPS
const PROJECT_NAME = 'buddy';

// Parse argument (staging or production)
const env = process.argv[2];
if (!['staging', 'production'].includes(env)) {
    console.error('❌ Error: Please specify environment. Usage: node deploy-vps.js <staging|production>');
    process.exit(1);
}

// Environment specific variables
const isProd = env === 'production';
const BASE_DIR = isProd ? `/var/www/${PROJECT_NAME}_prod` : `/var/www/${PROJECT_NAME}_staging`;
const PM2_NAME = isProd ? `${PROJECT_NAME}-backend-prod` : `${PROJECT_NAME}-backend-staging`;

// Directory structure
const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14); // e.g. 20260223153000
const releaseDir = `${BASE_DIR}/releases/${timestamp}`;
const sharedDir = `${BASE_DIR}/shared`;
const currentDir = `${BASE_DIR}/current`;

const archiveName = `backend-${timestamp}.tar.gz`;

console.log(`\n🚀 Starting ZERO-DOWNTIME deployment to [${env.toUpperCase()}] environment...`);
console.log(`📂 Release ID: ${timestamp}\n`);

try {
    // Step 1: Create local archive of the backend code
    console.log(`[1/4] 📦 Packaging local backend code...`);
    // Exclude heavy/unnecessary folders
    const excludeFlags = `--exclude='./node_modules' --exclude='./.env' --exclude='./.git' --exclude='./uploads' --exclude='./backend' --exclude='*.tar.gz'`;
    execSync(`cd backend && tar ${excludeFlags} -czvf ../${archiveName} .`, { stdio: 'inherit' });

    // Step 2: Ensure server directories exist and upload archive
    console.log(`\n[2/4] 📤 Uploading package to VPS (${SERVER})...`);
    console.log(`(You may be asked for the VPS password)`);
    execSync(`ssh ${SERVER} "mkdir -p ${releaseDir} ${sharedDir}/uploads"`, { stdio: 'inherit' });
    execSync(`scp ${archiveName} ${SERVER}:${releaseDir}/`, { stdio: 'inherit' });

    // Step 3: Extract code and install dependencies securely on the server
    console.log(`\n[3/4] ⚙️  Extracting code and installing production dependencies...`);
    console.log(`(You may be asked for the VPS password)`);
    const setupCommand = `
        cd ${releaseDir} &&
        tar -xzvf ${archiveName} &&
        rm -f ${archiveName} &&
        ln -nfs ${sharedDir}/.env .env &&
        ln -nfs ${sharedDir}/uploads uploads &&
        npm install --omit=dev
    `;
    execSync(`ssh ${SERVER} '${setupCommand}'`, { stdio: 'inherit' });

    // Step 4: Atomic switch (zero-downtime) and restart
    console.log(`\n[4/4] 🔄 Switching live traffic and restarting PM2 process...`);
    console.log(`(You may be asked for the VPS password)`);
    const restartCommand = `
        ln -nfs ${releaseDir} ${currentDir} &&
        cd ${currentDir} &&
        pm2 restart ${PM2_NAME} || pm2 start server.js --name ${PM2_NAME}
    `;
    execSync(`ssh ${SERVER} '${restartCommand}'`, { stdio: 'inherit' });

    // Cleanup local archive
    console.log(`\n🧹 Cleaning up local temporary files...`);
    fs.unlinkSync(archiveName);

    console.log(`\n✅ DEPLOYMENT SUCCESSFUL!`);
    console.log(`The ${env} environment is now running release: ${timestamp}`);

} catch (error) {
    console.error(`\n❌ DEPLOYMENT FAILED:`, error.message);

    // Attempt local cleanup if it failed
    if (fs.existsSync(archiveName)) fs.unlinkSync(archiveName);

    process.exit(1);
}
