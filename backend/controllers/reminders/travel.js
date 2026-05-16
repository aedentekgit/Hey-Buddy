const Reminder = require('../../models/Reminder');
const User = require('../../models/User');
const { calcAdjustedNotification } = require('./helpers');

// ─── Get Travel Stats ─────────────────────────────────────────────────────────
exports.getTravelStats = async (req, res) => {
    try {
        const { id } = req.params;
        const { lat, lng } = req.query;

        const reminder = await Reminder.findById(id);
        if (!reminder) {
            return res.status(404).json({ success: false, message: 'Reminder not found' });
        }

        const user = await User.findById(req.user._id);

        let origin;
        if (lat && lng) {
            origin = { lat: parseFloat(lat), lng: parseFloat(lng) };
        } else {
            if (!user || !user.currentLocation?.lat || !user.currentLocation?.lng) {
                return res.status(400).json({ success: false, message: 'User location not available' });
            }
            origin = user.currentLocation;
        }

        const { getTrafficAwareTravelTime, geocodeAddress } = require('../../services/smartReminderService');
        let destCoords = reminder.coordinates;

        // AUTO-GEOCODE: If coordinates missing but location name exists, try to geocode on the fly
        if ((!destCoords?.lat || !destCoords?.lng) && reminder.location) {
            console.log(`[ReminderController] Geocoding missing destination for stats: "${reminder.location}"`);
            const coords = await geocodeAddress(reminder.location, origin);
            if (coords) {
                destCoords = coords;
                await Reminder.findByIdAndUpdate(id, { coordinates: coords });
            }
        }

        if (!destCoords?.lat || !destCoords?.lng) {
            return res.status(400).json({ success: false, message: 'Reminder location coordinates not found or could not be resolved' });
        }

        // SANITY CHECK: If origin is >1000km from destination (e.g. emulator GPS = San Francisco),
        // fall back to user's stored currentLocation which is the real location.
        const haversineKm = (a, b) => {
            const R = 6371;
            const dLat = (b.lat - a.lat) * Math.PI / 180;
            const dLng = (b.lng - a.lng) * Math.PI / 180;
            const s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
            return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
        };

        const distanceKm = haversineKm(origin, destCoords);
        if (distanceKm > 1000 && user?.currentLocation?.lat && user?.currentLocation?.lng) {
            console.log(`[TravelStats] Origin is ${distanceKm.toFixed(0)}km away — likely bad GPS. Falling back to stored user location.`);
            origin = user.currentLocation;
        }

        const stats = await getTrafficAwareTravelTime(origin, destCoords);

        // Augment with Adjusted Notification Time
        let adjustedNotificationTime = null;
        let totalPrepareTime = null;
        if (reminder.time) {
            const bufferMin = reminder.bufferTime || 5;
            // durationInTraffic is in seconds; convert to whole minutes
            const travelMin = stats?.durationInTraffic ? Math.ceil(stats.durationInTraffic / 60) : 0;
            const u = await User.findById(req.user._id).select('timeFormat');
            const timeFormat = u?.timeFormat === '24' ? '24' : '12';
            const adj = calcAdjustedNotification(reminder.time, travelMin, bufferMin, timeFormat);
            if (adj) {
                adjustedNotificationTime = adj.adjustedTime;
                totalPrepareTime = adj.totalPrepare;
            }
        }

        res.status(200).json({
            success: true,
            data: {
                ...stats,
                adjusted_notification_time: adjustedNotificationTime,
                total_prepare_time: totalPrepareTime
            },
            resolvedCoordinates: destCoords
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};