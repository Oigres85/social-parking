"use client";

import { useEffect, useState } from "react";
import Map, { Marker } from 'react-map-gl';
import { ParkingCircle, MapPin } from "lucide-react";

type MapProps = {
  center?: { lat: number; lng: number };
  parkingSpots?: { lat: number; lng: number }[];
};

export default function MapComponent({ center, parkingSpots = [] }: MapProps) {
  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  
  const [viewState, setViewState] = useState({
    latitude: 41.902782, // Default to Rome
    longitude: 12.496366,
    zoom: 12,
  });

  useEffect(() => {
    if (center) {
      setViewState(current => ({
        ...current,
        latitude: center.lat,
        longitude: center.lng,
        zoom: Math.max(current.zoom, 15),
      }));
    }
  }, [center]);

  if (!accessToken) {
    return (
      <div className="w-full h-full bg-muted flex items-center justify-center text-center p-4">
        <p className="text-destructive">
          Il token di accesso Mapbox non è configurato. <br />
          Aggiungi NEXT_PUBLIC_MAPBOX_TOKEN al tuo file .env.local.
        </p>
      </div>
    );
  }

  return (
    <Map
      {...viewState}
      onMove={evt => setViewState(evt.viewState)}
      style={{ width: '100%', height: '100%' }}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      mapboxAccessToken={accessToken}
    >
      {center && (
        <Marker longitude={center.lng} latitude={center.lat} anchor="bottom">
           <div className="relative">
              <MapPin className="text-red-500 w-8 h-8" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white"/>
            </div>
        </Marker>
      )}
      {parkingSpots.map((spot, index) => (
         <Marker key={index} longitude={spot.lng} latitude={spot.lat} anchor="bottom">
            <ParkingCircle className="text-primary w-8 h-8" fill="hsl(var(--card))" />
        </Marker>
      ))}
    </Map>
  );
}
