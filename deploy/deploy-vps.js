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

const backendArchiveName = `backend-${timestamp}.tar.gz`;
const frontendArchiveName = `frontend-${timestamp}.tar.gz`;

console.log(`\n🚀 Starting ZERO-DOWNTIME deployment to [${env.toUpperCase()}] environment...`);
console.log(`📂 Release ID: ${timestamp}\n`);

try {
    // Step 1: Build Frontend
    console.log(`[1/6] 🏗️  Building local Vite frontend for ${env}...`);
    execSync(`cd frontend && npm install && npx vite build --mode ${env}`, { stdio: 'inherit' });

    // Step 2: Create local archives
    console.log(`\n[2/6] 📦 Packaging local frontend and backend code...`);
    // Package Frontend dist directory
    execSync(`cd frontend && tar -czvf ../${frontendArchiveName} dist`, { stdio: 'inherit' });

    // Package Backend
    const excludeFlags = `--exclude='./node_modules' --exclude='./.env' --exclude='./.git' --exclude='./uploads' --exclude='./backend' --exclude='*.tar.gz'`;
    execSync(`cd backend && tar ${excludeFlags} -czvf ../${backendArchiveName} .`, { stdio: 'inherit' });

    // Step 3: Ensure server directories exist and upload archives
    console.log(`\n[3/6] 📤 Uploading packages to VPS (${SERVER})...`);
    console.log(`(You may be asked for the VPS password)`);
    execSync(`ssh ${SERVER} "mkdir -p ${releaseDir}/backend ${releaseDir}/frontend ${sharedDir}/uploads"`, { stdio: 'inherit' });
    execSync(`scp ${backendArchiveName} ${frontendArchiveName} ${SERVER}:${releaseDir}/`, { stdio: 'inherit' });

    // Step 4: Extract code and install dependencies securely on the server
    console.log(`\n[4/6] ⚙️  Extracting backend and frontend code...`);
    console.log(`(You may be asked for the VPS password)`);
    const extractCommand = `
        cd ${releaseDir} &&
        tar -xzvf ${backendArchiveName} -C backend &&
        tar -xzvf ${frontendArchiveName} -C frontend &&
        rm -f ${backendArchiveName} ${frontendArchiveName} &&
        cd backend &&
        ln -nfs ${sharedDir}/.env .env &&
        ln -nfs ${sharedDir}/uploads uploads &&
        npm install --omit=dev
    `;
    execSync(`ssh ${SERVER} '${extractCommand}'`, { stdio: 'inherit' });

    // Step 5: Atomic switch (zero-downtime) and restart
    console.log(`\n[5/6] 🔄 Switching live traffic and updating PM2 path...`);
    console.log(`(You may be asked for the VPS password)`);
    // Delete and start ensures the new absolute path in 'current' symlink is used
    const updateCommand = `
        ln -nfs ${releaseDir} ${currentDir} &&
        cd ${currentDir}/backend &&
        pm2 delete ${PM2_NAME} || true &&
        pm2 start server.js --name ${PM2_NAME} &&
        pm2 save
    `;
    execSync(`ssh ${SERVER} '${updateCommand}'`, { stdio: 'inherit' });

    // Step 6: Cleanup local archives
    console.log(`\n[6/6] 🧹 Cleaning up local temporary files...`);
    fs.unlinkSync(backendArchiveName);
    fs.unlinkSync(frontendArchiveName);

    console.log(`\n✅ DEPLOYMENT SUCCESSFUL!`);
    console.log(`The ${env} environment is now running release: ${timestamp}`);
    console.log(`\n⚠️  IMPORTANT NGINX CHECK:`);
    console.log(`Ensure your Nginx server config root points to:`);
    console.log(`root ${currentDir}/frontend/dist;`);

} catch (error) {
    console.error(`\n❌ DEPLOYMENT FAILED:`, error.message);

    // Attempt local cleanup if it failed
    if (fs.existsSync(backendArchiveName)) fs.unlinkSync(backendArchiveName);
    if (fs.existsSync(frontendArchiveName)) fs.unlinkSync(frontendArchiveName);

    process.exit(1);
}
