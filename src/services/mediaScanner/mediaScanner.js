import { Platform, PermissionsAndroid } from 'react-native'
import Constants, { ExecutionEnvironment } from 'expo-constants'
import { requireOptionalNativeModule } from 'expo-modules-core'
import * as FileSystemLegacy from 'expo-file-system/legacy'
import * as FileSystemModern from 'expo-file-system'
import {
  upsertMediaItemsBatch,
  getAllMediaItems,
  setSetting,
  getSetting,
  clearDemoMedia
} from '../../database/db'
import { APP_CONFIG } from '../../constants/config'

function getSAF() {
  return FileSystemLegacy.StorageAccessFramework || null
}

/**
 * Resolves the legacy MediaLibrary module that exposes getAssetsAsync
 */
function getLegacyMediaLibrary() {
  if (Platform.OS === 'web') return null
  try {
    const legacyModule = require('expo-media-library/legacy')
    if (legacyModule && typeof legacyModule.getAssetsAsync === 'function') {
      return legacyModule
    }
  } catch {}
  return null
}

/**
 * Resolves the modern MediaLibrary module that exposes the Query class
 */
function getNextMediaLibrary() {
  if (Platform.OS === 'web') return null
  try {
    const mod = require('expo-media-library')
    if (mod && mod.Query) {
      return mod
    }
  } catch {}
  return null
}

/**
 * Requests Android device storage & media permissions through both
 * PermissionsAndroid and Expo MediaLibrary for 100% platform coverage.
 */
export async function requestMediaPermissions({ scanAudio = true, scanVideo = true } = {}) {
  if (Platform.OS === 'web') return true

  let granted = false

  // 1. Android Native Runtime Permissions via PermissionsAndroid
  if (Platform.OS === 'android') {
    try {
      if (Platform.Version >= 33) {
        /** @type {import('react-native').Permission[]} */
        const permsToAsk = []
        if (scanAudio) permsToAsk.push(PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO)
        if (scanVideo) permsToAsk.push(PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO)

        const result = await PermissionsAndroid.requestMultiple(permsToAsk)
        const allGranted = permsToAsk.every(
          (perm) => result[perm] === PermissionsAndroid.RESULTS.GRANTED
        )
        if (allGranted) granted = true
      } else {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
        )
        if (result === PermissionsAndroid.RESULTS.GRANTED) granted = true
      }
    } catch (err) {
      console.warn('PermissionsAndroid request error:', err)
    }
  }

  // 2. Sync with Expo MediaLibrary permission hook
  try {
    const ml = getLegacyMediaLibrary() || getNextMediaLibrary()
    if (ml?.requestPermissionsAsync) {
      /** @type {import('expo-media-library/legacy').GranularPermission[]} */
      const granular = []
      if (scanAudio) granular.push('audio')
      if (scanVideo) granular.push('video')
      const res = await ml.requestPermissionsAsync(false, granular)
      if (res?.status === 'granted') granted = true
    }
  } catch (expoErr) {
    try {
      const ml = getLegacyMediaLibrary() || getNextMediaLibrary()
      if (ml?.requestPermissionsAsync) {
        const res = await ml.requestPermissionsAsync(false, ['audio'])
        if (res?.status === 'granted') granted = true
      }
    } catch {}
  }

  // Also check existing status
  if (!granted) {
    try {
      const ml = getLegacyMediaLibrary() || getNextMediaLibrary()
      if (ml?.getPermissionsAsync) {
        const check = await ml.getPermissionsAsync(false, ['audio'])
        if (check?.status === 'granted') granted = true
      }
    } catch {}
  }

  return granted
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
    let decoded = uri
    try {
      decoded = decodeURIComponent(uri)
    } catch {}
    const parts = decoded.split('/')
    if (parts.length > 2) {
      const parent = parts[parts.length - 2]
      if (parent && !parent.includes(':')) {
        return parent
      }
      if (parent && parent.includes(':')) {
        return parent.split(':').pop() || 'Music'
      }
    }
  } catch {}
  return 'Music'
}

/**
 * Robust filename extraction from SAF or document URIs
 */
function extractFilenameFromSAFUri(fileUri) {
  if (!fileUri) return 'Track'
  try {
    let decoded = fileUri
    try {
      decoded = decodeURIComponent(fileUri)
      if (decoded.includes('%')) {
        decoded = decodeURIComponent(decoded)
      }
    } catch {}

    const slashParts = decoded.split('/')
    let segment = slashParts[slashParts.length - 1] || ''
    if (segment.includes(':')) {
      segment = segment.split(':').pop() || segment
    }
    return segment || 'Track'
  } catch {
    return 'Track'
  }
}

/**
 * Asynchronous, incremental media scanner for local device storage (MediaStore).
 */
export async function scanLocalMedia({
  onProgress = (_progress) => {},
  scanAudio = true,
  scanVideo = true,
  forceFullRescan = false
} = {}) {
  // In web environment, seed demonstration media so UI can be tested
  if (Platform.OS === 'web') {
    onProgress({ progress: 0.3, status: 'Scanning web environment...' })
    await seedDemoMediaIfEmpty()
    await setSetting(APP_CONFIG.storageKeys.hasCompletedInitialScan, true)
    onProgress({ progress: 1.0, status: 'Scan complete!' })
    return { totalScanned: 4, newOrUpdated: 4, permissionDenied: false }
  }

  onProgress({ progress: 0.05, status: 'Checking media permissions...' })
  const permissionGranted = await requestMediaPermissions({ scanAudio, scanVideo })

  if (!permissionGranted) {
    onProgress({ progress: 1.0, totalScanned: 0, status: 'Storage permission required' })
    return { totalScanned: 0, newOrUpdated: 0, permissionDenied: true }
  }

  const isExpoGo =
    Constants?.executionEnvironment === ExecutionEnvironment.StoreClient ||
    Constants?.appOwnership === 'expo'

  let totalScanned = 0
  let totalNewOrUpdated = 0

  // -------------------------------------------------------------
  // Strategy 1: Expo MediaLibrary Legacy (getAssetsAsync via MediaStore)
  // -------------------------------------------------------------
  const LegacyML = getLegacyMediaLibrary()
  if (LegacyML && typeof LegacyML.getAssetsAsync === 'function') {
    /** @type {import('expo-media-library/legacy').MediaTypeValue[]} */
    const mediaTypes = []
    if (scanAudio && LegacyML.MediaType?.audio) {
      mediaTypes.push(LegacyML.MediaType.audio)
    }
    if (scanVideo && !isExpoGo && LegacyML.MediaType?.video) {
      mediaTypes.push(LegacyML.MediaType.video)
    }

    if (mediaTypes.length > 0) {
      let hasNextPage = true
      let afterCursor = undefined
      const BATCH_SIZE = 100

      onProgress({ progress: 0.1, status: 'Querying device media library...' })

      const sortByOption = LegacyML.SortBy?.modificationTime
        ? [LegacyML.SortBy.modificationTime]
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
            page = await LegacyML.getAssetsAsync(queryOptions)
          } catch (queryErr) {
            delete queryOptions.sortBy
            page = await LegacyML.getAssetsAsync(queryOptions)
          }

          const assets = page?.assets || []
          totalScanned += assets.length

          const itemsToUpsert = []
          for (const asset of assets) {
            try {
              const isVideo =
                asset.mediaType === 'video'
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
                album: isVideo ? 'Videos' : (asset.albumId || folder || 'Local Music'),
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
                dateAdded: asset.creationTime ? asset.creationTime : Date.now(),
                dateModified: asset.modificationTime ? asset.modificationTime : Date.now()
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

          hasNextPage = Boolean(page?.hasNextPage)
          afterCursor = page?.endCursor

          onProgress({
            progress: Math.min(0.9, totalScanned / Math.max(page?.totalCount || 1, totalScanned)),
            totalScanned,
            status: `Found ${totalScanned} items...`
          })
        } catch (pageErr) {
          console.warn('Media scan page error in LegacyML:', pageErr)
          break
        }
      }
    }
  }

  // -------------------------------------------------------------
  // Strategy 2: Modern ExpoMediaLibrary Query API (if Strategy 1 found 0)
  // -------------------------------------------------------------
  if (totalScanned === 0) {
    const NextML = getNextMediaLibrary()
    if (NextML && NextML.Query) {
      try {
        onProgress({ progress: 0.15, status: 'Scanning media catalog...' })
        const typesToQuery = []
        if (scanAudio && NextML.MediaType?.AUDIO) typesToQuery.push(NextML.MediaType.AUDIO)
        if (scanVideo && !isExpoGo && NextML.MediaType?.VIDEO) typesToQuery.push(NextML.MediaType.VIDEO)

        if (typesToQuery.length > 0) {
          const query = new NextML.Query().within(NextML.AssetField.MEDIA_TYPE, typesToQuery)
          const assets = await query.exe()

          if (assets && assets.length > 0) {
            totalScanned += assets.length
            const itemsToUpsert = []

            for (const asset of assets) {
              try {
                const uri = await asset.getUri().catch(() => asset.id)
                const filename = await asset.getFilename().catch(() => 'Track')
                const duration = await asset.getDuration().catch(() => 0)
                const mediaType = await asset.getMediaType().catch(() => 'audio')
                const modTime = await asset.getModificationTime().catch(() => Date.now())

                const isVideo = mediaType === 'video'
                const type = isVideo ? 'video' : 'audio'
                const { title, artist } = parseTrackMetadata(filename)
                const folder = extractFolderName(uri, filename)
                const durationMs = Math.round(duration || 0)
                const deterministicId = asset.id || generateDeterministicId(uri)

                itemsToUpsert.push({
                  id: String(deterministicId),
                  uri,
                  type,
                  title,
                  artist: isVideo ? 'Local Video' : artist,
                  album: isVideo ? 'Videos' : (folder || 'Local Music'),
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
                  dateAdded: Date.now(),
                  dateModified: modTime || Date.now()
                })
              } catch (itemErr) {
                console.warn('Error reading asset from NextML:', itemErr)
              }
            }

            if (itemsToUpsert.length > 0) {
              await clearDemoMedia()
              await upsertMediaItemsBatch(itemsToUpsert)
              totalNewOrUpdated += itemsToUpsert.length
            }
          }
        }
      } catch (nextErr) {
        console.warn('NextML Query error:', nextErr)
      }
    }
  }

  // Record that initial scan completed
  await setSetting(APP_CONFIG.storageKeys.hasCompletedInitialScan, true)

  const finalStatus =
    totalScanned > 0
      ? `Scan complete! (${totalScanned} items indexed)`
      : 'Scan complete. No media found in system catalog.'

  onProgress({ progress: 1.0, totalScanned, status: finalStatus })
  return {
    totalScanned,
    newOrUpdated: totalNewOrUpdated,
    permissionDenied: false,
    isEmpty: totalScanned === 0
  }
}

/**
 * Lets the user pick specific audio/video files directly from anywhere on their device
 * (including Downloads folder, SD card, Drive) without any Android SAF folder restrictions.
 */
export async function pickFilesAndImport({ onProgress = (_progress) => {}, mediaType = null } = {}) {
  if (Platform.OS === 'web') return { totalScanned: 0, newOrUpdated: 0 }

  try {
    onProgress({ progress: 0.1, status: 'Opening file picker...' })

    const ExpoFile = FileSystemModern?.File
    if (!ExpoFile || !ExpoFile.pickFileAsync) {
      return { totalScanned: 0, newOrUpdated: 0, error: 'File picker unavailable' }
    }

    const pickResult = await ExpoFile.pickFileAsync({
      multipleFiles: true,
      mimeTypes: mediaType === 'audio' ? ['audio/*'] : mediaType === 'video' ? ['video/*'] : ['audio/*', 'video/*']
    })

    if (!pickResult || pickResult.canceled) {
      return { totalScanned: 0, newOrUpdated: 0, cancelled: true }
    }

    const files = Array.isArray(pickResult.result) ? pickResult.result : [pickResult.result]
    if (files.length === 0) {
      return { totalScanned: 0, newOrUpdated: 0 }
    }

    onProgress({ progress: 0.3, status: `Importing ${files.length} selected files...` })

    const audioExtensions = ['.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg', '.opus', '.wma']
    const videoExtensions = ['.mp4', '.mkv', '.webm', '.3gp', '.mov', '.avi', '.ts']

    const itemsToUpsert = []
    for (const file of files) {
      try {
        const name = file.name || extractFilenameFromSAFUri(file.uri) || 'Imported Media'
        const lower = name.toLowerCase()
        const isVideo = videoExtensions.some((ext) => lower.endsWith(ext))
        const isAudio = !isVideo
        const type = isVideo ? 'video' : 'audio'
        const { title, artist } = parseTrackMetadata(name)
        const deterministicId = generateDeterministicId(file.uri)

        itemsToUpsert.push({
          id: deterministicId,
          uri: file.uri,
          type,
          title,
          artist: isAudio ? artist : 'Local Video',
          album: isAudio ? 'Imported Music' : 'Imported Videos',
          albumArtist: null,
          genre: null,
          duration: 0,
          size: file.size || 0,
          mimeType: isAudio ? 'audio/mpeg' : 'video/mp4',
          year: null,
          trackNumber: null,
          discNumber: null,
          artworkUri: null,
          folder: 'Imported',
          dateAdded: Date.now(),
          dateModified: Date.now()
        })
      } catch (itemErr) {
        console.warn('Error parsing picked file:', itemErr)
      }
    }

    if (itemsToUpsert.length > 0) {
      await clearDemoMedia()
      await upsertMediaItemsBatch(itemsToUpsert)
    }

    onProgress({
      progress: 1.0,
      totalScanned: itemsToUpsert.length,
      status: `Imported ${itemsToUpsert.length} items!`
    })
    return { totalScanned: itemsToUpsert.length, newOrUpdated: itemsToUpsert.length }
  } catch (err) {
    console.warn('Error in pickFilesAndImport:', err)
    return { totalScanned: 0, newOrUpdated: 0, error: err?.message || String(err) }
  }
}

/**
 * Lets the user pick any local folder via Android Storage Access Framework (SAF)
 * or modern FileSystem Directory picker, and recursively imports all audio/video files.
 */
export async function scanCustomFolderSAF({ onProgress = (_progress) => {} } = {}) {
  if (Platform.OS !== 'android') return { totalScanned: 0, newOrUpdated: 0 }

  const audioExtensions = ['.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg', '.opus', '.wma']
  const videoExtensions = ['.mp4', '.mkv', '.webm', '.3gp', '.mov', '.avi', '.ts']

  // -------------------------------------------------------------
  // Approach 1: Modern FileSystem Directory picker (SDK 53+)
  // -------------------------------------------------------------
  try {
    const ExpoDirectory = FileSystemModern?.Directory
    if (ExpoDirectory && ExpoDirectory.pickDirectoryAsync) {
      onProgress({ progress: 0.05, status: 'Select your Music folder...' })
      let rootDir = null
      try {
        rootDir = await ExpoDirectory.pickDirectoryAsync()
      } catch (pickErr) {
        return { totalScanned: 0, newOrUpdated: 0, cancelled: true }
      }

      if (rootDir && rootDir.uri) {
        onProgress({ progress: 0.2, status: 'Scanning folder contents...' })
        const itemsToUpsert = []
        const dirQueue = [rootDir]
        let scanned = 0

        while (dirQueue.length > 0 && itemsToUpsert.length < 5000) {
          const current = dirQueue.shift()
          try {
            const entries = current.list()
            for (const entry of entries) {
              try {
                if (
                  entry instanceof ExpoDirectory
                ) {
                  dirQueue.push(entry)
                } else {
                  const name = entry.name || extractFilenameFromSAFUri(entry.uri)
                  const lower = name.toLowerCase()
                  const isAudio = audioExtensions.some((ext) => lower.endsWith(ext))
                  const isVideo = videoExtensions.some((ext) => lower.endsWith(ext))

                  if (isAudio || isVideo) {
                    const type = isVideo ? 'video' : 'audio'
                    const { title, artist } = parseTrackMetadata(name)
                    const folder = current.name || 'Custom Folder'
                    const deterministicId = generateDeterministicId(entry.uri)

                    itemsToUpsert.push({
                      id: deterministicId,
                      uri: entry.uri,
                      type,
                      title,
                      artist: isVideo ? 'Local Video' : artist,
                      album: isVideo ? 'Videos' : folder,
                      albumArtist: null,
                      genre: null,
                      duration: 0,
                      size: entry.size || 0,
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
                  }
                }
              } catch {}
            }
          } catch (dirErr) {
            console.warn('Error reading modern Directory:', dirErr)
          }
        }

        if (itemsToUpsert.length > 0) {
          await clearDemoMedia()
          await upsertMediaItemsBatch(itemsToUpsert)
        }

        onProgress({
          progress: 1.0,
          totalScanned: scanned,
          status: `Added ${itemsToUpsert.length} local items!`
        })
        return { totalScanned: scanned, newOrUpdated: itemsToUpsert.length }
      }
    }
  } catch (modernErr) {
    console.warn('Directory.pickDirectoryAsync fallback to SAF:', modernErr)
  }

  // -------------------------------------------------------------
  // Approach 2: StorageAccessFramework (SAF) fallback
  // -------------------------------------------------------------
  const SAF = getSAF()
  if (!SAF || !SAF.requestDirectoryPermissionsAsync) {
    return { totalScanned: 0, newOrUpdated: 0, error: 'StorageAccessFramework unavailable' }
  }

  try {
    let initialUri = null
    try {
      initialUri = SAF.getUriForDirectoryInRoot('Music')
    } catch {}

    const permissions = await SAF.requestDirectoryPermissionsAsync(initialUri)
    if (!permissions.granted) {
      return { totalScanned: 0, newOrUpdated: 0, cancelled: true }
    }

    onProgress({ progress: 0.1, status: 'Scanning folder contents...' })
    const rootDirectoryUri = permissions.directoryUri

    const itemsToUpsert = []
    let scanned = 0
    const dirQueue = [{ uri: rootDirectoryUri, depth: 0 }]
    const visitedDirs = new Set([rootDirectoryUri])

    while (dirQueue.length > 0 && itemsToUpsert.length < 5000) {
      const current = dirQueue.shift()
      try {
        const fileUris = await SAF.readDirectoryAsync(current.uri)

        for (const fileUri of fileUris) {
          try {
            const filename = extractFilenameFromSAFUri(fileUri)
            const lower = filename.toLowerCase()

            const isAudio = audioExtensions.some((ext) => lower.endsWith(ext))
            const isVideo = videoExtensions.some((ext) => lower.endsWith(ext))

            if (isAudio || isVideo) {
              const type = isVideo ? 'video' : 'audio'
              const { title, artist } = parseTrackMetadata(filename)
              const folder = extractFolderName(fileUri, filename)
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
              // Check if sub-element might be a directory
              const dotIdx = filename.lastIndexOf('.')
              const looksLikeFileWithExt = dotIdx !== -1 && filename.length - dotIdx <= 5
              if (!looksLikeFileWithExt) {
                visitedDirs.add(fileUri)
                try {
                  const subFiles = await SAF.readDirectoryAsync(fileUri)
                  if (Array.isArray(subFiles)) {
                    dirQueue.push({ uri: fileUri, depth: current.depth + 1 })
                  }
                } catch {}
              }
            }
          } catch {}
        }

        onProgress({
          progress: Math.min(0.9, 0.2 + scanned * 0.02),
          totalScanned: scanned,
          status: `Found ${scanned} items...`
        })
      } catch (dirErr) {
        console.warn('SAF read directory error:', current.uri, dirErr)
      }
    }

    if (itemsToUpsert.length > 0) {
      await clearDemoMedia()
      await upsertMediaItemsBatch(itemsToUpsert)
    }

    onProgress({
      progress: 1.0,
      totalScanned: scanned,
      status: `Added ${itemsToUpsert.length} local items!`
    })
    return { totalScanned: scanned, newOrUpdated: itemsToUpsert.length }
  } catch (err) {
    console.warn('SAF folder scan error:', err)
    return { totalScanned: 0, newOrUpdated: 0, error: err?.message || String(err) }
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
