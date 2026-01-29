"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoaderCircle, ParkingCircle } from "lucide-react";
import Map from "@/components/Map";
import { haversineDistance } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { addDoc, collection, GeoPoint, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import ParkingSymbol from "@/components/icons/ParkingSymbol";

type Position = {
  lat: number;
  lng: number;
  speed: number | null;
  timestamp: number;
};

type Status =
  | "Inattivo"
  | "Richiesta permessi..."
  | "In movimento"
  | "Rilevando sosta..."
  | "Parcheggiato"
  | "Parcheggio salvato"
  | "Errore";

const SPEED_THRESHOLD_KMH = 10; // km/h
const SPEED_THRESHOLD_MS = SPEED_THRESHOLD_KMH / 3.6; // m/s
const STOP_DURATION_MS = 60 * 1000; // 60 seconds
const DISTANCE_THRESHOLD_M = 50; // meters

export default function Home() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [status, setStatus] = useState<Status>("Inattivo");
  const [position, setPosition] = useState<Position | null>(null);
  const [parkingSpot, setParkingSpot] = useState<{ lat: number; lng: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stopTimer = useRef<NodeJS.Timeout | null>(null);
  const watcherId = useRef<number | null>(null);
  const spotSaved = useRef(false);
  const { toast } = useToast();

  const saveParkingToFirestore = useCallback(async (lat: number, lng: number) => {
    if (!db) {
      console.error("Firebase non è inizializzato.");
      toast({
        title: "Errore di configurazione",
        description: "Firebase non è correttamente configurato. Controlla le variabili d'ambiente.",
        variant: "destructive",
      });
      return;
    }
    try {
      await addDoc(collection(db, "parkings"), {
        location: new GeoPoint(lat, lng),
        timestamp: serverTimestamp(),
        status: "libero",
      });
      setStatus("Parcheggio salvato");
      spotSaved.current = true;
      toast({
        title: "Parcheggio Salvato!",
        description: "La tua posizione di parcheggio è stata condivisa.",
      });
    } catch (error) {
      console.error("Errore nel salvataggio del parcheggio:", error);
      setStatus("Errore");
      setErrorMessage("Impossibile salvare il parcheggio su Firebase.");
      toast({
        title: "Errore di salvataggio",
        description: "Non è stato possibile salvare il parcheggio. Riprova più tardi.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handlePositionUpdate = useCallback((pos: GeolocationPosition) => {
    const newPosition: Position = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      speed: pos.coords.speed,
      timestamp: pos.timestamp,
    };
    setPosition(newPosition);

    const currentSpeed = newPosition.speed ?? 0;

    // Logic when a parking spot has been set
    if (parkingSpot) {
      if (currentSpeed > SPEED_THRESHOLD_MS) {
        // User started moving again, reset everything
        setParkingSpot(null);
        spotSaved.current = false;
        setStatus("In movimento");
      } else {
        const distance = haversineDistance(parkingSpot, newPosition);
        if (distance > DISTANCE_THRESHOLD_M && !spotSaved.current) {
          saveParkingToFirestore(parkingSpot.lat, parkingSpot.lng);
        }
      }
      return;
    }

    // Logic to detect parking
    if (currentSpeed < SPEED_THRESHOLD_MS) {
      if (!stopTimer.current) {
        setStatus("Rilevando sosta...");
        stopTimer.current = setTimeout(() => {
          setParkingSpot({ lat: newPosition.lat, lng: newPosition.lng });
          setStatus("Parcheggiato");
          stopTimer.current = null;
        }, STOP_DURATION_MS);
      }
    } else {
      if (stopTimer.current) {
        clearTimeout(stopTimer.current);
        stopTimer.current = null;
      }
      setStatus("In movimento");
    }
  }, [parkingSpot, saveParkingToFirestore]);

  const handlePositionError = (error: GeolocationPositionError) => {
    let message = "Si è verificato un errore sconosciuto.";
    switch (error.code) {
      case error.PERMISSION_DENIED:
        message = "Permesso di geolocalizzazione negato.";
        break;
      case error.POSITION_UNAVAILABLE:
        message = "Informazioni sulla posizione non disponibili.";
        break;
      case error.TIMEOUT:
        message = "La richiesta di geolocalizzazione è scaduta.";
        break;
    }
    setStatus("Errore");
    setErrorMessage(message);
    setIsMonitoring(false);
  };

  const startMonitoring = () => {
    if (!navigator.geolocation) {
      setStatus("Errore");
      setErrorMessage("La geolocalizzazione non è supportata da questo browser.");
      return;
    }
    
    setStatus("Richiesta permessi...");
    setIsMonitoring(true);

    watcherId.current = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      handlePositionError,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };
  
  useEffect(() => {
    return () => {
      if (watcherId.current) {
        navigator.geolocation.clearWatch(watcherId.current);
      }
      if (stopTimer.current) {
        clearTimeout(stopTimer.current);
      }
    };
  }, []);

  const renderStatusIcon = () => {
    switch (status) {
      case "Richiesta permessi...":
      case "Rilevando sosta...":
        return <LoaderCircle className="animate-spin text-primary" />;
      case "Parcheggiato":
      case "Parcheggio salvato":
        return <ParkingCircle className="text-primary" />;
      default:
        return null;
    }
  };

  if (!isMonitoring) {
    return (
      <main className="flex h-screen w-full flex-col items-center justify-center bg-background text-center p-4">
        <div className="flex flex-col items-center gap-4">
          <ParkingSymbol className="w-24 h-24 text-primary" />
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Social Parking Italia</h1>
          <p className="max-w-md text-muted-foreground">
            Attiva il monitoraggio per rilevare automaticamente i tuoi parcheggi e condividerli con la community.
          </p>
        </div>
        <Button onClick={startMonitoring} size="lg" className="mt-8 shadow-lg shadow-primary/20">
          ATTIVA MONITORAGGIO
        </Button>
        {status === "Errore" && (
            <p className="mt-4 text-destructive">{errorMessage}</p>
        )}
      </main>
    );
  }

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <Map center={position ? { lat: position.lat, lng: position.lng } : undefined} />
      <div className="absolute top-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80">
        <Card className="bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Stato Attuale</span>
              {renderStatusIcon()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{status}</p>
            {status === "Errore" && (
              <p className="mt-2 text-sm text-destructive">{errorMessage}</p>
            )}
            {position && (
              <div className="mt-4 text-xs text-muted-foreground space-y-1">
                <p>Velocità: {position.speed ? `${(position.speed * 3.6).toFixed(1)} km/h` : "N/D"}</p>
                <p>Lat: {position.lat.toFixed(6)}, Lng: {position.lng.toFixed(6)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
