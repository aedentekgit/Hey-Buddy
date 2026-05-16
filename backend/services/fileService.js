const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs').promises;
const Settings = require('../models/Settings');
const { initFirebase } = require('./notificationService');

const axios = require('axios');
const FormData = require('form-data');

const uploadsRoot = path.resolve(__dirname, '..', 'uploads');

const resolveUploadPath = (relativePath) => {
    const cleaned = String(relativePath || '').replace(/^\/+/, '');
    const resolved = path.resolve(uploadsRoot, cleaned);
    if (!resolved.startsWith(uploadsRoot + path.sep) && resolved !== uploadsRoot) {
        throw new Error('Invalid upload path');
    }
    return resolved;
};

/**
 * Saves a file buffer locally to the server (or forwards to VPS if in local dev)
 */
const saveFileLocally = async (fileBuffer, destination) => {
    try {
        // If we are testing locally, forward the file to the active VPS
        if (process.env.NODE_ENV === 'development') {
            try {
                const form = new FormData();
                form.append('file', fileBuffer, { filename: path.basename(destination) });
                form.append('destination', destination);

                // We use a dedicated internal endpoint on staging to receive it
                const response = await axios.post(`https://staging.ayuskart.com/api/settings/internal-file-sync`, form, {
                    headers: {
                        ...form.getHeaders(),
                        'Authorization': `Bearer ${process.env.INTERNAL_SECRET || ''}`
                    }
                });
                if (response.data.success) {
                    console.log(`☁️ Synced ${destination} to VPS Staging!`);
                }
            } catch (syncError) {
                console.log(`⚠️ VPS Sync failed, falling back to local: ${syncError.message}`);
            }
        }

        const fullPath = resolveUploadPath(destination);
        const dir = path.dirname(fullPath);

        // Ensure directory exists
        await fs.mkdir(dir, { recursive: true });

        // Write file
        await fs.writeFile(fullPath, fileBuffer);

        // Return the relative URL path
        return `/uploads/${destination}`;
    } catch (error) {
        console.error("Local Save Error:", error);
        throw error;
    }
};

const getStorageBucket = async () => {
    try {
        const app = await initFirebase();
        const settings = await Settings.findOne();

        if (!settings || !settings.notification || !settings.notification.firebaseStorageBucket) {
            throw new Error("Firebase Storage Bucket not configured in settings");
        }

        return admin.storage().bucket(settings.notification.firebaseStorageBucket);
    } catch (error) {
        console.error("Firebase Storage Bucket Error:", error);
        throw error;
    }
};

/**
 * Uploads a file to Firebase Storage
 */
const uploadFileToFirebase = async (fileBuffer, destination, contentType) => {
    try {
        const bucket = await getStorageBucket();
        const file = bucket.file(destination);

        await file.save(fileBuffer, {
            metadata: { contentType },
            public: true
        });

        // Get public URL
        return `https://storage.googleapis.com/${bucket.name}/${destination}`;
    } catch (error) {
        console.error("Firebase Upload Error:", error);
        throw error;
    }
};

/**
 * Unified Upload Function
 * Checks settings for active provider and uploads accordingly
 */
const uploadFile = async (fileBuffer, destination, contentType) => {
    try {
        const settings = await Settings.findOne();
        const provider = settings?.storage?.activeProvider || 'local';

        if (provider === 'local') {
            return await saveFileLocally(fileBuffer, destination);
        } else if (provider === 'gcs' || provider === 'firebase') {
            return await uploadFileToFirebase(fileBuffer, destination, contentType);
        } else {
            // Default fallback to local for safety
            return await saveFileLocally(fileBuffer, destination);
        }
    } catch (error) {
        console.error("Unified Upload Error:", error);
        // Fallback to local if Firebase fails
        try {
            return await saveFileLocally(fileBuffer, destination);
        } catch (innerError) {
            throw error;
        }
    }
};

const deleteFileLocally = async (fileUrl) => {
    try {
        if (!fileUrl) return;

        // If we are testing locally, forward the deletion request to the active VPS
        if (process.env.NODE_ENV === 'development') {
            try {
                const response = await axios.delete(`https://staging.ayuskart.com/api/settings/internal-file-sync`, {
                    headers: {
                        'Authorization': `Bearer ${process.env.INTERNAL_SECRET || ''}`,
                        'Content-Type': 'application/json'
                    },
                    data: { fileUrl }
                });
                if (response.data.success) {
                    console.log(`☁️ Synced deletion of ${fileUrl} to VPS Staging!`);
                    return;
                }
            } catch (syncError) {
                console.log(`⚠️ VPS Sync Deletion failed, falling back to local: ${syncError.message}`);
                // Proceed to local deletion fallback
            }
        }

        if (fileUrl.startsWith('/uploads/')) {
            const relativePath = fileUrl.replace('/uploads/', '');
            const fullPath = resolveUploadPath(relativePath);
            try {
                await fs.unlink(fullPath);
                console.log(`🗑️ Deleted local file: ${fullPath}`);
            } catch (err) {
                console.log(`⚠️ Failed to delete local file or file not found: ${fullPath}`);
            }
        }
    } catch (error) {
        console.error("Local Delete Error:", error);
    }
};

const deleteFileFromFirebase = async (fileUrl) => {
    try {
        if (!fileUrl) return;

        // Example url: https://storage.googleapis.com/bucket-name/folder/file.ext
        const bucket = await getStorageBucket();
        const urlObj = new URL(fileUrl);
        const pathParts = urlObj.pathname.split('/');

        // Usually, the first part is empty, the second is bucket name, rest is file path
        if (pathParts.length > 2) {
            const destination = pathParts.slice(2).join('/');
            const file = bucket.file(destination);
            try {
                await file.delete();
                console.log(`🗑️ Deleted Firebase file: ${destination}`);
            } catch (err) {
                console.log(`⚠️ Failed to delete Firebase file (or not found): ${destination}`);
            }
        }
    } catch (error) {
        console.error("Firebase Delete Error:", error);
    }
};

const deleteFile = async (fileUrl) => {
    if (!fileUrl) return;

    try {
        const settings = await Settings.findOne();
        const provider = settings?.storage?.activeProvider || 'local';

        if (fileUrl.includes('storage.googleapis.com')) {
            return await deleteFileFromFirebase(fileUrl);
        } else {
            return await deleteFileLocally(fileUrl);
        }
    } catch (error) {
        console.error("Unified Delete Error:", error);
        // Fallback
        return await deleteFileLocally(fileUrl);
    }
};

module.exports = {
    uploadFile,
    deleteFile,
    uploadFileToFirebase,
    getStorageBucket,
    saveFileLocally,
    deleteFileLocally
};
