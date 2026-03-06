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
const PM2_AI_NAME = isProduction ? 'buddy-ai-prod' : 'buddy-ai-staging';
const AI_PORT = isProduction ? '8000' : '8001';
const BACKEND_PORT = isProduction ? '5001' : '5002';
const TITLE = isProduction ? 'PRODUCTION' : 'STAGING';

console.log(`🚀 Starting Update Deployment to ${TITLE}...`);

// Navigate up one level from 'scripts' to the project root
const projectRoot = path.resolve(__dirname, '..');
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
    const excludeFlags = "--exclude='node_modules' --exclude='.env' --exclude='uploads' --exclude='.git' --exclude='frontend.tar.gz' --exclude='backend.tar.gz' --exclude='ai-service.tar.gz' --exclude='scripts'";
    execSync(`tar ${excludeFlags} -czf backend.tar.gz -C backend .`);

    // 3. Package AI Service
    console.log('📦 Packaging AI Service...');
    const aiExcludeFlags = "--exclude='venv' --exclude='.env' --exclude='__pycache__' --exclude='database' --exclude='.git' --exclude='server_log.txt' --exclude='*.tar.gz'";
    execSync(`tar ${aiExcludeFlags} -czf ai-service.tar.gz -C ai-service .`);

    // 4. Upload to VPS
    console.log(`📤 Uploading packages to VPS ${TITLE}...`);
    execSync(`scp frontend.tar.gz backend.tar.gz ai-service.tar.gz ${SERVER}:${REMOTE_PATH}/`);

    // 5. Extract and Restart on VPS
    console.log(`⚙️  Extracting and Restarting on VPS ${TITLE}...`);

    const releaseName = new Date().toISOString().replace(/[:.]/g, '-');
    const remoteCommands = `
        cd ${REMOTE_PATH} &&
        mkdir -p releases/${releaseName}/frontend/dist &&
        mkdir -p releases/${releaseName}/backend &&
        mkdir -p releases/${releaseName}/ai-service &&
        mkdir -p shared/uploads &&
        mkdir -p shared/ai_database/learning_data &&
        mkdir -p shared/ai_database/chats_data &&
        mkdir -p shared/ai_database/vector_store &&
        
        tar -xzf frontend.tar.gz -C releases/${releaseName}/frontend/dist &&
        tar -xzf backend.tar.gz -C releases/${releaseName}/backend &&
        tar -xzf ai-service.tar.gz -C releases/${releaseName}/ai-service &&
        
        # Backend setup
        cd releases/${releaseName}/backend &&
        npm install --omit=dev &&
        ln -sfn ${REMOTE_PATH}/shared/.env .env &&
        ln -sfn ${REMOTE_PATH}/shared/uploads uploads &&
        
        # AI Service setup
        cd ../ai-service &&
        [ -d venv ] || python3 -m venv venv &&
        ./venv/bin/pip install -r requirements.txt &&
        ln -sfn ${REMOTE_PATH}/shared/.env .env &&
        ln -sfn ${REMOTE_PATH}/shared/ai_database database &&
        
        cd ../../../ &&
        ln -sfn releases/${releaseName} current &&
        
        # Restart Backend
        pm2 delete ${PM2_NAME} || true &&
        pm2 start server.js --name ${PM2_NAME} --cwd ${REMOTE_PATH}/current/backend &&
        
        # Restart AI Service (with custom port)
        pm2 delete ${PM2_AI_NAME} || true &&
        PORT=${AI_PORT} pm2 start run.py --name ${PM2_AI_NAME} --interpreter ${REMOTE_PATH}/current/ai-service/venv/bin/python3 --cwd ${REMOTE_PATH}/current/ai-service &&
        
        # Cleanup
        rm ${REMOTE_PATH}/frontend.tar.gz ${REMOTE_PATH}/backend.tar.gz ${REMOTE_PATH}/ai-service.tar.gz &&
        pm2 save
    `;

    execSync(`ssh ${SERVER} "${remoteCommands}"`, { stdio: 'inherit' });

    // 6. Verification
    console.log('\n🔍 Verifying services...');
    setTimeout(() => {
        try {
            const status = execSync(`ssh ${SERVER} "pm2 status ${PM2_NAME} && pm2 status ${PM2_AI_NAME}"`).toString();
            console.log(status);
            console.log(`\n✅ ${TITLE} DEPLOYMENT SUCCESSFUL AND VERIFIED!`);
        } catch (e) {
            console.error(`\n⚠️ Verification showed issues, but deployment finished. Check pm2 logs.`);
        }
    }, 5000);

    // 7. Cleanup local archives
    console.log('🧹 Cleaning up local archives...');
    if (fs.existsSync('frontend.tar.gz')) fs.unlinkSync('frontend.tar.gz');
    if (fs.existsSync('backend.tar.gz')) fs.unlinkSync('backend.tar.gz');
    if (fs.existsSync('ai-service.tar.gz')) fs.unlinkSync('ai-service.tar.gz');

} catch (error) {
    console.error(`\n❌ ${TITLE} DEPLOYMENT FAILED:`, error.message);
    if (fs.existsSync('frontend.tar.gz')) fs.unlinkSync('frontend.tar.gz');
    if (fs.existsSync('backend.tar.gz')) fs.unlinkSync('backend.tar.gz');
    if (fs.existsSync('ai-service.tar.gz')) fs.unlinkSync('ai-service.tar.gz');
    process.exit(1);
}
