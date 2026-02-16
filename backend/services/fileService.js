const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs').promises;
const Settings = require('../models/Settings');
const { initFirebase } = require('./notificationService');

/**
 * Saves a file buffer locally to the server
 */
const saveFileLocally = async (fileBuffer, destination) => {
    try {
        const fullPath = path.join(__dirname, '..', 'uploads', destination);
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

module.exports = {
    uploadFile,
    uploadFileToFirebase,
    getStorageBucket,
    saveFileLocally
};
