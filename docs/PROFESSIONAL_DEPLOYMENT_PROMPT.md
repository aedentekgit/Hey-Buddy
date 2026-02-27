# Professional MERN Deployment Prompt

## **Objective**
I have a MERN stack application (React/Vite Frontend + Node.js/Express Backend + MongoDB). I need you to set up a professional, production-grade deployment infrastructure on my VPS (Ubuntu) with fully isolated **Staging** and **Production** environments.

## **Key Requirements**

### 1. Dual Environment Structure
*   Create two separate environments on the VPS: `staging` and `production`.
*   **Directory Structure**:
    *   `/var/www/project/staging` (Staging App Code)
    *   `/var/www/project/production` (Production App Code)
    *   `/var/www/project/shared` (Shared assets like uploads/logs)
*   **Isolation**: Ensure Staging code/data never touches Production code/data.

### 2. Zero-Downtime Deployment Script
*   Write a Node.js deployment script (e.g., `deploy-vps.js`) that runs from my local machine.
*   It should use **SSH/SFTP** to upload code (no Git pulling on server).
*   Implement **Atomic Deployments**:
    1.  Upload code to a timestamped release folder (e.g., `releases/2026-01-01-103000`).
    2.  Run `npm install` and build steps inside that isolated folder.
    3.  Update a symbolic link (`current`) to point to the new folder.
    4.  Restart the PM2 process.
*   This ensures zero downtime: users keep using the old version until the new one is 100% ready and switched instantly.
*   Support arguments: `node deploy-vps.js staging` and `node deploy-vps.js production`.

### 3. Database & Asset Separation
*   **Database**: Set up two separate MongoDB databases:
    *   `project_prod` (Live Data)
    *   `project_staging` (Test Data)
*   **Uploads**: Configure specific storage paths so uploaded images are isolated:
    *   Production: `/var/www/project/shared/production/uploads`
    *   Staging: `/var/www/project/shared/staging/uploads`
*   **Env Vars**: Ensure `.env` files on the VPS point to the correct DB and upload paths for each environment side-by-side.

### 4. Nginx & Domain Configuration
*   Configure Nginx as a reverse proxy with two server blocks.
*   **Production**:
    *   Domain: `mydomain.com`
    *   Proxy Pass: `http://localhost:8080` (Production Backend Port)
*   **Staging**:
    *   Domain: `staging.mydomain.com`
    *   Proxy Pass: `http://localhost:8081` (Staging Backend Port)
*   Set up SSL certificates (Let's Encrypt/Certbot) for both domains securely.

### 5. Local Development Setup
*   Configure my local `.env` (development mode) so that `localhost` connects to the **Staging** database and **Staging** uploads folder.
*   **Benefit**: I can develop locally using real-world test data and images without risking the Production database.

### 6. Workflow Goal
*   **Step 1**: I build and deploy to Staging (`node deploy-vps.js staging`).
*   **Step 2**: I verify changes on `staging.mydomain.com`.
*   **Step 3**: I deploy to Production (`node deploy-vps.js production`) with confidence.

## **Current Tech Stack**
*   **Frontend**: React (Vite)
*   **Backend**: Node.js (Express)
*   **Database**: MongoDB
*   **Server**: Ubuntu VPS (Hostinger/DigitalOcean/AWS)
*   **Process Manager**: PM2
