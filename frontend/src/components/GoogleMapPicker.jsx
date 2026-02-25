import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Autocomplete, Circle } from '@react-google-maps/api';
import { useSettings } from '../context/SettingsContext';
import { MapPin, Target } from 'lucide-react';

const libraries = ['places'];
const mapContainerStyle = { width: '100%', height: '100%', borderRadius: '16px' };
const defaultCenter = { lat: 37.7749, lng: -122.4194 }; // SF Default

const GoogleMapPicker = ({ location, setLocation, coordinates, setCoordinates, isEditing, radius }) => {
    const { settings } = useSettings();
    const apiKey = settings?.googleMaps?.apiKey;
    const enabled = settings?.googleMaps?.enabled;

    const { isLoaded, loadError } = useJsApiLoader({
        googleMapsApiKey: apiKey || '',
        libraries,
    });

    const [map, setMap] = useState(null);
    const autocompleteRef = useRef(null);

    // Initial centering and radius sync
    useEffect(() => {
        if (map && coordinates?.lat && coordinates?.lng) {
            map.panTo(coordinates);
        }
    }, [map, coordinates, radius]);

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
                () => {
                    alert("Could not get current location.");
                }
            );
        } else {
            alert("Geolocation is not supported by this browser.");
        }
    };

    if (!enabled || !apiKey) {
        return (
            <div style={{
                height: '180px',
                background: 'var(--bg-lite)',
                borderRadius: '16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <MapPin size={32} color="var(--text-sub)" />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginTop: '8px' }}>Google Maps not configured</span>
            </div>
        );
    }

    if (loadError) return <div>Error loading maps</div>;
    if (!isLoaded) return <div>Loading Maps...</div>;

    const center = coordinates?.lat ? coordinates : defaultCenter;

    return (
        <div style={{ position: 'relative', height: '240px', marginBottom: '20px' }}>
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
                zoom={coordinates?.lat ? 14 : 2}
                onLoad={onLoad}
                onUnmount={onUnmount}
                onClick={handleMapClick}
                options={{
                    disableDefaultUI: true,
                    zoomControl: true,
                    clickableIcons: false
                }}
            >
                {coordinates?.lat && (
                    <>
                        <Marker position={coordinates} />
                        {radius && (
                            <Circle
                                center={coordinates}
                                radius={Number(radius)}
                                options={{
                                    strokeColor: 'var(--primary-color)',
                                    strokeOpacity: 0.8,
                                    strokeWeight: 2,
                                    fillColor: 'var(--primary-color)',
                                    fillOpacity: 0.2,
                                }}
                            />
                        )}
                    </>
                )}
            </GoogleMap>
        </div>
    );
};

export default GoogleMapPicker;
