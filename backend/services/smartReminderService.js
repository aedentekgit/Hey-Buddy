const Reminder = require('../models/Reminder');
const User = require('../models/User');
const Guest = require('../models/Guest');
const { sendPushNotification } = require('./notificationService');
const Notification = require('../models/Notification');
const Settings = require('../models/Settings');
const axios = require('axios');
const { findAgentByUserId } = require('../sockets/voiceHandler');

/**
 * Smart Reminder Service
 * Handles AI-powered features: Early Warning, Traffic-Aware ETA, Item Exit Guards
 */

// Google Maps API key (should be in .env)
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}

/**
 * Geocode an address string to coordinates
 * @param {string} address - Address or location name
 * @param {object} biasLocation - Optional {lat, lng} to bias search results
 * @returns {Promise<object|null>} {lat, lng} or null
 */
async function geocodeAddress(address, biasLocation = null) {
    if (!address) return null;

    let apiKey = GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
        const settings = await Settings.findOne().select('+googleMaps.apiKey');
        if (settings?.googleMaps?.apiKey) {
            apiKey = settings.googleMaps.apiKey;
        }
    }

    if (!apiKey) return null;

    try {
        let enhancedAddress = address;

        // Force local context by reverse-geocoding the bias location to get the user's city
        if (biasLocation?.lat && biasLocation?.lng) {
            try {
                const reverseUrl = `https://maps.googleapis.com/maps/api/geocode/json`;
                const reverseRes = await axios.get(reverseUrl, {
                    params: { latlng: `${biasLocation.lat},${biasLocation.lng}`, key: apiKey }
                });

                if (reverseRes.data.status === 'OK' && reverseRes.data.results.length > 0) {
                    let cityName = '';
                    for (const res of reverseRes.data.results) {
                        const locality = res.address_components.find(c => c.types.includes('locality') || c.types.includes('administrative_area_level_2'));
                        if (locality) {
                            cityName = locality.long_name;
                            break;
                        }
                    }
                    if (cityName && !enhancedAddress.toLowerCase().includes(cityName.toLowerCase())) {
                        enhancedAddress = `${enhancedAddress}, ${cityName}`;
                        console.log(`[Geocode] City identified: ${cityName}. Enhanced search to: "${enhancedAddress}"`);
                    }
                }
            } catch (err) {
                console.error('[Geocode] Reverse geocoding failed:', err.message);
            }
        }

        const url = `https://maps.googleapis.com/maps/api/geocode/json`;
        console.log(`[Geocode] Requesting: ${enhancedAddress}`);
        const params = {
            address: enhancedAddress,
            key: apiKey,
            region: 'in' // Bias towards India
        };

        // Add bounding box bias (roughly 50km radius)
        if (biasLocation?.lat && biasLocation?.lng) {
            const lat = Number(biasLocation.lat);
            const lng = Number(biasLocation.lng);
            if (!isNaN(lat) && !isNaN(lng)) {
                params.bounds = `${lat - 0.5},${lng - 0.5}|${lat + 0.5},${lng + 0.5}`;
            }
        }

        const response = await axios.get(url, { params });

        if (response.data.status === 'OK' && response.data.results.length > 0) {
            const loc = response.data.results[0].geometry.location;
            console.log(`[Geocode] Success: ${loc.lat}, ${loc.lng}`);
            return loc;
        } else {
            console.warn(`[Geocode] Google API returned status: ${response.data.status}`);
            if (response.data.error_message) {
                console.error(`[Geocode] Error Message: ${response.data.error_message}`);
            }
        }
        return null;
    } catch (error) {
        console.error('[Geocode] Axios Error:', error.message);
        return null;
    }
}

/**
 * Get traffic-aware travel time from Google Maps Distance Matrix API
 * @param {object} origin - {lat, lng}
 * @param {object} destination - {lat, lng}
 * @returns {Promise<object>} {duration: seconds, durationInTraffic: seconds, distance: meters}
 */
async function getTrafficAwareTravelTime(origin, destination) {
    let apiKey = GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
        const settings = await Settings.findOne().select('+googleMaps.apiKey');
        if (settings?.googleMaps?.enabled && settings?.googleMaps?.apiKey) {
            apiKey = settings.googleMaps.apiKey;
        }
    }

    if (!apiKey) {
        console.warn('Google Maps API key not configured. Using fallback calculation.');
        // Fallback: estimate based on distance (assuming 40 km/h average speed)
        const distance = calculateDistance(origin.lat, origin.lng, destination.lat, destination.lng);
        const estimatedDuration = (distance / 1000) / 40 * 3600; // seconds
        return {
            duration: estimatedDuration,
            durationInTraffic: estimatedDuration,
            distance: distance
        };
    }

    try {
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json`;
        const response = await axios.get(url, {
            params: {
                origins: `${origin.lat},${origin.lng}`,
                destinations: `${destination.lat},${destination.lng}`,
                departure_time: 'now',
                traffic_model: 'best_guess',
                key: apiKey
            }
        });

        if (response.data.status === 'OK' && response.data.rows[0].elements[0].status === 'OK') {
            const element = response.data.rows[0].elements[0];
            return {
                duration: element.duration.value, // seconds
                durationInTraffic: element.duration_in_traffic?.value || element.duration.value,
                distance: element.distance.value // meters
            };
        } else {
            throw new Error('Google Maps API returned non-OK status');
        }
    } catch (error) {
        console.error('Error fetching traffic data:', error.message);
        // Fallback calculation
        const distance = calculateDistance(origin.lat, origin.lng, destination.lat, destination.lng);
        const estimatedDuration = (distance / 1000) / 40 * 3600;
        return {
            duration: estimatedDuration,
            durationInTraffic: estimatedDuration,
            distance: distance
        };
    }
}

/**
 * Early Warning System
 * Checks if user is at risk of being late and sends proactive alerts
 */
async function checkEarlyWarnings(io) {
    try {
        const now = new Date();
        const currentTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); // HH:MM
        const currentDate = now.toLocaleDateString('en-CA'); // YYYY-MM-DD

        // Find reminders with early warning enabled, scheduled for today/future from BOTH collections
        const [remindersStd, remindersLoc] = await Promise.all([
            Reminder.find({
                'smartFeatures.earlyWarning': true,
                status: 'pending',
                location: { $ne: null },
                'coordinates.lat': { $exists: true },
                'coordinates.lng': { $exists: true }
            }).populate('userId', 'name email fcmTokens currentLocation timezone notificationPreferences voicePreferences'),
            require('../models/LocationReminder').find({
                earlyWarningSet: true,
                status: 'on_track',
                location: { $ne: null },
                'coordinates.lat': { $exists: true },
                'coordinates.lng': { $exists: true }
            }).populate('userId', 'name email fcmTokens currentLocation timezone notificationPreferences voicePreferences')
        ]);

        const allReminders = [
            ...remindersStd.map(r => ({ ...r.toObject(), _model: 'Reminder' })),
            ...remindersLoc.map(r => ({ ...r.toObject(), _model: 'LocationReminder' }))
        ];

        for (const reminderData of allReminders) {
            const reminder = reminderData;
            let user = reminder.userId;

            if (!user || typeof user === "string") {
                const userIdStr = typeof user === "string" ? user : (reminder.userId ? reminder.userId.toString() : "");
                if (userIdStr.startsWith("guest_")) {
                    const guestData = await Guest.findById(userIdStr);
                    user = {
                        _id: userIdStr,
                        name: "Guest User",
                        email: "guest@buddy.internal",
                        timezone: "UTC",
                        fcmTokens: guestData ? guestData.fcmTokens : [],
                        currentLocation: guestData ? guestData.currentLocation : null,
                        previousLocation: guestData ? guestData.previousLocation : null,
                        notificationPreferences: { voice: { enabled: true }, push: { enabled: true } },
                        voicePreferences: { gender: "female", tone: "soft" }
                    };
                } else {
                    continue;
                }
            }

            const userTimezone = user.timezone || 'UTC';
            const now = new Date();
            const currentDate = now.toLocaleDateString('en-CA', { timeZone: userTimezone }); // YYYY-MM-DD

            // Filter for reminders due today or later in user's timezone
            if (reminder.date < currentDate) continue;

            // Skip if no user location available
            if (!user.currentLocation?.lat || !user.currentLocation?.lng) {
                continue;
            }

            // Parse reminder time (handle HH:mm and HH:mm AM/PM)
            let reminderHour, reminderMin;
            const timeStr = reminder.time || '00:00';
            const ampmMatch = timeStr.match(/(\d+):(\d+)\s*(am|pm)/i);

            if (ampmMatch) {
                reminderHour = parseInt(ampmMatch[1]);
                reminderMin = parseInt(ampmMatch[2]);
                const period = ampmMatch[3].toLowerCase();
                if (period === 'pm' && reminderHour < 12) reminderHour += 12;
                if (period === 'am' && reminderHour === 12) reminderHour = 0;
            } else {
                [reminderHour, reminderMin] = timeStr.split(':').map(Number);
            }

            const reminderDateTime = new Date(reminder.date);
            reminderDateTime.setHours(reminderHour, reminderMin, 0, 0);

            // Calculate time until reminder (using relative comparison is okay as Date objects are absolute)
            const timeUntilReminder = (reminderDateTime - now) / 1000; // seconds

            // Only check if reminder is within the next 4 hours
            if (timeUntilReminder < 0 || timeUntilReminder > 14400) {
                continue;
            }

            // Get traffic-aware travel time
            const travelInfo = await getTrafficAwareTravelTime(
                user.currentLocation,
                reminder.coordinates
            );

            const bufferTime = (reminder.bufferTime || 15) * 60; // Convert to seconds
            const requiredTime = travelInfo.durationInTraffic + bufferTime;

            // Check if user needs to leave soon
            const timeToLeave = timeUntilReminder - requiredTime;

            // Check if already notified for early warning
            const alreadyNotifiedEW = reminder.timeline?.some(t => t.action === 'Early Warning Alert');

            // Send early warning if user needs to leave within 30 minutes
            if (!alreadyNotifiedEW && timeToLeave > 0 && timeToLeave <= 1800) {
                const minutesToLeave = Math.ceil(timeToLeave / 60);
                const travelMinutes = Math.ceil(travelInfo.durationInTraffic / 60);

                const message = `⚠️ Early Warning: You should leave in ${minutesToLeave} minutes for "${reminder.title}". Current travel time: ${travelMinutes} min (with traffic).`;

                // Create notification
                await Notification.create({
                    userId: user._id,
                    title: '🚨 Early Warning Alert',
                    message: message,
                    type: 'reminder',
                    relatedId: reminder._id,
                    onModel: 'Reminder',
                    actionUrl: '/admin/reminders'
                });

                // Send push notification
                if (user.fcmTokens && user.fcmTokens.length > 0) {
                    const pushPromises = user.fcmTokens.map(token =>
                        sendPushNotification(token, '🚨 Early Warning Alert', message, {
                            type: 'early_warning',
                            reminderId: reminder._id.toString()
                        }).catch(err => console.error('Push notification failed:', err.message))
                    );
                    await Promise.all(pushPromises);
                }

                // AI Voice Announcement
                if (user.notificationPreferences?.voice?.enabled !== false) {
                    const voiceMsg = `This is an Early Warning. You should leave in ${minutesToLeave} minutes for "${reminder.title}".`;
                    if (io) {
                        io.to(user._id.toString()).emit('voice_alert', {
                            text: voiceMsg,
                            gender: user.voicePreferences?.gender || 'female',
                            tone: user.voicePreferences?.tone || 'soft'
                        });
                    }
                }

                // Add to timeline to prevent duplicate
                const Model = reminder._model === 'LocationReminder' ? require('../models/LocationReminder') : Reminder;
                await Model.findByIdAndUpdate(reminder._id, {
                    $push: {
                        timeline: {
                            action: 'Early Warning Alert',
                            timestamp: new Date(),
                            icon: 'bell'
                        }
                    }
                });

                console.log(`Early warning sent for reminder: ${reminder.title}`);
            }
        }
    } catch (error) {
        console.error('Error in checkEarlyWarnings:', error);
    }
}

/**
 * Traffic-Aware ETA Adjustment
 * Dynamically adjusts reminder notification times based on real-time traffic
 */
async function adjustReminderTimesForTraffic(io) {
    try {
        const [remindersStd, remindersLoc] = await Promise.all([
            Reminder.find({
                'smartFeatures.trafficAware': true,
                status: 'pending',
                location: { $ne: null },
                'coordinates.lat': { $exists: true },
                'coordinates.lng': { $exists: true }
            }).populate('userId', 'name email fcmTokens currentLocation timezone notificationPreferences voicePreferences'),
            require('../models/LocationReminder').find({
                trafficAware: true,
                status: 'on_track',
                location: { $ne: null },
                'coordinates.lat': { $exists: true },
                'coordinates.lng': { $exists: true }
            }).populate('userId', 'name email fcmTokens currentLocation timezone notificationPreferences voicePreferences')
        ]);

        const allReminders = [
            ...remindersStd.map(r => ({ ...r.toObject(), _model: 'Reminder' })),
            ...remindersLoc.map(r => ({ ...r.toObject(), _model: 'LocationReminder' }))
        ];

        for (const reminderData of allReminders) {
            const reminder = reminderData;
            let user = reminder.userId;

            if (!user || typeof user === "string") {
                const userIdStr = typeof user === "string" ? user : (reminder.userId ? reminder.userId.toString() : "");
                if (userIdStr.startsWith("guest_")) {
                    const guestData = await Guest.findById(userIdStr);
                    user = {
                        _id: userIdStr,
                        name: "Guest User",
                        email: "guest@buddy.internal",
                        timezone: "UTC",
                        fcmTokens: guestData ? guestData.fcmTokens : [],
                        currentLocation: guestData ? guestData.currentLocation : null,
                        previousLocation: guestData ? guestData.previousLocation : null,
                        notificationPreferences: { voice: { enabled: true }, push: { enabled: true } },
                        voicePreferences: { gender: "female", tone: "soft" }
                    };
                } else {
                    continue;
                }
            }

            const userTimezone = user.timezone || 'UTC';
            const now = new Date();
            const currentDate = now.toLocaleDateString('en-CA', { timeZone: userTimezone });

            if (reminder.date < currentDate) continue;

            if (!user.currentLocation?.lat || !user.currentLocation?.lng) {
                continue;
            }

            // Parse reminder time
            let reminderHour, reminderMin;
            const timeStr = reminder.time || '00:00';
            const ampmMatch = timeStr.match(/(\d+):(\d+)\s*(am|pm)/i);

            if (ampmMatch) {
                reminderHour = parseInt(ampmMatch[1]);
                reminderMin = parseInt(ampmMatch[2]);
                const period = ampmMatch[3].toLowerCase();
                if (period === 'pm' && reminderHour < 12) reminderHour += 12;
                if (period === 'am' && reminderHour === 12) reminderHour = 0;
            } else {
                const parts = timeStr.split(':');
                reminderHour = parseInt(parts[0]);
                reminderMin = parseInt(parts[1]);
            }

            const reminderDateTime = new Date(reminder.date);
            reminderDateTime.setHours(reminderHour, reminderMin, 0, 0);

            // Only process reminders within next 6 hours
            const timeUntilReminder = (reminderDateTime - now) / 1000;
            if (timeUntilReminder < 0 || timeUntilReminder > 21600) {
                continue;
            }

            // Get current traffic conditions
            const travelInfo = await getTrafficAwareTravelTime(
                user.currentLocation,
                reminder.coordinates
            );

            // Calculate if traffic is significantly worse than normal
            const trafficDelay = travelInfo.durationInTraffic - travelInfo.duration;
            const delayMinutes = Math.ceil(trafficDelay / 60);

            // Check if already notified for traffic alert
            const alreadyNotifiedTraffic = reminder.timeline?.some(t => t.action === 'Traffic Alert');

            // If traffic delay is more than 10 minutes, send alert
            if (!alreadyNotifiedTraffic && delayMinutes >= 10) {
                const message = `🚦 Traffic Alert: Heavy traffic detected for "${reminder.title}". Current delay: +${delayMinutes} min. Consider leaving earlier!`;

                await Notification.create({
                    userId: user._id,
                    title: '🚦 Traffic Update',
                    message: message,
                    type: 'reminder',
                    relatedId: reminder._id,
                    onModel: 'Reminder',
                    actionUrl: '/admin/reminders'
                });

                if (user.fcmTokens && user.fcmTokens.length > 0) {
                    const pushPromises = user.fcmTokens.map(token =>
                        sendPushNotification(token, '🚦 Traffic Update', message, {
                            type: 'traffic_alert',
                            reminderId: reminder._id.toString()
                        }).catch(err => console.error('Push failed:', err.message))
                    );
                    await Promise.all(pushPromises);
                }

                // AI Voice Announcement
                if (user.notificationPreferences?.voice?.enabled !== false) {
                    const voiceMsg = `Traffic Alert: Heavy traffic detected for "${reminder.title}". Current delay is +${delayMinutes} minutes. Consider leaving earlier!`;
                    if (io) {
                        io.to(user._id.toString()).emit('voice_alert', {
                            text: voiceMsg,
                            gender: user.voicePreferences?.gender || 'female',
                            tone: user.voicePreferences?.tone || 'soft'
                        });
                    }
                }

                // Add to timeline to prevent duplicate
                const Model = reminder._model === 'LocationReminder' ? require('../models/LocationReminder') : Reminder;
                await Model.findByIdAndUpdate(reminder._id, {
                    $push: {
                        timeline: {
                            action: 'Traffic Alert',
                            timestamp: new Date(),
                            icon: 'alert-triangle'
                        }
                    }
                });

                console.log(`Traffic alert sent for reminder: ${reminder.title}`);
            }
        }
    } catch (error) {
        console.error('Error in adjustReminderTimesForTraffic:', error);
    }
}

/**
 * Item Exit Guards
 * Reminders users about items they need to bring when leaving a location
 * @param {string} specificUserId - Optional userId to check only for one user
 */
async function checkItemExitGuards(specificUserId = null, io) {
    try {
        const query = {
            'smartFeatures.itemExitGuards': true,
            status: 'pending',
            location: { $ne: null },
            'coordinates.lat': { $exists: true },
            'coordinates.lng': { $exists: true }
        };

        if (specificUserId) {
            query.userId = specificUserId;
        }

        const [remindersStd, remindersLoc] = await Promise.all([
            Reminder.find(query).populate('userId', 'name email fcmTokens currentLocation previousLocation timezone notificationPreferences voicePreferences'),
            require('../models/LocationReminder').find({
                itemExitGuards: true,
                status: 'on_track',
                location: { $ne: null },
                'coordinates.lat': { $exists: true },
                'coordinates.lng': { $exists: true }
            }).populate('userId', 'name email fcmTokens currentLocation previousLocation timezone notificationPreferences voicePreferences')
        ]);

        const allReminders = [
            ...remindersStd.map(r => ({ ...r.toObject(), _model: 'Reminder' })),
            ...remindersLoc.map(r => ({ ...r.toObject(), _model: 'LocationReminder' }))
        ];

        for (const reminderData of allReminders) {
            const reminder = reminderData;
            let user = reminder.userId;

            if (!user || typeof user === "string") {
                const userIdStr = typeof user === "string" ? user : (reminder.userId ? reminder.userId.toString() : "");
                if (userIdStr.startsWith("guest_")) {
                    const guestData = await Guest.findById(userIdStr);
                    user = {
                        _id: userIdStr,
                        name: "Guest User",
                        email: "guest@buddy.internal",
                        timezone: "UTC",
                        fcmTokens: guestData ? guestData.fcmTokens : [],
                        currentLocation: guestData ? guestData.currentLocation : null,
                        previousLocation: guestData ? guestData.previousLocation : null,
                        notificationPreferences: { voice: { enabled: true }, push: { enabled: true } },
                        voicePreferences: { gender: "female", tone: "soft" }
                    };
                } else {
                    continue;
                }
            }

            // Check if user has location data
            if (!user.currentLocation?.lat || !user.previousLocation?.lat) {
                continue;
            }

            // Calculate if user is leaving the reminder location
            const distanceFromReminder = calculateDistance(
                user.currentLocation.lat,
                user.currentLocation.lng,
                reminder.coordinates.lat,
                reminder.coordinates.lng
            );

            const previousDistanceFromReminder = user.previousLocation?.lat ? calculateDistance(
                user.previousLocation.lat,
                user.previousLocation.lng,
                reminder.coordinates.lat,
                reminder.coordinates.lng
            ) : null;

            // Check if already notified specifically for this exit event
            const alreadyNotifiedExit = reminder.timeline?.some(t => t.action === 'Exit Guard Alert');

            const radius = reminder.geofenceRadius || 500;
            const isNowFarAway = distanceFromReminder > radius;

            // Logic A: Standard Exit (Was nearby, now moved away)
            const wasNearby = previousDistanceFromReminder !== null && previousDistanceFromReminder <= radius;
            const isMovingAway = previousDistanceFromReminder !== null && distanceFromReminder > previousDistanceFromReminder;
            const standardExit = wasNearby && isMovingAway && isNowFarAway;

            // Logic B: Immediate Alert (If turned on while already outside and never notified)
            const immediateAlertNeeded = isNowFarAway && !alreadyNotifiedExit;

            if (standardExit || immediateAlertNeeded) {
                const notesPart = reminder.notes ? `\nNote: ${reminder.notes}` : '';
                const message = `Don't forget: "${reminder.title}" - Make sure you have everything you need!${notesPart}`;

                // 1. Create Internal Notification
                await Notification.create({
                    userId: user._id,
                    title: 'Reminder Alert',
                    message: message,
                    type: 'reminder',
                    relatedId: reminder._id,
                    onModel: 'Reminder',
                    actionUrl: '/admin/reminders'
                });

                // 2. Add to Reminder Timeline to prevent double-alerting
                const Model = reminder._model === 'LocationReminder' ? require('../models/LocationReminder') : Reminder;
                await Model.findByIdAndUpdate(reminder._id, {
                    $push: {
                        timeline: {
                            action: 'Exit Guard Alert',
                            timestamp: new Date(),
                            icon: 'zap'
                        }
                    }
                });

                // 3. Send Push Notification
                if (user.fcmTokens && user.fcmTokens.length > 0) {
                    const pushPromises = user.fcmTokens.map(token =>
                        sendPushNotification(token, 'Reminder Alert', message, {
                            type: 'exit_guard',
                            reminderId: reminder._id.toString()
                        }).catch(err => console.error('Push failed:', err.message))
                    );
                    await Promise.all(pushPromises);
                }

                // AI Voice Announcement
                if (user.notificationPreferences?.voice?.enabled !== false) {
                    const voiceMsg = `Don't forget: "${reminder.title}" - Make sure you have everything you need!`;
                    if (io) {
                        io.to(user._id.toString()).emit('voice_alert', {
                            text: voiceMsg,
                            gender: user.voicePreferences?.gender || 'female',
                            tone: user.voicePreferences?.tone || 'soft'
                        });
                    }
                }

                console.log(`Exit guard triggered for user ${user.email} (Type: ${immediateAlertNeeded ? 'Immediate' : 'Standard'})`);
            }
        }
    } catch (error) {
        console.error('Error in checkItemExitGuards:', error);
    }
}

/**
 * Main function to run all smart reminder checks
 * Should be called periodically (e.g., every 5 minutes)
 */
async function runSmartReminderChecks(io) {
    console.log('Running smart reminder checks...');
    await Promise.all([
        checkEarlyWarnings(io),
        adjustReminderTimesForTraffic(io),
        checkItemExitGuards(null, io)
    ]);
    console.log('Smart reminder checks completed.');
}

module.exports = {
    runSmartReminderChecks,
    checkEarlyWarnings,
    adjustReminderTimesForTraffic,
    checkItemExitGuards,
    getTrafficAwareTravelTime,
    geocodeAddress,
    calculateDistance
};
