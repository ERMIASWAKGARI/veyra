import { upsertMediaItemsBatch, getAllMediaItems, setSetting } from '../../database/db'
import { APP_CONFIG } from '../../constants/config'

const DEMO_AUDIO = [
  {
    id: 'demo_track_1',
    uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    type: 'audio',
    title: 'Acoustic Horizon',
    artist: 'VEYRA Collective',
    album: 'Pure Horizons',
    genre: 'Ambient',
    duration: 372000,
    size: 6120000,
    mimeType: 'audio/mp3',
    year: 2026,
    trackNumber: 1,
    folder: 'Demo Music',
    artworkUri: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&q=80',
    dateAdded: Date.now() - 86400000 * 2,
    dateModified: Date.now() - 86400000 * 2
  },
  {
    id: 'demo_track_2',
    uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    type: 'audio',
    title: 'Midnight Resonance',
    artist: 'Lunar Echoes',
    album: 'Solaris Drift',
    genre: 'Electronic',
    duration: 423000,
    size: 7100000,
    mimeType: 'audio/mp3',
    year: 2026,
    trackNumber: 2,
    folder: 'Demo Music',
    artworkUri: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=500&q=80',
    dateAdded: Date.now() - 86400000,
    dateModified: Date.now() - 86400000
  },
  {
    id: 'demo_track_3',
    uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    type: 'audio',
    title: 'Celestial Cascade',
    artist: 'VEYRA Collective',
    album: 'Pure Horizons',
    genre: 'Ambient',
    duration: 345000,
    size: 5800000,
    mimeType: 'audio/mp3',
    year: 2026,
    trackNumber: 3,
    folder: 'Demo Music',
    artworkUri: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&q=80',
    dateAdded: Date.now(),
    dateModified: Date.now()
  }
]

const DEMO_VIDEOS = [
  {
    id: 'demo_video_1',
    uri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    type: 'video',
    title: 'Wildlife Odyssey — Mountain Highlands',
    artist: 'Nature Cinema',
    album: 'Earth Reel',
    genre: 'Documentary',
    duration: 596000,
    size: 158000000,
    mimeType: 'video/mp4',
    year: 2026,
    folder: 'Demo Videos',
    artworkUri: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=500&q=80',
    dateAdded: Date.now(),
    dateModified: Date.now()
  }
]

/**
 * Web-compatible media scanner (populates demo audio & video tracks).
 */
export async function scanLocalMedia({
  onProgress = (_progress) => {},
  scanAudio = true,
  scanVideo = true
} = {}) {
  onProgress({ progress: 0.3, status: 'Scanning web environment...' })

  const items = []
  if (scanAudio) items.push(...DEMO_AUDIO)
  if (scanVideo) items.push(...DEMO_VIDEOS)

  await upsertMediaItemsBatch(items)
  await setSetting(APP_CONFIG.storageKeys.hasCompletedInitialScan, true)

  onProgress({ progress: 1.0, totalScanned: items.length, status: 'Scan complete!' })
  return { totalScanned: items.length, newOrUpdated: items.length }
}

/**
 * Seed demonstration media for web preview
 */
export async function seedDemoMediaIfEmpty() {
  const existingAudio = await getAllMediaItems({ type: 'audio', limit: 1 })
  if (existingAudio.length > 0) return

  await upsertMediaItemsBatch([...DEMO_AUDIO, ...DEMO_VIDEOS])
}

export async function scanCustomFolderSAF() {
  return { totalScanned: 0, newOrUpdated: 0 }
}

export async function pickFilesAndImport() {
  return { totalScanned: 0, newOrUpdated: 0 }
}

