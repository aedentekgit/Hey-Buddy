import api from './api';

/**
 * Location Service
 * Handles geolocation tracking for smart reminder features
 */

let watchId = null;
let isTracking = false;

/**
 * Check if location permission is granted
 */
export const checkLocationPermission = async () => {
    if (!navigator.permissions || !navigator.permissions.query) return 'prompt';
    try {
        const status = await navigator.permissions.query({ name: 'geolocation' });
        return status.state;
    } catch (err) {
        return 'prompt';
    }
};

/**
 * Start tracking user location
 * Sends location updates to the backend every 2 minutes
 */
export const startLocationTracking = async () => {
    if (isTracking) {
        console.log('Location tracking already active');
        return;
    }

    if (!navigator.geolocation) {
        console.warn('Geolocation is not supported by this browser');
        return;
    }

    const permission = await checkLocationPermission();
    if (permission === 'denied') {
        console.warn('Location permission was previously denied. Please enable it in browser settings.');
        return;
    }

    // Options for initial position
    const options = {
        enableHighAccuracy: false,
        maximumAge: 600000, // Accept a cached position up to 10 minutes old
        timeout: 20000 // Give it more time (20s)
    };

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
                    // Code 2 is POSITION_UNAVAILABLE, which mapping to kCLErrorLocationUnknown on macOS
                    if (error.code === 2) {
                        // Silence the warning as it's often transient on Mac/Desktop
                        return;
                    }
                    console.error('Location tracking error:', error.message);
                },
                {
                    enableHighAccuracy: false,
                    maximumAge: 300000, // 5 minutes
                    timeout: 30000
                }
            );

            isTracking = true;
            console.log('📍 Location tracking started');
        },
        (error) => {
            if (error.code === 1) { // PERMISSION_DENIED
                console.warn('Location permission denied by user.');
            } else if (error.code === 2) { // POSITION_UNAVAILABLE
                // This is the kCLErrorLocationUnknown failure on Mac
                console.info('Location service hint: Position unavailable. This often happens if WiFi is off or location services are restricted in Mac System Settings.');
            } else {
                console.warn('Location error:', error.message);
            }
        },
        options
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
        // console.log(`📍 Location updated: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
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
                // Return a default or handle based on code
                if (error.code === 2) {
                    console.warn('Position unavailable (kCLErrorLocationUnknown).');
                }
                reject(error);
            },
            {
                enableHighAccuracy: false, // Changed to false to be more resilient
                timeout: 10000,
                maximumAge: 60000 // Use cached position if available within a minute
            }
        );
    });
};

export default {
    checkLocationPermission,
    startLocationTracking,
    stopLocationTracking,
    getCurrentLocation
};

