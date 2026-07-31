# FallTrack Mobile App

This directory contains the **FallTrack Mobile Application** built with **Expo, React Native, TypeScript, and Lucide Icons**. It features a full offline-first architecture, local caching via AsyncStorage, and background database sync to Supabase.

## Tech Stack & Libraries
* **Framework**: React Native with Expo SDK 54
* **Navigation**: React Navigation (Bottom Tabs)
* **Icons**: Lucide React Native
* **Database Client**: Supabase JS Client with custom sync queue
* **Local Storage**: React Native Async Storage
* **Date picker**: React Native Community DateTimePicker

---

## Folder Structure

```text
mobile/
├── assets/                  # App icon, adaptive splash background, and favicons
├── src/
│   ├── components/          # Reusable UI elements (Alerts, Loaders, Layouts)
│   ├── lib/                 # Supabase client initializer
│   ├── screens/             # Screen components (Dashboard, History, Daily Entry, Settings)
│   ├── services/            # SQLite/AsyncStorage offline state & sync queue services
│   ├── utils/               # App theme configurations, colors, and helpers
│   └── types.ts             # TypeScript type declarations
├── App.tsx                  # Main entry point (animated splash controller & navigators)
├── app.json                 # Expo native application configuration metadata
└── package.json             # Mobile application dependencies and build scripts
```

---

## Local Setup & Run Instructions

### 1. Configure Keys
Make sure you have a `.env` file inside the `/mobile` directory with your Supabase credentials:
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

### 2. Startup Server
```bash
# Install node packages
npm install

# Generate Android/iOS native bindings
npx expo prebuild --platform android

# Start the Expo developer server
npx expo start
```

### 3. Open in Expo Go
1. Install **Expo Go** on your phone from the Google Play Store (Android) or Apple App Store (iOS).
2. Connect your phone and computer to the **same Wi-Fi network**.
3. Scan the QR code shown in your terminal.
4. *If connection fails due to Wi-Fi isolation or firewall, start the server in tunnel mode:*
   ```bash
   npx expo start --tunnel
   ```

---

## Native Release Compilation (APK)

To compile the standalone Release APK file:

### 1. Verify Android SDK Path
Ensure that the local properties file `android/local.properties` exists and points to your Android SDK installation directory:
```properties
sdk.dir=C\:\\Users\\ADMIN\\AppData\\Local\\Android\\Sdk
```

### 2. Trigger Gradle Assembler
Navigate to the native android directory and run the assemble release command:
```bash
cd android
./gradlew assembleRelease
```

### 3. Retrieve APK
Once compilation completes successfully, retrieve your final release APK from:
`android/app/build/outputs/apk/release/app-release.apk`
Copy this file to your Android phone, tap to open, and install it.

---

## Offline Data Synchronization Logic
The mobile app handles data storage through a dual-layer sync queue:
1. **Local Writes**: When saving daily production logs, rates, or custom colors, the app writes them instantly to local `AsyncStorage` and schedules a sync queue task.
2. **Dynamic Syncing**: If an active internet connection is detected, the app automatically uploads the local queue tasks to Supabase.
3. **Self-Healing Merges**: Handles duplicate entry checks and automatically merges conflicting color rows locally and in Supabase to maintain database cleanliness.
