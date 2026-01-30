"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoaderCircle, ParkingCircle, Search, LogOut, Bell, Navigation, ChevronUp, ChevronDown } from "lucide-react";
import Map from "@/components/Map";
import { haversineDistance } from "@/lib/utils";
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase";
import { collection, serverTimestamp, doc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import ParkingSymbol from "@/components/icons/ParkingSymbol";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { getAuth, signOut } from "firebase/auth";

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

const SPEED_THRESHOLD_KMH = 5; // km/h
const SPEED_THRESHOLD_MS = SPEED_THRESHOLD_KMH / 3.6; // m/s
const STOP_DURATION_MS = 60 * 1000; // 60 seconds
const DISTANCE_THRESHOLD_M = 50; // meters
const NOTIFICATION_RADIUS_M = 1000; // 1 km
const PARKING_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

export default function Home() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const [isMonitoring, setIsMonitoring] = useState(false);
  const [status, setStatus] = useState<Status>("Inattivo");
  const [position, setPosition] = useState<Position | null>(null);
  const [parkingSpot, setParkingSpot] = useState<{ lat: number; lng: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isPanelVisible, setIsPanelVisible] = useState(true);

  const stopTimer = useRef<NodeJS.Timeout | null>(null);
  const watcherId = useRef<number | null>(null);
  const spotSaved = useRef(false);
  const notifiedParkingIds = useRef(new Set<string>());
  const { toast } = useToast();
  
  const userDocRef = useMemo(() => (firestore && user) ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  
  const parkingsQuery = useMemoFirebase(() => (firestore && user) ? collection(firestore, "parkings") : null, [firestore, user]);
  const { data: parkingsData } = useCollection(parkingsQuery);

  const mapParkingSpots = useMemo(() => {
    if (isSearching && parkingsData) {
      const now = new Date().getTime();
      return parkingsData
        .filter((p) => {
          if (p.status !== "libero" || !p.timestamp?.toDate) {
            return false;
          }
          const parkingTime = p.timestamp.toDate().getTime();
          return (now - parkingTime) < PARKING_EXPIRATION_MS;
        })
        .map((p) => ({ id: p.id, lat: p.latitude, lng: p.longitude }));
    }
    return [];
  }, [isSearching, parkingsData]);
  
  const handleLogout = async () => {
    const auth = getAuth();
    await signOut(auth);
    router.push('/login');
  };

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);


  const saveParkingToFirestore = useCallback(async (lat: number, lng: number) => {
    if (!firestore || !user) return;
    try {
      addDocumentNonBlocking(collection(firestore, "parkings"), {
        latitude: lat,
        longitude: lng,
        timestamp: serverTimestamp(),
        status: "libero",
        userId: user.uid,
      });
      setStatus("Parcheggio salvato");
      spotSaved.current = true;
      toast({
        title: "Parcheggio Liberato!",
        description: "La tua posizione di parcheggio è stata condivisa con gli utenti vicini.",
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
  }, [firestore, user, toast]);

  const handlePositionUpdate = useCallback((pos: GeolocationPosition) => {
    const newPosition: Position = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      speed: pos.coords.speed,
      timestamp: pos.timestamp,
    };
    setPosition(newPosition);

    if (userDocRef) {
      updateDocumentNonBlocking(userDocRef, { latitude: newPosition.lat, longitude: newPosition.lng });
    }

    const currentSpeed = newPosition.speed ?? 0;

    if (parkingSpot) {
      if (currentSpeed > SPEED_THRESHOLD_MS) {
        const distance = haversineDistance(parkingSpot, newPosition);
        if (distance > DISTANCE_THRESHOLD_M && !spotSaved.current) {
          saveParkingToFirestore(parkingSpot.lat, parkingSpot.lng);
        }
        setParkingSpot(null);
        spotSaved.current = false;
        setStatus("In movimento");
      }
      return;
    }

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
  }, [parkingSpot, saveParkingToFirestore, userDocRef]);
  
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

  const handleParkingSpotClick = (spot: { lat: number; lng: number }) => {
    if (position) {
      const url = `https://www.google.com/maps/dir/?api=1&origin=${position.lat},${position.lng}&destination=${spot.lat},${spot.lng}&travelmode=driving`;
      window.open(url, "_blank");
    } else {
      toast({
        title: "Posizione non disponibile",
        description: "Impossibile calcolare le indicazioni senza la tua posizione attuale.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (isSearching && parkingsData && position) {
      parkingsData.forEach((p) => {
        if (p.status === "libero" && !notifiedParkingIds.current.has(p.id)) {
          const parkingLocation = { lat: p.latitude, lng: p.longitude };
          const distance = haversineDistance({ lat: position.lat, lng: position.lng }, parkingLocation);
          
          if (distance <= NOTIFICATION_RADIUS_M) {
            toast({
              title: "Parcheggio Libero nelle Vicinanze!",
              description: `Un posto si è liberato a ${distance.toFixed(0)} metri da te.`,
              action: (
                <Button onClick={() => handleParkingSpotClick(parkingLocation)}>
                  <Navigation className="mr-2 h-4 w-4" />
                  Indicazioni
                </Button>
              )
            });
            notifiedParkingIds.current.add(p.id);
          }
        }
      });
    }
  }, [isSearching, parkingsData, position, toast, handleParkingSpotClick]);

  const handleSearchingChange = async (checked: boolean) => {
    setIsSearching(checked);
    if (userDocRef) {
      updateDocumentNonBlocking(userDocRef, { isSearching: checked });
    }
    if (checked) {
      toast({
        title: "Notifiche parcheggi liberi attivate",
      });
      if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        await Notification.requestPermission();
      }
    } else {
      toast({
        title: "Non riceverai notifiche per i parcheggi liberi.",
      });
    }
  }

  const renderStatusIcon = () => {
    const isParked = status === "Parcheggiato" || status === "Parcheggio salvato";
    
    if (status === "Richiesta permessi..." || status === "Rilevando sosta...") {
        return <LoaderCircle className="animate-spin text-primary" />;
    }
    
    if (status === "In movimento" && isSearching) {
        return <Search className="text-primary" />;
    }
    
    return <ParkingCircle className={isParked ? "text-primary" : "text-destructive"} />;
  };

  if (isUserLoading || !user) {
    return (
       <main className="flex h-screen w-full flex-col items-center justify-center bg-background text-center p-4">
        <LoaderCircle className="w-12 h-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Caricamento...</p>
      </main>
    )
  }

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
      <Map 
        center={position ? { lat: position.lat, lng: position.lng } : undefined} 
        parkingSpots={mapParkingSpots}
        onParkingSpotClick={handleParkingSpotClick}
      />
      <div className="absolute top-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 flex flex-col items-end">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setIsPanelVisible(!isPanelVisible)} 
          className="mb-2 bg-card/80 backdrop-blur-sm hover:bg-card"
        >
          {isPanelVisible ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          <span className="sr-only">{isPanelVisible ? 'Nascondi pannello' : 'Mostra pannello'}</span>
        </Button>
      
        {isPanelVisible && (
          <div className="w-full flex flex-col gap-4 animate-in fade-in-0 duration-300">
            <Card className="bg-card/80 backdrop-blur-sm">
              <CardHeader className="p-4">
                <CardTitle className="flex items-center justify-between text-lg">
                  <span>Stato Attuale</span>
                  <div className="flex items-center gap-2">
                    {renderStatusIcon()}
                    <Button variant="ghost" size="icon" onClick={handleLogout} title="Esci">
                      <LogOut className="w-5 h-5 text-muted-foreground"/>
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              {status === "Errore" && (
                <CardContent className="p-4 pt-0">
                  <p className="text-sm text-destructive">{errorMessage}</p>
                </CardContent>
              )}
            </Card>

            <Card className="bg-card/80 backdrop-blur-sm">
               <CardHeader className="p-4">
                 <CardTitle className="flex items-center justify-between text-lg">
                  <div className="flex items-center gap-2">
                    <Bell className="text-primary"/>
                    <span>Modalità Ricerca</span>
                  </div>
                </CardTitle>
               </CardHeader>
               <CardContent className="p-4 pt-0">
                  <div className="flex items-center space-x-2">
                    <Switch id="searching-mode" checked={isSearching} onCheckedChange={handleSearchingChange} />
                    <Label htmlFor="searching-mode">Sto cercando parcheggio</Label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Attiva per ricevere notifiche quando un parcheggio si libera vicino a te.
                  </p>
               </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}
