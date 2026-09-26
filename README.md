# VEYRA

> **Fast · Lightweight · Reliable · Offline-first · Private · Native-quality playback**

VEYRA is a production-quality, Android-first, local music and video player built with React Native + Expo and a native Android Jetpack Media3 ExoPlayer playback engine.

---

## Key Features

- **Authoritative Native Playback**: Jetpack Media3 ExoPlayer running in a dedicated `MediaSessionService`. Background playback and lock screen controls are completely independent of the React Native UI lifecycle.
- **Offline-First & Fully Private**: Zero accounts, zero ads, zero telemetry, zero media uploads. Media files are indexed locally by URI only — never duplicated.
- **Unified Audio & Video Engine**: Seamless playback for both music and video formats (MP3, AAC, FLAC, OGG, WAV, MP4, MKV, WebM).
- **Rich Organization**: Playlists, Favorites (separate for Audio/Video), Play History, Recently Played, and Continue Watching with resume position tracking.
- **Modern Minimal Design**: Dark-first, battery-efficient, accessible typography and contrast, smooth animations, and a persistent MiniPlayer.
- **System Media Integration**: Standard Android MediaSession, notification controls, Bluetooth / headset media button support, and audio focus management (e.g. automatic pause on unplugging headphones).

---

## Project Structure

```
veyra/
├── app/                  # Expo Router file-based screens
│   ├── _layout.jsx       # Root layout, theme provider, and persistent mini-player
│   ├── index.jsx         # Home dashboard
│   ├── music/            # Music library (Songs, Artists, Albums, Genres, Folders)
│   ├── videos/           # Video library (All videos, Folders, Favorites)
│   ├── playlists/        # Playlists management
│   ├── search/           # Global local search
│   ├── player/           # Fullscreen audio and video player screens
│   └── settings/         # Settings and storage management
├── src/
│   ├── components/       # Reusable UI components (MiniPlayer, MediaCard, TrackRow, etc.)
│   ├── constants/        # App configuration, theme tokens, typography
│   ├── database/         # SQLite schema, queries, transactions, and repositories
│   ├── playback/         # Native bridge, playback manager, and state sync
│   ├── services/         # Media scanner, metadata parser, and thumbnail utilities
│   ├── stores/           # React hooks and reactive subscriptions
│   └── utils/            # Time, format, and debounce helpers
└── android/              # Native Android Jetpack Media3 engine & bridge
    └── app/src/main/java/com/veyra/player/
        ├── playback/     # VeyraMediaService, AudioFocusHelper, NotificationManager
        └── bridge/       # VeyraPlaybackModule, VeyraPackage
```

---

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm or yarn
- For native Android builds: Android Studio / Android SDK (API 34+), JDK 17

### Development

```bash
# Navigate to directory
cd veyra

# Install dependencies
npm install

# Start Expo development server
npm run start

# Run on Android device or emulator
npm run android

# Run on Web (for rapid UI & navigation testing)
npm run web
```

---

## Native Architecture & Background Playback

The native playback engine runs in `VeyraMediaService` (a subclass of Android's `androidx.media3.session.MediaSessionService`).
- **Foreground Service**: Holds a wake lock and manages notification controls via Jetpack Media3.
- **Audio Focus**: Automatically ducks or pauses audio when calls arrive or headphones are disconnected (`ACTION_AUDIO_BECOMING_NOISY`).
- **MediaSession**: Exposes native transport controls to lock-screen, Android Auto, and Bluetooth devices.

---

## Documentation

- [ARCHITECTURE.md](file:///d:/Projects/veyra/ARCHITECTURE.md) — Comprehensive technical architecture
- [MEDIA_ENGINE.md](file:///d:/Projects/veyra/MEDIA_ENGINE.md) — Jetpack Media3 engine details
- [FEATURE_STATUS.md](file:///d:/Projects/veyra/FEATURE_STATUS.md) — Feature status matrix
- [QA_CHECKLIST.md](file:///d:/Projects/veyra/QA_CHECKLIST.md) — Device & format verification checklist
