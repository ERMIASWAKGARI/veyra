# VEYRA QA Verification Checklist

Legend:
- `[ ]` Not tested / Pending physical device run
- `[x]` Passed
- `[!]` Failed
- `[-]` Not applicable

---

## 1. Core Audio Playback & Media Engine (Sections 43–44)

- [ ] Audio: Play / Pause / Resume
- [ ] Audio: Next / Previous track transition
- [ ] Audio: Seeking forward / backward
- [ ] Audio: ±10s seek buttons
- [ ] Audio: Background playback with screen locked
- [ ] Audio: Android Media Notification with functional controls & artwork
- [ ] Audio: Lock screen transport controls synchronization
- [ ] Audio: Bluetooth / headset media button handling
- [ ] Audio: Unplugging headphones automatically pauses playback (Becoming Noisy)
- [ ] Audio: Audio focus interruption (incoming phone call ducks or pauses)
- [ ] Audio: Deterministic shuffle sequence
- [ ] Audio: Repeat modes (Off / Repeat All / Repeat One)
- [ ] Audio: Playback speed (0.75x, 1.0x, 1.25x, 1.5x, 2.0x)

---

## 2. Video Playback (Section 45)

- [ ] Video: Play / Pause / Seek / Resume
- [ ] Video: Fullscreen toggle and orientation change without restarting playback
- [ ] Video: Aspect ratio handling
- [ ] Video: Playback speeds (0.25x – 2.0x)
- [ ] Video: Subtitle track selection
- [ ] Video: Continue watching resume prompt (<90% watched)

---

## 3. Media Discovery & Database (Sections 46–48)

- [ ] Permission request flow (Audio / Video / Storage)
- [ ] Media scan discovery of local files (asynchronous & non-blocking)
- [ ] Incremental scanning (skips unchanged files)
- [ ] Formats verified: MP3, M4A/AAC, FLAC, OGG, MP4, MKV
- [ ] Large library stress test (scrolling and query responsiveness)
- [ ] Malformed / corrupt file tolerance (graceful skip without crashing)
- [ ] Local search by title, artist, album, genre, folder

---

## 4. Organization & UI/UX

- [ ] Playlists: Create, rename, delete, reorder, add/remove items
- [ ] Favorites: Separate toggle and lists for audio and video
- [ ] Persistent MiniPlayer reflects authoritative native state
- [ ] Fullscreen player smooth expansion
- [ ] Sleep timer stops playback after specified duration
- [ ] Settings persistence (theme, sorting, playback speed)
- [ ] Clean empty states and error recovery dialogs
