const User = require('../models/User');
const paginate = require('../utils/paginate');
const fs = require('fs');
const path = require('path');
const { uploadFileToFirebase } = require('../services/fileService');

// Get all users
const getUsers = async (req, res) => {
    try {
        const query = {};
        if (req.query.role) {
            if (req.query.role === '!user') {
                query.role = { $ne: 'user' };
            } else {
                query.role = req.query.role;
            }
        }
        const results = await paginate(User, query, req.query);
        // Remove passwords from results
        results.data = results.data.map(u => {
            const user = u.toObject();
            delete user.password;
            return user;
        });
        res.json({ success: true, ...results });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Create user
const createUser = async (req, res) => {
    try {
        const { name, email, password, phone, role } = req.body;
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }
        const user = await User.create({ name, email, password, phone, role });
        const userResponse = user.toObject();
        delete userResponse.password;
        res.status(201).json({ success: true, data: userResponse });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update user
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, phone, role, password } = req.body;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        user.name = name || user.name;
        user.email = email || user.email;
        user.phone = phone || user.phone;
        user.role = role || user.role;
        user.timezone = req.body.timezone || user.timezone;


        if (password) {
            user.password = password;
        }

        if (req.body.voicePreferences) {
            user.voicePreferences = {
                ...user.voicePreferences,
                ...req.body.voicePreferences
            };
        }

        if (req.body.notificationPreferences) {
            user.notificationPreferences = {
                ...user.notificationPreferences,
                ...req.body.notificationPreferences
            };
        }

        await user.save();
        const userResponse = user.toObject();
        delete userResponse.password;
        res.json({ success: true, data: userResponse });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete user
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findByIdAndDelete(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Save FCM token
const saveFcmToken = async (req, res) => {
    try {
        const userId = req.user._id;
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ success: false, message: 'Token is required' });
        }

        await User.findByIdAndUpdate(userId, {
            $addToSet: { fcmTokens: token }
        });

        res.json({ success: true, message: 'Token saved' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateProfile = async (req, res) => {
    try {
        const userId = req.user._id;
        const { name, phone, address, timezone } = req.body;

        console.log('[UserController] Updating profile for user:', userId);
        console.log('[UserController] Received update data:', req.body);

        const user = await User.findById(userId);
        if (!user) {
            console.error('[UserController] User not found during update:', userId);
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Apply updates
        if (name !== undefined) user.name = name;
        if (phone !== undefined) user.phone = phone;
        if (address !== undefined) user.address = address;
        if (timezone !== undefined) user.timezone = timezone;
        if (req.body.dateFormat !== undefined) user.dateFormat = req.body.dateFormat;
        if (req.body.timeFormat !== undefined) user.timeFormat = req.body.timeFormat;

        // Defensive fix for corrupted fcmTokens that blocks validation
        if (user.fcmTokens && Array.isArray(user.fcmTokens)) {
            const corrupted = user.fcmTokens.some(t => typeof t === 'string' && t.includes('[\\n') && t.includes('token:'));
            if (corrupted) {
                user.fcmTokens = user.fcmTokens.filter(t => typeof t === 'string' && !t.includes('[\\n'));
            }
        }

        // Preferences updates
        if (req.body.voicePreferences) {
            user.voicePreferences = {
                ...user.voicePreferences,
                ...req.body.voicePreferences
            };
        }

        if (req.body.notificationPreferences) {
            user.notificationPreferences = {
                ...user.notificationPreferences,
                ...req.body.notificationPreferences
            };
        }

        await user.save();
        const userResponse = user.toObject();
        delete userResponse.password;

        console.log('[UserController] Profile updated successfully for:', user.email);
        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: userResponse
        });
    } catch (error) {
        console.error('[UserController] Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile: ' + error.message
        });
    }
};

const deleteMyAccount = async (req, res) => {
    try {
        const userId = req.user._id;
        console.log('[UserController] Deleting account for user:', userId);

        const user = await User.findByIdAndDelete(userId);
        if (!user) {
            console.error('[UserController] User not found for deletion:', userId);
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        console.log('[UserController] Account deleted successfully:', userId);
        res.json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
        console.error('[UserController] Delete account error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const unlinkCalendar = async (req, res) => {
    try {
        const userId = req.user._id;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        user.googleRefreshToken = null;
        await user.save();

        res.json({ success: true, message: 'Google Calendar unlinked successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update user location for smart reminder features
const updateLocation = async (req, res) => {
    try {
        const { lat, lng } = req.body;
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Move current location to previous location
        if (user.currentLocation) {
            user.previousLocation = {
                lat: user.currentLocation.lat,
                lng: user.currentLocation.lng,
                timestamp: user.currentLocation.timestamp
            };
        }

        // Update current location
        user.currentLocation = {
            lat,
            lng,
            timestamp: new Date()
        };

        await user.save();

        res.json({ success: true, message: 'Location updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
const { uploadFile } = require('../services/fileService');

// ... (existing code)

// ... (existing code)

// Upload Profile Picture (Self)
const uploadProfilePicture = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const userId = req.user._id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Upload using unified service (respects activeProvider)
        const destination = `profiles/${userId}-${Date.now()}${path.extname(req.file.originalname)}`;
        const publicUrl = await uploadFile(req.file.buffer, destination, req.file.mimetype);

        // Update user profile
        user.profilePicture = publicUrl;
        await user.save();

        res.json({
            success: true,
            message: 'Profile picture updated',
            data: { profilePicture: publicUrl }
        });
    } catch (error) {
        console.error('Profile upload error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin: Upload Profile Picture for any user
const adminUploadProfilePicture = async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const destination = `profiles/${id}-${Date.now()}${path.extname(req.file.originalname)}`;
        const publicUrl = await uploadFile(req.file.buffer, destination, req.file.mimetype);

        user.profilePicture = publicUrl;
        await user.save();

        res.json({
            success: true,
            message: 'Profile picture updated by admin',
            data: { profilePicture: publicUrl }
        });
    } catch (error) {
        console.error('Admin profile upload error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin: Delete Profile Picture for any user
const adminDeleteProfilePicture = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        user.profilePicture = undefined;
        await user.save();

        res.json({ success: true, message: 'Profile picture removed by admin' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete Profile Picture
const deleteProfilePicture = async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.profilePicture) {
            user.profilePicture = null;
            await user.save();
        }

        res.json({ success: true, message: 'Profile picture removed' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const reverseGeocode = async (req, res) => {
    try {
        const { lat, lon } = req.query;
        if (!lat || !lon) {
            return res.status(400).json({ success: false, message: 'Latitude and Longitude are required' });
        }

        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, {
            headers: {
                'User-Agent': 'HeyBuddy-Health-Assistant/1.0'
            }
        });
        const data = await response.json();
        res.json({ success: true, data });
    } catch (error) {
        console.error('Geocoding error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch location data' });
    }
};

module.exports = {
    getUsers,
    createUser,
    updateUser,
    deleteUser,
    saveFcmToken,
    updateProfile,
    deleteMyAccount,
    unlinkCalendar,
    updateLocation,
    uploadProfilePicture,
    deleteProfilePicture,
    adminUploadProfilePicture,
    adminDeleteProfilePicture,
    reverseGeocode
};
