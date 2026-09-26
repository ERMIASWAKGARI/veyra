import * as MediaLibrary from 'expo-media-library'
import { Platform } from 'react-native'
import { upsertMediaItemsBatch, getAllMediaItems, setSetting, getSetting } from '../../database/db'
import { APP_CONFIG } from '../../constants/config'

/**
 * Cleanly formats a title from a filename (removes extension, cleans underscores/hyphens)
 */
function cleanTitleFromFilename(filename) {
  if (!filename) return 'Unknown Title'
  const withoutExt = filename.replace(/\.[^/.]+$/, '')
  return withoutExt.replace(/[_-]/g, ' ').trim()
}

/**
 * Extracts folder name from an asset URI or path
 */
function extractFolderName(uri, filename) {
  if (!uri) return 'Internal Storage'
  try {
    const parts = uri.split('/')
    if (parts.length > 2) {
      // Return parent folder
      return decodeURIComponent(parts[parts.length - 2])
    }
  } catch {
    // fallback
  }
  return 'Music'
}

/**
 * Asynchronous, incremental media scanner for local device storage.
 */
export async function scanLocalMedia({
  onProgress = () => {},
  scanAudio = true,
  scanVideo = true,
  forceFullRescan = false
} = {}) {
  // Check platform permissions
  if (Platform.OS !== 'web') {
    const { status, canAskAgain } = await MediaLibrary.getPermissionsAsync()
    if (status !== 'granted') {
      const requestResult = await MediaLibrary.requestPermissionsAsync()
      if (requestResult.status !== 'granted') {
        throw new Error('Media permission was not granted by user.')
      }
    }
  }

  const mediaTypes = []
  if (scanAudio) mediaTypes.push(MediaLibrary.MediaType.audio)
  if (scanVideo) mediaTypes.push(MediaLibrary.MediaType.video)

  if (mediaTypes.length === 0) return { totalScanned: 0, newOrUpdated: 0 }

  let hasNextPage = true
  let afterCursor = undefined
  let totalScanned = 0
  let totalNewOrUpdated = 0
  const BATCH_SIZE = 50

  onProgress({ progress: 0, status: 'Scanning device storage...' })

  while (hasNextPage) {
    try {
      const page = await MediaLibrary.getAssetsAsync({
        mediaType: mediaTypes,
        first: BATCH_SIZE,
        after: afterCursor,
        sortBy: [MediaLibrary.SortBy.modificationTime]
      })

      const assets = page.assets || []
      totalScanned += assets.length

      const itemsToUpsert = []

      for (const asset of assets) {
        try {
          const isVideo = asset.mediaType === MediaLibrary.MediaType.video
          const type = isVideo ? 'video' : 'audio'
          const title = cleanTitleFromFilename(asset.filename)
          const folder = extractFolderName(asset.uri, asset.filename)

          // Duration in seconds to milliseconds
          const durationMs = Math.round((asset.duration || 0) * 1000)

          itemsToUpsert.push({
            id: asset.id || `media_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            uri: asset.uri,
            type,
            title,
            artist: isVideo ? 'Local Video' : 'Unknown Artist',
            album: isVideo ? 'Videos' : 'Unknown Album',
            albumArtist: null,
            genre: null,
            duration: durationMs,
            size: 0,
            mimeType: isVideo ? 'video/mp4' : 'audio/mpeg',
            year: null,
            trackNumber: null,
            discNumber: null,
            artworkUri: null,
            folder,
            dateAdded: asset.creationTime ? asset.creationTime * 1000 : Date.now(),
            dateModified: asset.modificationTime ? asset.modificationTime * 1000 : Date.now()
          })
        } catch (itemErr) {
          // Tolerate individual bad files without stopping scan
          console.warn('Skipping unparsable asset:', asset.filename, itemErr)
        }
      }

      if (itemsToUpsert.length > 0) {
        await upsertMediaItemsBatch(itemsToUpsert)
        totalNewOrUpdated += itemsToUpsert.length
      }

      hasNextPage = page.hasNextPage
      afterCursor = page.endCursor

      onProgress({
        progress: totalScanned / Math.max(page.totalCount || 1, totalScanned),
        totalScanned,
        status: `Found ${totalScanned} items...`
      })
    } catch (pageErr) {
      console.warn('Media scan page error:', pageErr)
      break
    }
  }

  // Record that initial scan completed
  await setSetting(APP_CONFIG.storageKeys.hasCompletedInitialScan, true)

  onProgress({ progress: 1.0, totalScanned, status: 'Scan complete!' })
  return { totalScanned, newOrUpdated: totalNewOrUpdated }
}

/**
 * Seed demonstration media for web/simulator environments where MediaStore is empty
 */
export async function seedDemoMediaIfEmpty() {
  const existingAudio = await getAllMediaItems({ type: 'audio', limit: 1 })
  if (existingAudio.length > 0) return

  const sampleTracks = [
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

  const sampleVideos = [
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

  await upsertMediaItemsBatch([...sampleTracks, ...sampleVideos])
}
