import api from './api';

/**
 * Location Service
 * Handles geolocation tracking for smart reminder features
 */

let watchId = null;
let isTracking = false;

/**
 * Start tracking user location
 * Sends location updates to the backend every 2 minutes
 */
export const startLocationTracking = () => {
    if (isTracking) {
        console.log('Location tracking already active');
        return;
    }

    if (!navigator.geolocation) {
        console.warn('Geolocation is not supported by this browser');
        return;
    }

    // Request permission and start tracking
    navigator.geolocation.getCurrentPosition(
        (position) => {
            console.log('✅ Location permission granted');
            sendLocationUpdate(position.coords.latitude, position.coords.longitude);

            // Watch position changes
            watchId = navigator.geolocation.watchPosition(
                (position) => {
                    sendLocationUpdate(position.coords.latitude, position.coords.longitude);
                },
                (error) => {
                    console.error('Location tracking error:', error.message);
                },
                {
                    enableHighAccuracy: false,
                    maximumAge: 120000, // 2 minutes
                    timeout: 10000
                }
            );

            isTracking = true;
            console.log('📍 Location tracking started');
        },
        (error) => {
            console.warn('Location permission denied:', error.message);
        }
    );
};

/**
 * Stop tracking user location
 */
export const stopLocationTracking = () => {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
        isTracking = false;
        console.log('📍 Location tracking stopped');
    }
};

/**
 * Send location update to backend
 */
const sendLocationUpdate = async (lat, lng) => {
    try {
        await api.post('/users/location', { lat, lng });
        console.log(`📍 Location updated: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    } catch (error) {
        console.error('Failed to update location:', error.message);
    }
};

/**
 * Get current location once (without tracking)
 */
export const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
            },
            (error) => {
                reject(error);
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            }
        );
    });
};

export default {
    startLocationTracking,
    stopLocationTracking,
    getCurrentLocation
};
