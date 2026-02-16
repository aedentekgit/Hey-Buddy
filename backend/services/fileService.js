const admin = require('firebase-admin');
const path = require('path');
const Settings = require('../models/Settings');
const { initFirebase } = require('./notificationService');

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
 * @param {Buffer} fileBuffer - The file content
 * @param {string} destination - Path in the storage bucket (e.g., 'profiles/userid.png')
 * @param {string} contentType - Mime type of the file
 * @returns {Promise<string>} - The public URL of the uploaded file
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

module.exports = {
    uploadFileToFirebase,
    getStorageBucket
};
