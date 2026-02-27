const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SERVER = 'root@82.29.167.22';
const args = process.argv.slice(2);
const environment = args[0]; // 'staging' or 'production'

if (!['staging', 'production'].includes(environment)) {
    console.error('❌ Error: Please specify environment. Usage: node scripts/deploy-vps-pro.js <staging|production>');
    process.exit(1);
}

const isProduction = environment === 'production';
const REMOTE_PATH = isProduction ? '/var/www/buddy' : '/var/www/buddy_staging';
const PM2_NAME = isProduction ? 'buddy-backend-prod' : 'buddy-backend-staging';
const TITLE = isProduction ? 'PRODUCTION' : 'STAGING';

console.log(`🚀 Starting Update Deployment to ${TITLE}...`);

// Navigate up one level from 'scripts' to the project root
const projectRoot = path.join(__dirname, '..');
process.chdir(projectRoot);

try {
    // 0. Build Frontend
    console.log(`🏗️  Building Frontend for ${TITLE}...`);
    execSync(`cd frontend && npm install && npm run build -- --mode ${environment}`, { stdio: 'inherit' });

    // 1. Package Front-end
    console.log('📦 Packaging Frontend...');
    execSync('tar -czf frontend.tar.gz -C frontend/dist .');

    // 2. Package Backend
    console.log('📦 Packaging Backend...');
    const excludeFlags = "--exclude='node_modules' --exclude='.env' --exclude='uploads' --exclude='.git' --exclude='frontend.tar.gz' --exclude='backend.tar.gz' --exclude='deploy_to_vps.js' --exclude='deploy_to_staging.js' --exclude='scripts'";
    execSync(`tar ${excludeFlags} -czf backend.tar.gz -C backend .`);

    // 3. Upload to VPS
    console.log(`📤 Uploading packages to VPS ${TITLE}...`);
    execSync(`scp frontend.tar.gz backend.tar.gz ${SERVER}:${REMOTE_PATH}/`);

    // 4. Extract and Restart on VPS
    console.log(`⚙️  Extracting and Restarting on VPS ${TITLE}...`);

    let remoteCommands;

    if (isProduction) {
        remoteCommands = `
            cd ${REMOTE_PATH} &&
            mkdir -p frontend/dist &&
            tar -xzf frontend.tar.gz -C frontend/dist &&
            mkdir -p backend/uploads &&
            cd backend &&
            tar -xzf ../backend.tar.gz &&
            npm install --omit=dev &&
            pm2 restart ${PM2_NAME} || pm2 start server.js --name ${PM2_NAME} --cwd ${REMOTE_PATH}/backend &&
            cd .. &&
            rm frontend.tar.gz backend.tar.gz
        `;
    } else {
        const releaseName = new Date().toISOString().replace(/[:.]/g, '-');
        remoteCommands = `
            cd ${REMOTE_PATH} &&
            mkdir -p releases/${releaseName}/frontend/dist &&
            mkdir -p releases/${releaseName}/backend &&
            mkdir -p shared/uploads &&
            tar -xzf frontend.tar.gz -C releases/${releaseName}/frontend/dist &&
            tar -xzf backend.tar.gz -C releases/${releaseName}/backend &&
            cd releases/${releaseName}/backend &&
            npm install --omit=dev &&
            ln -sfn ${REMOTE_PATH}/shared/.env .env &&
            ln -sfn ${REMOTE_PATH}/shared/uploads uploads &&
            cd ../../../ &&
            ln -sfn releases/${releaseName} current &&
            pm2 delete ${PM2_NAME} || true &&
            pm2 start server.js --name ${PM2_NAME} --cwd ${REMOTE_PATH}/current/backend &&
            rm frontend.tar.gz backend.tar.gz
        `;
    }

    execSync(`ssh ${SERVER} "${remoteCommands}"`);

    // 5. Cleanup local archives
    console.log('🧹 Cleaning up local archives...');
    fs.unlinkSync('frontend.tar.gz');
    fs.unlinkSync('backend.tar.gz');

    console.log(`✅ ${TITLE} DEPLOYMENT COMPLETE!`);
} catch (error) {
    console.error(`❌ ${TITLE} DEPLOYMENT FAILED:`, error.message);
    if (fs.existsSync('frontend.tar.gz')) fs.unlinkSync('frontend.tar.gz');
    if (fs.existsSync('backend.tar.gz')) fs.unlinkSync('backend.tar.gz');
    process.exit(1);
}
