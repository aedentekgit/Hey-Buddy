const Reminder = require('../models/Reminder');
const User = require('../models/User');
const { sendPushNotification } = require('./notificationService');
const Notification = require('../models/Notification');
const axios = require('axios');

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
 * Get traffic-aware travel time from Google Maps Distance Matrix API
 * @param {object} origin - {lat, lng}
 * @param {object} destination - {lat, lng}
 * @returns {Promise<object>} {duration: seconds, durationInTraffic: seconds, distance: meters}
 */
async function getTrafficAwareTravelTime(origin, destination) {
    if (!GOOGLE_MAPS_API_KEY) {
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
                key: GOOGLE_MAPS_API_KEY
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
async function checkEarlyWarnings() {
    try {
        const now = new Date();
        const currentTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); // HH:MM
        const currentDate = now.toLocaleDateString('en-CA'); // YYYY-MM-DD

        // Find reminders with early warning enabled, scheduled for today/future
        const reminders = await Reminder.find({
            'smartFeatures.earlyWarning': true,
            status: 'pending',
            location: { $ne: null },
            'coordinates.lat': { $exists: true },
            'coordinates.lng': { $exists: true }
        }).populate('userId', 'name email fcmTokens currentLocation timezone');

        for (const reminder of reminders) {
            const user = reminder.userId;
            if (!user) continue;

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

            // Send early warning if user needs to leave within 30 minutes
            if (timeToLeave > 0 && timeToLeave <= 1800) {
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
async function adjustReminderTimesForTraffic() {
    try {
        const reminders = await Reminder.find({
            'smartFeatures.trafficAware': true,
            status: 'pending',
            location: { $ne: null },
            'coordinates.lat': { $exists: true },
            'coordinates.lng': { $exists: true }
        }).populate('userId', 'name email fcmTokens currentLocation timezone');

        for (const reminder of reminders) {
            const user = reminder.userId;
            if (!user) continue;

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
                reminder.userId.currentLocation,
                reminder.coordinates
            );

            // Calculate if traffic is significantly worse than normal
            const trafficDelay = travelInfo.durationInTraffic - travelInfo.duration;
            const delayMinutes = Math.ceil(trafficDelay / 60);

            // If traffic delay is more than 10 minutes, send alert
            if (delayMinutes >= 10) {
                const message = `🚦 Traffic Alert: Heavy traffic detected for "${reminder.title}". Current delay: +${delayMinutes} min. Consider leaving earlier!`;

                await Notification.create({
                    userId: reminder.userId._id,
                    title: '🚦 Traffic Update',
                    message: message,
                    type: 'reminder',
                    relatedId: reminder._id,
                    onModel: 'Reminder',
                    actionUrl: '/admin/reminders'
                });

                if (reminder.userId.fcmTokens && reminder.userId.fcmTokens.length > 0) {
                    const pushPromises = reminder.userId.fcmTokens.map(token =>
                        sendPushNotification(token, '🚦 Traffic Update', message, {
                            type: 'traffic_alert',
                            reminderId: reminder._id.toString()
                        }).catch(err => console.error('Push failed:', err.message))
                    );
                    await Promise.all(pushPromises);
                }

                console.log(`Traffic alert sent for reminder: ${reminder.title}`);
            }
        }
    } catch (error) {
        console.error('Error in adjustReminderTimesForTraffic:', error);
    }
}

/**
 * Item Exit Guards
 * Reminds users about items they need to bring when leaving a location
 */
async function checkItemExitGuards() {
    try {
        // Find reminders with item exit guards enabled
        const reminders = await Reminder.find({
            'smartFeatures.itemExitGuards': true,
            status: 'pending',
            location: { $ne: null },
            'coordinates.lat': { $exists: true },
            'coordinates.lng': { $exists: true }
        }).populate('userId', 'name email fcmTokens currentLocation previousLocation');

        for (const reminder of reminders) {
            const user = reminder.userId;

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

            const previousDistanceFromReminder = calculateDistance(
                user.previousLocation.lat,
                user.previousLocation.lng,
                reminder.coordinates.lat,
                reminder.coordinates.lng
            );

            // User was near the location and is now moving away
            const wasNearby = previousDistanceFromReminder <= (reminder.geofenceRadius || 500);
            const isLeavingArea = distanceFromReminder > previousDistanceFromReminder;
            const isNowFarAway = distanceFromReminder > (reminder.geofenceRadius || 500);

            if (wasNearby && isLeavingArea && isNowFarAway) {
                const message = `📦 Don't forget: "${reminder.title}" - Make sure you have everything you need!`;

                await Notification.create({
                    userId: user._id,
                    title: '📦 Item Exit Guard',
                    message: message,
                    type: 'reminder',
                    relatedId: reminder._id,
                    onModel: 'Reminder',
                    actionUrl: '/admin/reminders'
                });

                if (user.fcmTokens && user.fcmTokens.length > 0) {
                    const pushPromises = user.fcmTokens.map(token =>
                        sendPushNotification(token, '📦 Item Exit Guard', message, {
                            type: 'exit_guard',
                            reminderId: reminder._id.toString()
                        }).catch(err => console.error('Push failed:', err.message))
                    );
                    await Promise.all(pushPromises);
                }

                console.log(`Exit guard triggered for reminder: ${reminder.title}`);
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
async function runSmartReminderChecks() {
    console.log('Running smart reminder checks...');
    await Promise.all([
        checkEarlyWarnings(),
        adjustReminderTimesForTraffic(),
        checkItemExitGuards()
    ]);
    console.log('Smart reminder checks completed.');
}

module.exports = {
    runSmartReminderChecks,
    checkEarlyWarnings,
    adjustReminderTimesForTraffic,
    checkItemExitGuards,
    getTrafficAwareTravelTime,
    calculateDistance
};
