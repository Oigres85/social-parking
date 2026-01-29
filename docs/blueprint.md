# **App Name**: Social Parking Italia

## Core Features:

- Splash Screen with GPS Activation: Initial screen with a 'ATTIVA MONITORAGGIO' button to enable GPS on iOS Safari.
- Real-time GPS Monitoring: Tracks user speed and location to determine parking status.
- Parking Status Logic: Detects when the user has parked (speed drops to 0 for 60s) and when they move more than 50m away from the parking spot.
- Map Integration: Uses flutter_map with Mapbox token to display the user's location.
- Firebase Integration: Connects to Cloud Firestore to save parking locations.
- Parking Data Storage: Saves parking location (GeoPoint), timestamp, and status ('libero') to the 'parkings' collection in Firestore using the saveParking function.
- PWA Optimization: Configures the app as a Progressive Web App (PWA) with proper meta-tags and manifest.json setup.

## Style Guidelines:

- Background color: Dark theme with #0D0D0D for the background.
- Text color: White text for readability on the dark background.
- Accent color: Neon/Electric Green (#39FF14) for highlights and primary interactive elements to convey a modern and high-tech aesthetic. The vividness is attention-grabbing on the dark background.
- Font: 'Inter' (sans-serif) for both headlines and body text, providing a modern, readable interface.
- Minimalist icons representing parking and location.
- Clean and intuitive layout for easy navigation and usability.
- Subtle animations for user interactions, such as GPS activation and parking status updates.