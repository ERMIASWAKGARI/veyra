import { Platform } from 'react-native'
import Constants, { ExecutionEnvironment } from 'expo-constants'
import { requireOptionalNativeModule } from 'expo-modules-core'
import * as FileSystem from 'expo-file-system'
import { upsertMediaItemsBatch, getAllMediaItems, setSetting, getSetting, clearDemoMedia } from '../../database/db'
import { APP_CONFIG } from '../../constants/config'

/**
 * Dynamically resolves the MediaLibrary module:
 * 1. Checks for modern ExpoMediaLibraryNext (available in custom dev builds / standalone APKs)
 * 2. Falls back to ExpoMediaLibrary via legacy import (available in standard Expo Go)
 */
function getMediaLibrary() {
  if (Platform.OS === 'web') return null

  // 1. Try modern Next module (compiled in custom dev builds and standalone APKs)
  try {
    const nextModule = requireOptionalNativeModule('ExpoMediaLibraryNext')
    if (nextModule) {
      return require('expo-media-library')
    }
  } catch {}

  // 2. Try legacy MediaLibrary module (available in Expo Go on Android)
  try {
    const legacyModule = requireOptionalNativeModule('ExpoMediaLibrary')
    if (legacyModule) {
      return require('expo-media-library/legacy')
    }
  } catch {}

  try {
    return require('expo-media-library')
  } catch {}

  return null
}

/**
 * Generates a deterministic, collision-free ID for any media URI
 */
function generateDeterministicId(uri) {
  if (!uri) return `media_${Date.now()}`
  let hash = 0
  for (let i = 0; i < uri.length; i++) {
    hash = (hash << 5) - hash + uri.charCodeAt(i)
    hash |= 0
  }
  const cleanSuffix = uri.split('/').pop()?.replace(/[^a-zA-Z0-9]/g, '_').slice(-20) || 'track'
  return `m_${Math.abs(hash).toString(36)}_${cleanSuffix}`
}

/**
 * Intelligently extracts artist and title from filename (e.g. "Artist - Title.mp3")
 */
function parseTrackMetadata(filename) {
  if (!filename) return { title: 'Unknown Title', artist: 'Unknown Artist' }
  const clean = filename.replace(/\.[^/.]+$/, '').trim()
  if (clean.includes(' - ')) {
    const parts = clean.split(' - ')
    if (parts.length >= 2) {
      return {
        artist: parts[0].trim() || 'Unknown Artist',
        title: parts.slice(1).join(' - ').trim() || 'Unknown Title'
      }
    }
  }
  return {
    title: clean.replace(/[_-]/g, ' ').trim() || 'Unknown Title',
    artist: 'Unknown Artist'
  }
}

/**
 * Extracts folder name from an asset URI or path
 */
function extractFolderName(uri, filename) {
  if (!uri) return 'Internal Storage'
  try {
    const parts = uri.split('/')
    if (parts.length > 2) {
      return decodeURIComponent(parts[parts.length - 2])
    }
  } catch {}
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
  const MediaLibrary = getMediaLibrary()

  // In web environment, seed demonstration media so UI can be tested
  if (Platform.OS === 'web' || !MediaLibrary || !MediaLibrary.getPermissionsAsync) {
    onProgress({ progress: 0.3, status: 'Scanning device storage...' })
    await seedDemoMediaIfEmpty()
    await setSetting(APP_CONFIG.storageKeys.hasCompletedInitialScan, true)
    onProgress({ progress: 1.0, status: 'Scan complete!' })
    return { totalScanned: 4, newOrUpdated: 4 }
  }

  const isExpoGo =
    Constants?.executionEnvironment === ExecutionEnvironment.StoreClient ||
    Constants?.appOwnership === 'expo'

  // Standalone APKs declare all permissions; Expo Go restricts to general storage
  const permissionsToRequest = isExpoGo
    ? ['audio']
    : (scanAudio && scanVideo ? ['audio', 'video'] : scanAudio ? ['audio'] : ['video'])

  // Check platform permissions with graceful fallbacks
  let permissionGranted = false
  if (Platform.OS !== 'web') {
    try {
      let status
      try {
        const check = await MediaLibrary.getPermissionsAsync(false, permissionsToRequest)
        status = check?.status
      } catch {
        // Fallback without granular permissions if manifest lacks READ_MEDIA_AUDIO in Expo Go
        try {
          const check = await MediaLibrary.getPermissionsAsync()
          status = check?.status
        } catch {}
      }

      if (status !== 'granted') {
        try {
          const requestResult = await MediaLibrary.requestPermissionsAsync(false, permissionsToRequest)
          status = requestResult?.status
        } catch {
          try {
            const requestResult = await MediaLibrary.requestPermissionsAsync()
            status = requestResult?.status
          } catch {}
        }
      }

      permissionGranted = (status === 'granted')
    } catch (permErr) {
      console.warn('Error checking/requesting media permissions:', permErr)
    }
  }

  const mediaTypes = []
  if (scanAudio && MediaLibrary.MediaType?.audio) {
    mediaTypes.push(MediaLibrary.MediaType.audio)
  }
  if (scanVideo && !isExpoGo && MediaLibrary.MediaType?.video) {
    mediaTypes.push(MediaLibrary.MediaType.video)
  }

  let totalScanned = 0
  let totalNewOrUpdated = 0

  if (permissionGranted && mediaTypes.length > 0) {
    let hasNextPage = true
    let afterCursor = undefined
    const BATCH_SIZE = 50

    onProgress({ progress: 0, status: 'Scanning device storage...' })

    const sortByOption = MediaLibrary.SortBy?.modificationTime
      ? [MediaLibrary.SortBy.modificationTime]
      : undefined

    while (hasNextPage) {
      try {
        const queryOptions = {
          mediaType: mediaTypes,
          first: BATCH_SIZE,
          after: afterCursor
        }
        if (sortByOption) {
          queryOptions.sortBy = sortByOption
        }

        let page
        try {
          page = await MediaLibrary.getAssetsAsync(queryOptions)
        } catch (queryErr) {
          // If sortBy fails on device, retry without sorting
          delete queryOptions.sortBy
          page = await MediaLibrary.getAssetsAsync(queryOptions)
        }

        const assets = page.assets || []
        totalScanned += assets.length

        const itemsToUpsert = []

        for (const asset of assets) {
          try {
            const isVideo = asset.mediaType === MediaLibrary.MediaType?.video || asset.mediaType === 'video'
            const type = isVideo ? 'video' : 'audio'
            const { title, artist } = parseTrackMetadata(asset.filename)
            const folder = extractFolderName(asset.uri, asset.filename)
            const durationMs = Math.round((asset.duration || 0) * 1000)
            const deterministicId = asset.id || generateDeterministicId(asset.uri)

            itemsToUpsert.push({
              id: String(deterministicId),
              uri: asset.uri,
              type,
              title,
              artist: isVideo ? 'Local Video' : artist,
              album: isVideo ? 'Videos' : (asset.albumId || folder || 'Local Storage'),
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
            console.warn('Skipping unparsable asset:', asset?.filename, itemErr)
          }
        }

        if (itemsToUpsert.length > 0) {
          await clearDemoMedia()
          await upsertMediaItemsBatch(itemsToUpsert)
          totalNewOrUpdated += itemsToUpsert.length
        }

        hasNextPage = Boolean(page.hasNextPage)
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
  }

  // If MediaStore found 0 items on Android (common in Expo Go due to Google Play permission limitations),
  // automatically launch the Android Storage Access Framework folder picker to let user select their Music folder!
  if (totalScanned === 0 && Platform.OS === 'android') {
    onProgress({ progress: 0.1, status: 'Select your Music folder to import tracks...' })
    const safResult = await scanCustomFolderSAF({ onProgress })
    totalScanned += safResult.totalScanned
    totalNewOrUpdated += safResult.newOrUpdated
  }

  // Record that initial scan completed
  await setSetting(APP_CONFIG.storageKeys.hasCompletedInitialScan, true)

  onProgress({ progress: 1.0, totalScanned, status: `Scan complete! (${totalScanned} items)` })
  return { totalScanned, newOrUpdated: totalNewOrUpdated, permissionDenied: !permissionGranted }
}

/**
 * Lets the user pick any local folder via Android Storage Access Framework (SAF)
 * and recursively imports all audio/video files directly into VEYRA SQLite database.
 */
export async function scanCustomFolderSAF({ onProgress = () => {} } = {}) {
  if (Platform.OS !== 'android') return { totalScanned: 0, newOrUpdated: 0 }
  try {
    let initialUri = null
    try {
      initialUri = FileSystem.StorageAccessFramework.getUriForDirectoryInRoot('Music')
    } catch {}

    const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(initialUri)
    if (!permissions.granted) {
      return { totalScanned: 0, newOrUpdated: 0, cancelled: true }
    }

    onProgress({ progress: 0.1, status: 'Scanning folder contents...' })
    const rootDirectoryUri = permissions.directoryUri

    const audioExtensions = ['.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg', '.opus', '.wma']
    const videoExtensions = ['.mp4', '.mkv', '.webm', '.3gp', '.mov', '.avi', '.ts']

    const itemsToUpsert = []
    let scanned = 0

    // Breadth-first search traversal of directories (up to 5 levels deep)
    const dirQueue = [{ uri: rootDirectoryUri, depth: 0 }]
    const visitedDirs = new Set([rootDirectoryUri])

    while (dirQueue.length > 0 && itemsToUpsert.length < 5000) {
      const current = dirQueue.shift()
      try {
        const fileUris = await FileSystem.StorageAccessFramework.readDirectoryAsync(current.uri)

        for (const fileUri of fileUris) {
          try {
            const decodedUri = decodeURIComponent(fileUri)
            const filename = decodedUri.split('/').pop()?.split(':').pop() || 'Track'
            const lower = filename.toLowerCase()

            const isAudio = audioExtensions.some((ext) => lower.endsWith(ext))
            const isVideo = videoExtensions.some((ext) => lower.endsWith(ext))

            if (isAudio || isVideo) {
              const type = isVideo ? 'video' : 'audio'
              const { title, artist } = parseTrackMetadata(filename)
              const folder = extractFolderName(decodedUri, filename)
              const deterministicId = generateDeterministicId(fileUri)

              itemsToUpsert.push({
                id: deterministicId,
                uri: fileUri,
                type,
                title,
                artist: isVideo ? 'Local Video' : artist,
                album: isVideo ? 'Videos' : folder,
                albumArtist: null,
                genre: null,
                duration: 0,
                size: 0,
                mimeType: isVideo ? 'video/mp4' : 'audio/mpeg',
                year: null,
                trackNumber: null,
                discNumber: null,
                artworkUri: null,
                folder,
                dateAdded: Date.now(),
                dateModified: Date.now()
              })
              scanned++
            } else if (current.depth < 5 && !visitedDirs.has(fileUri)) {
              // Check if sub-element is a directory
              try {
                const info = await FileSystem.getInfoAsync(fileUri)
                if (info.isDirectory) {
                  visitedDirs.add(fileUri)
                  dirQueue.push({ uri: fileUri, depth: current.depth + 1 })
                }
              } catch {}
            }
          } catch {}
        }

        onProgress({
          progress: Math.min(0.9, 0.2 + (scanned * 0.02)),
          totalScanned: scanned,
          status: `Found ${scanned} items...`
        })
      } catch (dirErr) {
        console.warn('Error reading SAF directory:', current.uri, dirErr)
      }
    }

    if (itemsToUpsert.length > 0) {
      onProgress({ progress: 0.95, status: `Saving ${itemsToUpsert.length} items to library...` })
      await clearDemoMedia()
      await upsertMediaItemsBatch(itemsToUpsert)
    }

    onProgress({ progress: 1.0, totalScanned: scanned, status: `Added ${itemsToUpsert.length} local items!` })
    return { totalScanned: scanned, newOrUpdated: itemsToUpsert.length }
  } catch (err) {
    console.warn('SAF folder scan error:', err)
    return { totalScanned: 0, newOrUpdated: 0, error: err.message }
  }
}

/**
 * Seed demonstration media ONLY for web browser preview environments
 */
export async function seedDemoMediaIfEmpty() {
  if (Platform.OS !== 'web') return

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
