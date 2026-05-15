import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Autocomplete, Circle, DirectionsService, DirectionsRenderer } from '@react-google-maps/api';
import { useSettings } from '../context/SettingsContext';
import { MapPin, Target, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';

const libraries = ['places', 'geometry'];
const mapContainerStyle = { width: '100%', height: '100%', borderRadius: '16px' };
const defaultCenter = { lat: 37.7749, lng: -122.4194 }; // SF Default

const GoogleMapPicker = ({ location, setLocation, coordinates, setCoordinates, isEditing, radius, userLocation }) => {
    const { settings, publicSettings, loading: settingsLoading } = useSettings();
    const [mapError, setMapError] = useState(null);

    // Check both private and public settings for the key
    const currentSettings = settings || publicSettings;
    const apiKey = currentSettings?.googleMaps?.apiKey;
    const enabled = currentSettings?.googleMaps?.enabled;

    const { isLoaded, loadError } = useJsApiLoader({
        googleMapsApiKey: apiKey || '',
        libraries,
    });

    const [map, setMap] = useState(null);
    const [directionsResponse, setDirectionsResponse] = useState(null);
    const autocompleteRef = useRef(null);

    // Initial centering and radius sync
    useEffect(() => {
        if (map) {
            if (directionsResponse) {
                const bounds = new window.google.maps.LatLngBounds();
                const route = directionsResponse.routes[0];
                route.overview_path.forEach(point => bounds.extend(point));
                map.fitBounds(bounds, 50);
            } else if (coordinates?.lat && coordinates?.lng) {
                map.panTo(coordinates);
            } else if (userLocation?.lat && userLocation?.lng) {
                map.panTo(userLocation);
                map.setZoom(15);
            }
        }
    }, [map, coordinates, radius, directionsResponse, userLocation]);

    const directionsCallback = useCallback((res) => {
        if (res !== null) {
            console.log('Directions Service Callback Status:', res.status);
            if (res.status === 'OK') {
                setDirectionsResponse(res);
                setMapError(null);
            } else {
                console.error('Directions request failed:', res.status);
                if (res.status === 'REQUEST_DENIED') {
                    setMapError('Directions API not enabled in Google Cloud Console');
                } else if (res.status === 'ZERO_RESULTS') {
                    setMapError('No driving route found between these points');
                } else {
                    setMapError(`Map Error: ${res.status}`);
                }
            }
        }
    }, []);

    // Reset directions when locations change significantly
    useEffect(() => {
        setDirectionsResponse(null);
        setMapError(null);
    }, [coordinates?.lat, coordinates?.lng, userLocation?.lat, userLocation?.lng]);

    const onLoad = useCallback(function callback(map) {
        setMap(map);
    }, []);

    const onUnmount = useCallback(function callback(map) {
        setMap(null);
    }, []);

    const onPlaceChanged = () => {
        if (autocompleteRef.current !== null) {
            const place = autocompleteRef.current.getPlace();
            if (place.geometry && place.geometry.location) {
                const lat = place.geometry.location.lat();
                const lng = place.geometry.location.lng();
                setCoordinates({ lat, lng });
                setLocation(place.name || place.formatted_address || '');
                map?.panTo({ lat, lng });
            }
        }
    };

    const handleMapClick = (e) => {
        if (!isEditing) return;
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        setCoordinates({ lat, lng });
        setLocation(`Custom Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
    };

    const handleCurrentLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    setCoordinates({ lat, lng });
                    setLocation("My Current Location");
                    map?.panTo({ lat, lng });
                    map?.setZoom(15);
                },
                (error) => {
                    if (error.code === 2) {
                        toast.error("Location unavailable. Please check if your device's location services are enabled.");
                    } else {
                        toast.error(error.message || "Could not get current location.");
                    }
                },
                { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
            );
        } else {
            alert("Geolocation is not supported by this browser.");
        }
    };

    if (settingsLoading) {
        return (
            <div style={{ height: '180px', background: 'var(--bg-lite)', borderRadius: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>Syncing settings...</span>
            </div>
        );
    }

    if (!enabled || !apiKey) {
        return (
            <div style={{
                height: '180px',
                background: 'var(--bg-lite)',
                border: '1px dashed var(--border-color)',
                borderRadius: '16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                position: 'relative',
                overflow: 'hidden',
                textAlign: 'center',
                padding: '20px'
            }}>
                <MapPin size={32} color="var(--text-sub)" style={{ marginBottom: '12px', opacity: 0.5 }} />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600 }}>Google Maps Service Not Active</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)', marginTop: '4px', maxWidth: '240px' }}>
                    {!enabled ? "Maps are disabled in settings." : "Missing API Key in settings."}
                    <br />Go to <strong>Settings &gt; Google Maps</strong> to configure.
                </span>
            </div>
        );
    }

    if (loadError) {
        return (
            <div style={{ height: '180px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)', borderRadius: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center', padding: '20px' }}>
                <AlertTriangle size={32} color="#ef4444" style={{ marginBottom: '12px' }} />
                <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#b91c1c' }}>Error Loading Map</span>
                <span style={{ fontSize: '0.75rem', color: '#b91c1c', marginTop: '4px' }}>{loadError.message}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-sub)', marginTop: '8px' }}>
                    Ensure "Maps JavaScript API" is enabled in your Google Cloud Console.
                </span>
            </div>
        );
    }

    if (!isLoaded) {
        return (
            <div style={{ height: '180px', background: 'var(--bg-lite)', borderRadius: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                <RefreshCw size={24} className="animate-spin" color="var(--primary-color)" />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginTop: '12px' }}>Loading Maps...</span>
            </div>
        );
    }

    const center = coordinates?.lat ? coordinates : (userLocation?.lat ? userLocation : defaultCenter);

    return (
        <div style={{ position: 'relative', height: '240px', marginBottom: '20px' }}>
            {/* Error Overlay for Developers */}
            {mapError && (
                <div style={{
                    position: 'absolute',
                    bottom: '10px',
                    left: '10px',
                    right: '10px',
                    zIndex: 10,
                    background: 'rgba(255, 255, 255, 0.9)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    border: '1px solid #fee2e2',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                    <AlertTriangle size={16} color="#ef4444" />
                    <span style={{ fontSize: '0.75rem', color: '#b91c1c', fontWeight: 600 }}>{mapError}</span>
                </div>
            )}

            {isEditing && (
                <div style={{ position: 'absolute', top: '10px', left: '10px', right: '10px', zIndex: 1, display: 'flex', gap: '8px' }}>
                    <Autocomplete onLoad={(auto) => autocompleteRef.current = auto} onPlaceChanged={onPlaceChanged} style={{ flex: 1 }}>
                        <input
                            type="text"
                            placeholder="Search location..."
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 14px',
                                borderRadius: '8px',
                                border: 'none',
                                outline: 'none',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                                fontSize: '0.9rem'
                            }}
                        />
                    </Autocomplete>
                    <button
                        type="button"
                        onClick={handleCurrentLocation}
                        style={{
                            background: 'var(--card-bg)',
                            border: 'none',
                            padding: '10px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                            color: 'var(--primary-color)'
                        }}
                        title="Use Current Location"
                    >
                        <Target size={20} />
                    </button>
                </div>
            )}

            <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={center}
                zoom={coordinates?.lat ? 14 : 15}
                onLoad={onLoad}
                onUnmount={onUnmount}
                onClick={handleMapClick}
                options={{
                    disableDefaultUI: true,
                    zoomControl: true,
                    clickableIcons: false,
                    styles: [
                        { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }
                    ]
                }}
            >
                {/* Route Rendering */}
                {enabled && apiKey && userLocation?.lat && coordinates?.lat && !directionsResponse && !mapError && (
                    <DirectionsService
                        key={`${userLocation.lat}-${userLocation.lng}-${coordinates.lat}-${coordinates.lng}`}
                        options={{
                            origin: { lat: Number(userLocation.lat), lng: Number(userLocation.lng) },
                            destination: { lat: Number(coordinates.lat), lng: Number(coordinates.lng) },
                            travelMode: 'DRIVING'
                        }}
                        callback={directionsCallback}
                    />
                )}

                {directionsResponse && (
                    <DirectionsRenderer
                        directions={directionsResponse}
                        options={{
                            suppressMarkers: true,
                            polylineOptions: {
                                strokeColor: "#4285F4",
                                strokeOpacity: 1,
                                strokeWeight: 6,
                            },
                        }}
                    />
                )}

                {/* Always show User Location (Blue Dot) */}
                {userLocation?.lat && (
                    <Marker
                        position={{ lat: Number(userLocation.lat), lng: Number(userLocation.lng) }}
                        zIndex={10}
                        icon={{
                            path: window.google ? window.google.maps.SymbolPath.CIRCLE : 0,
                            scale: 8,
                            fillColor: "#4285F4",
                            fillOpacity: 1,
                            strokeColor: "#FFFFFF",
                            strokeWeight: 2,
                        }}
                    />
                )}

                {/* Destination Marker */}
                {coordinates?.lat && (
                    <Marker
                        position={{ lat: Number(coordinates.lat), lng: Number(coordinates.lng) }}
                        zIndex={5}
                        icon={{
                            url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
                        }}
                    />
                )}

                {/* Geofence Circle (Always visible if destination exists) */}
                {coordinates?.lat && radius && (
                    <Circle
                        center={{ lat: Number(coordinates.lat), lng: Number(coordinates.lng) }}
                        radius={Number(radius)}
                        options={{
                            strokeColor: '#6366f1', // Fixed: Google Maps can't resolve CSS variables
                            strokeOpacity: 0.8,
                            strokeWeight: 2,
                            fillColor: '#6366f1',
                            fillOpacity: 0.1,
                            clickable: false
                        }}
                    />
                )}
            </GoogleMap>
        </div>
    );
};

export default GoogleMapPicker;
