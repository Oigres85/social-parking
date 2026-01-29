"use client";

import { useEffect, useState } from "react";
import Map, { Marker } from 'react-map-gl';
import { ParkingCircle } from "lucide-react";

type MapProps = {
  center?: { lat: number; lng: number };
};

export default function MapComponent({ center }: MapProps) {
  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  
  const [viewState, setViewState] = useState({
    latitude: 41.902782, // Default to Rome
    longitude: 12.496366,
    zoom: 5,
  });

  useEffect(() => {
    if (center) {
      setViewState({
        latitude: center.lat,
        longitude: center.lng,
        zoom: 17,
      });
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
            <ParkingCircle className="text-primary w-8 h-8" fill="hsl(var(--card))" />
        </Marker>
      )}
    </Map>
  );
}
