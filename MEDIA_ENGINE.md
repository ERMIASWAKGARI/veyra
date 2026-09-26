# Jetpack Media3 Playback Engine Specification

## 1. Engine Core Overview

The VEYRA Android playback engine is written in Kotlin using **AndroidX Jetpack Media3 (ExoPlayer + Session)**.

### Dependencies
- `androidx.media3:media3-exoplayer:1.3.1`
- `androidx.media3:media3-session:1.3.1`
- `androidx.media3:media3-ui:1.3.1`
- `androidx.media3:media3-common:1.3.1`

---

## 2. Component Roles

### `VeyraMediaService` (extends `MediaSessionService`)
- Declared in `AndroidManifest.xml` with `android:foregroundServiceType="mediaPlayback"`.
- Instantiates an `ExoPlayer` instance on startup.
- Configures `AudioAttributes`:
  ```kotlin
  val audioAttributes = AudioAttributes.Builder()
      .setUsage(C.USAGE_MEDIA)
      .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
      .build()
  player.setAudioAttributes(audioAttributes, /* handleAudioFocus= */ true)
  ```
- Handles `ACTION_AUDIO_BECOMING_NOISY` to automatically pause playback when headphones are disconnected.
- Exposes `MediaSession` so that Android System UI, Bluetooth headsets, lock screens, and notification controllers can dispatch standard commands.

### `VeyraPlaybackModule` (React Native NativeModule)
- Connects to `VeyraMediaService` via `MediaController`.
- Bridges JavaScript calls (`play`, `pause`, `seekTo`, `setQueue`, `setShuffle`, `setRepeatMode`, `setSpeed`) directly to the native `MediaController`.
- Emits events (`onPlaybackStateChanged`, `onMediaChanged`, `onQueueChanged`, `onPlayerError`) to React Native over `DeviceEventManagerModule.RCTDeviceEventEmitter`.

---

## 3. Queue & Native Playlist Management

- The native `ExoPlayer` maintains the master playlist via `MediaItem` instances.
- Adding items (`addMediaItem`, `addMediaItems`), moving items (`moveMediaItem`), and removing items (`removeMediaItem`) occur directly on ExoPlayer.
- **Deterministic Shuffle**: Shuffle mode in ExoPlayer operates with a pre-computed or standard `ShuffleOrder`. Next track selection follows a continuous deterministic list rather than repeated random selections.
- **Repeat Modes**:
  - `Player.REPEAT_MODE_OFF`
  - `Player.REPEAT_MODE_ONE`
  - `Player.REPEAT_MODE_ALL`

---

## 4. Background Playback & Notification Lifecycle

1. **Playback Starts**: Service promotes itself to foreground via `MediaSessionService.onUpdateNotification()`.
2. **Lock Screen Controls**: Standard Media3 integration feeds metadata (Title, Artist, Album, Album Art URI) into the Android lock screen manager.
3. **App Backgrounded**: React Native Activity is paused/stopped; audio continues playing without interruption.
4. **Notification Dismissal**: When paused, the notification can be swiped away, stopping the foreground service and releasing resources.

---

## 5. Playback Resumption Strategy

- When playback pauses or changes tracks, the current `mediaId`, `positionMs`, `durationMs`, and timestamp are stored in SQLite `playback_state`.
- On app relaunch, VEYRA queries the last playback state to reconstruct the mini-player or offer a "Continue Watching / Listening" prompt.
- For video, items watched past 90% completion are automatically marked as watched, and resume prompts are cleared.
