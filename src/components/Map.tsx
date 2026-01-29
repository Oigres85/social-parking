"use client";

import { APIProvider, Map as GoogleMap, AdvancedMarker } from "@vis.gl/react-google-maps";
import { useEffect, useState } from "react";

type MapProps = {
  center?: { lat: number; lng: number };
};

export default function MapComponent({ center }: MapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapId = "a41757f352329a43";

  const [position, setPosition] = useState({ lat: 41.902782, lng: 12.496366 }); // Default to Rome
  const [zoom, setZoom] = useState(6);

  useEffect(() => {
    if (center) {
      setPosition(center);
      setZoom(17);
    }
  }, [center]);

  if (!apiKey) {
    return (
      <div className="w-full h-full bg-muted flex items-center justify-center text-center p-4">
        <p className="text-destructive">
          La chiave API di Google Maps non è configurata. <br />
          Aggiungi NEXT_PUBLIC_GOOGLE_MAPS_API_KEY al tuo file .env.local.
        </p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <GoogleMap
        defaultCenter={position}
        defaultZoom={zoom}
        center={position}
        zoom={zoom}
        gestureHandling={"greedy"}
        disableDefaultUI={true}
        mapId={mapId}
        className="w-full h-full"
      >
        {center && <AdvancedMarker position={center} />}
      </GoogleMap>
    </APIProvider>
  );
}
