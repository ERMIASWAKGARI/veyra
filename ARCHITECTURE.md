# VEYRA Technical Architecture

## 1. System Overview

VEYRA is built with a decoupled two-tier architecture:
1. **Presentation & Application Layer (React Native + Expo)**: Manages UI rendering, navigation, user inputs, database caching, and metadata presentation.
2. **Authoritative Playback Engine (Android Native Jetpack Media3)**: Runs an asynchronous, background-capable ExoPlayer wrapped in an Android `MediaSessionService`.

```
┌─────────────────────────────────────────────────────────────┐
│                    React Native UI Layer                    │
│      (Expo Router, Screens, MiniPlayer, Fullscreen)         │
└──────────────────────────────┬──────────────────────────────┘
                               │ Bridge Events & Invocations
                               ▼
┌─────────────────────────────────────────────────────────────┐
│             Native Bridge (VeyraPlaybackModule)             │
│        - Controls MediaSession via MediaController          │
│        - Subscribes to ExoPlayer Player.Listener            │
│        - Emits onPlaybackStateChanged / onQueueChanged      │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              VeyraMediaService (MediaSessionService)        │
│        - Manages MediaSession & Authoritative Player        │
│        - System Media Notifications & Lock Screen           │
│        - Audio Focus & Becoming Noisy Receiver              │
│        - Runs independently of React Activity               │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   Jetpack Media3 ExoPlayer                  │
│               - Audio decoders & Video renderers            │
│               - Native playlist & ConcatenatingMediaSource  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Decoupled Lifecycle Guarantees

Under Android system guidelines and our architectural mandate:
- **UI Independence**: If the React Native Activity is killed by Android low memory killer (LMK) or user swiping the app card away, `VeyraMediaService` remains alive in the foreground running the active notification.
- **Single Source of Truth**: The native player maintains the authoritative position, playback state, queue, shuffle order, and repeat mode. React state only reflects native broadcasts; it never estimates or diverges from the engine.
- **Audio Focus**: Implemented directly on the native player with `AudioAttributes.Builder().setUsage(USAGE_MEDIA).setContentType(CONTENT_TYPE_MUSIC).build()`. Handled automatically with system-level callbacks.

---

## 3. Database Architecture (SQLite)

The local SQLite database (`veyra.db`) is the persistent source of truth for all media metadata, playlists, history, and playback resume points.

### Schema Summary
- `media_items`: Master catalog of all indexed audio and video files. Indexed by URI, type, artist, album, folder.
- `artists` & `albums`: Aggregated metadata tables.
- `folders`: Physical directory mapping of media.
- `playlists` & `playlist_items`: User-created and auto-generated playlists with custom sort order and cascade deletion.
- `favorites`: Marked favorite audio and video items with timestamp.
- `play_history`: Historical playback log with completion percentages.
- `playback_state`: High-resolution resume coordinates (`position`, `duration`, `updatedAt`, `speed`, `isVideo`).
- `settings`: Key-value application configuration store.

---

## 4. Media Discovery & Incremental Scanning

- **URI References Only**: No media bytes are ever duplicated into the app's internal sandbox.
- **Android MediaStore & File APIs**: Queries the system MediaStore for audio and video assets using scoped permissions (`READ_MEDIA_AUDIO`, `READ_MEDIA_VIDEO`).
- **Resilient Scanning**: Non-blocking asynchronous batch inserts into SQLite. Files with missing ID3 tags or malformed metadata are normalized with fallback titles extracted from their filenames.
- **Incremental Diffing**: By comparing `dateModified` timestamps between existing database records and storage scans, unchanged files are preserved without expensive tag re-parsing.

---

## 5. State Management & Event Flow

React Native components subscribe to the playback engine through a singleton `PlaybackManager` and React hook `usePlayback()`:
1. `usePlayback()` registers a listener with `PlaybackManager`.
2. When the native player emits state changes (e.g. `BUFFERING`, `READY`, `PAUSED`, `ENDED`), the listener updates a lightweight React state hook.
3. Position updates are tracked at high frequency only when the UI is visible, minimizing CPU and battery consumption when backgrounded.
