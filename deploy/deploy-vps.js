const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// 1. Configuration
const SERVER = 'root@194.238.23.158'; // Your Hostinger VPS
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
const GLOBAL_VENV = `/var/www/${PROJECT_NAME}_global_venv`;
const PM2_NAME = isProd ? `${PROJECT_NAME}-backend-prod` : `${PROJECT_NAME}-backend-staging`;

// Directory structure
const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14); // e.g. 20260223153000
const releaseDir = `${BASE_DIR}/releases/${timestamp}`;
const sharedDir = `${BASE_DIR}/shared`;
const currentDir = `${BASE_DIR}/current`;

const backendArchiveName = `backend-${timestamp}.tar.gz`;
const frontendArchiveName = `frontend-${timestamp}.tar.gz`;
const aiArchiveName = `ai-service-${timestamp}.tar.gz`;

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

    // Package AI Service
    const aiExcludeFlags = `--exclude='./venv' --exclude='./.venv' --exclude='.venv' --exclude='./__pycache__' --exclude='./.env' --exclude='./.git' --exclude='./database/chats_data' --exclude='./database/vector_store' --exclude='*.tar.gz'`;
    execSync(`cd python && tar ${aiExcludeFlags} -czvf ../${aiArchiveName} .`, { stdio: 'inherit' });

    // Step 3: Ensure server directories exist and upload archives
    console.log(`\n[3/6] 📤 Uploading packages to VPS (${SERVER})...`);
    console.log(`(You may be asked for the VPS password)`);
    execSync(`sshpass -p 'Aedentek@123#' ssh -o StrictHostKeyChecking=no ${SERVER} "mkdir -p ${releaseDir}/backend ${releaseDir}/frontend ${releaseDir}/ai-service ${sharedDir}/uploads"`, { stdio: 'inherit' });
    execSync(`sshpass -p 'Aedentek@123#' scp -o StrictHostKeyChecking=no ${backendArchiveName} ${frontendArchiveName} ${aiArchiveName} ${SERVER}:${releaseDir}/`, { stdio: 'inherit' });

    // Step 4: Extract code and install dependencies securely on the server
    console.log(`\n[4/6] ⚙️  Extracting backend and frontend code...`);
    console.log(`(You may be asked for the VPS password)`);
    const extractCommand = `
        cd ${releaseDir} &&
        tar -xzvf ${backendArchiveName} -C backend &&
        tar -xzvf ${frontendArchiveName} -C frontend &&
        tar -xzvf ${aiArchiveName} -C ai-service &&
        rm -f ${backendArchiveName} ${frontendArchiveName} ${aiArchiveName} &&
        
        cd backend &&
        ln -nfs ${sharedDir}/.env .env &&
        ln -nfs ${sharedDir}/uploads uploads &&
        npm install --omit=dev &&
        
        cd ../ai-service &&
        ln -nfs ${sharedDir}/.env .env &&
        
        # Global Virtual Environment setup to save space across Prod/Staging
        if [ ! -d "${GLOBAL_VENV}" ]; then
            python3 -m venv ${GLOBAL_VENV}
        fi
        ${GLOBAL_VENV}/bin/pip install --upgrade pip &&
        ${GLOBAL_VENV}/bin/pip install -r requirements.txt
    `;
    execSync(`sshpass -p 'Aedentek@123#' ssh -o StrictHostKeyChecking=no ${SERVER} '${extractCommand}'`, { stdio: 'inherit' });

    // Step 5: Atomic switch (zero-downtime) and restart
    console.log(`\n[5/6] 🔄 Switching live traffic and updating PM2 path...`);
    console.log(`(You may be asked for the VPS password)`);
    // Delete and start ensures the new absolute path in 'current' symlink is used
    const updateCommand = `
        ln -nfs ${releaseDir} ${currentDir} &&
        cd ${currentDir}/backend &&
        pm2 delete ${PM2_NAME} || true &&
        pm2 start server.js --name ${PM2_NAME} &&
        cd ../ai-service &&
        pm2 delete ${PM2_NAME}-ai || true &&
        pm2 start "${GLOBAL_VENV}/bin/python3 main.py" --name ${PM2_NAME}-ai -- --headless &&
        pm2 save
    `;
    execSync(`sshpass -p 'Aedentek@123#' ssh -o StrictHostKeyChecking=no ${SERVER} '${updateCommand}'`, { stdio: 'inherit' });

    // Step 6: Cleanup local archives
    console.log(`\n[6/6] 🧹 Cleaning up local temporary files...`);
    fs.unlinkSync(backendArchiveName);
    fs.unlinkSync(frontendArchiveName);
    fs.unlinkSync(aiArchiveName);

    console.log(`\n✅ DEPLOYMENT SUCCESSFUL!`);
    console.log(`The ${env} environment is now running release: ${timestamp}`);
    console.log(`\n⚠️  IMPORTANT NGINX CHECK:`);
    console.log(`Ensure your Nginx server config root points to:`);
    console.log(`root ${currentDir}/frontend/dist;`);

    // Step 7: Cleanup old releases (keep only last 2)
    console.log(`\n[7/7] 🧹 Pruning old releases on VPS (keeping last 2)...`);
    const cleanupCommand = `cd ${BASE_DIR}/releases && ls -t | tail -n +3 | xargs rm -rf`;
    execSync(`sshpass -p 'Aedentek@123#' ssh -o StrictHostKeyChecking=no ${SERVER} '${cleanupCommand}'`, { stdio: 'inherit' });

    console.log(`\n✨ DONE! Server space optimized.`);

} catch (error) {
    console.error(`\n❌ DEPLOYMENT FAILED:`, error.message);

    // Attempt local cleanup if it failed
    if (fs.existsSync(backendArchiveName)) fs.unlinkSync(backendArchiveName);
    if (fs.existsSync(frontendArchiveName)) fs.unlinkSync(frontendArchiveName);
    if (fs.existsSync(aiArchiveName)) fs.unlinkSync(aiArchiveName);

    process.exit(1);
}
