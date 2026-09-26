import * as SQLite from 'expo-sqlite'
import { Platform } from 'react-native'
import { TABLE_STATEMENTS } from './schema'
import { APP_CONFIG } from '../constants/config'

let dbInstance = null

export async function getDatabase() {
  if (!dbInstance) {
    const dbName = Platform.OS === 'web' ? ':memory:' : APP_CONFIG.database.name
    dbInstance = await SQLite.openDatabaseAsync(dbName)
    try {
      await dbInstance.execAsync('PRAGMA foreign_keys = ON;')
    } catch {}
    for (const sql of TABLE_STATEMENTS) {
      try {
        await dbInstance.execAsync(sql)
      } catch (err) {
        console.warn('DB init statement error:', err)
      }
    }
  }
  return dbInstance
}

// ----------------- Media Items Repository -----------------

export async function upsertMediaItem(item) {
  const db = await getDatabase()
  const sql = `
    INSERT INTO media_items (
      id, uri, type, title, artist, album, albumArtist, genre,
      duration, size, mimeType, year, trackNumber, discNumber,
      artworkUri, folder, dateAdded, dateModified
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      uri=excluded.uri,
      title=excluded.title,
      artist=excluded.artist,
      album=excluded.album,
      albumArtist=excluded.albumArtist,
      genre=excluded.genre,
      duration=excluded.duration,
      size=excluded.size,
      mimeType=excluded.mimeType,
      year=excluded.year,
      trackNumber=excluded.trackNumber,
      discNumber=excluded.discNumber,
      artworkUri=excluded.artworkUri,
      folder=excluded.folder,
      dateModified=excluded.dateModified;
  `
  await db.runAsync(sql, [
    item.id,
    item.uri,
    item.type,
    item.title || 'Unknown Title',
    item.artist || 'Unknown Artist',
    item.album || 'Unknown Album',
    item.albumArtist || null,
    item.genre || null,
    item.duration || 0,
    item.size || 0,
    item.mimeType || null,
    item.year || null,
    item.trackNumber || null,
    item.discNumber || null,
    item.artworkUri || null,
    item.folder || null,
    item.dateAdded || Date.now(),
    item.dateModified || Date.now()
  ])
}

export async function upsertMediaItemsBatch(items) {
  if (!items || items.length === 0) return
  const db = await getDatabase()
  await db.withTransactionAsync(async () => {
    for (const item of items) {
      await upsertMediaItem(item)
    }
  })
}

export async function getAllMediaItems({
  type = 'audio',
  sortBy = 'title',
  order = 'ASC',
  limit = 200,
  offset = 0,
  artist = null,
  album = null,
  folder = null,
  genre = null
} = {}) {
  const db = await getDatabase()
  const conditions = ['type = ?']
  const params = [type]

  if (artist) {
    conditions.push('artist = ?')
    params.push(artist)
  }
  if (album) {
    conditions.push('album = ?')
    params.push(album)
  }
  if (folder) {
    conditions.push('folder = ?')
    params.push(folder)
  }
  if (genre) {
    conditions.push('genre = ?')
    params.push(genre)
  }

  const validSortColumns = ['title', 'artist', 'album', 'duration', 'dateAdded', 'year', 'size']
  const sortCol = validSortColumns.includes(sortBy) ? sortBy : 'title'
  const sortOrder = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'

  const sql = `
    SELECT * FROM media_items
    WHERE ${conditions.join(' AND ')}
    ORDER BY ${sortCol} COLLATE NOCASE ${sortOrder}
    LIMIT ? OFFSET ?
  `
  params.push(limit, offset)

  return await db.getAllAsync(sql, params)
}

export async function getMediaItemById(id) {
  const db = await getDatabase()
  return await db.getFirstAsync('SELECT * FROM media_items WHERE id = ?', [id])
}

export async function searchMedia(query, limit = 50) {
  if (!query || query.trim().length === 0) return { songs: [], videos: [], artists: [], albums: [] }
  const db = await getDatabase()
  const term = `%${query.trim()}%`

  const songs = await db.getAllAsync(
    `SELECT * FROM media_items
     WHERE type = 'audio' AND (title LIKE ? OR artist LIKE ? OR album LIKE ? OR folder LIKE ?)
     ORDER BY title COLLATE NOCASE ASC LIMIT ?`,
    [term, term, term, term, limit]
  )

  const videos = await db.getAllAsync(
    `SELECT * FROM media_items
     WHERE type = 'video' AND (title LIKE ? OR folder LIKE ?)
     ORDER BY title COLLATE NOCASE ASC LIMIT ?`,
    [term, term, limit]
  )

  const artists = await db.getAllAsync(
    `SELECT DISTINCT artist as name, COUNT(*) as trackCount
     FROM media_items
     WHERE type = 'audio' AND artist LIKE ? AND artist != 'Unknown Artist'
     GROUP BY artist
     ORDER BY artist COLLATE NOCASE ASC LIMIT ?`,
    [term, limit]
  )

  const albums = await db.getAllAsync(
    `SELECT DISTINCT album as title, artist, artworkUri, COUNT(*) as trackCount
     FROM media_items
     WHERE type = 'audio' AND album LIKE ? AND album != 'Unknown Album'
     GROUP BY album, artist
     ORDER BY album COLLATE NOCASE ASC LIMIT ?`,
    [term, limit]
  )

  return { songs, videos, artists, albums }
}

export async function getArtistsSummary() {
  const db = await getDatabase()
  return await db.getAllAsync(
    `SELECT artist as name, COUNT(*) as trackCount, COUNT(DISTINCT album) as albumCount
     FROM media_items
     WHERE type = 'audio'
     GROUP BY artist
     ORDER BY artist COLLATE NOCASE ASC`
  )
}

export async function getAlbumsSummary() {
  const db = await getDatabase()
  return await db.getAllAsync(
    `SELECT album as title, artist, artworkUri, COUNT(*) as trackCount, MAX(year) as year
     FROM media_items
     WHERE type = 'audio'
     GROUP BY album, artist
     ORDER BY album COLLATE NOCASE ASC`
  )
}

export async function getGenresSummary() {
  const db = await getDatabase()
  return await db.getAllAsync(
    `SELECT genre, COUNT(*) as trackCount
     FROM media_items
     WHERE type = 'audio' AND genre IS NOT NULL AND genre != ''
     GROUP BY genre
     ORDER BY genre COLLATE NOCASE ASC`
  )
}

export async function getFoldersSummary(type = 'audio') {
  const db = await getDatabase()
  return await db.getAllAsync(
    `SELECT folder, COUNT(*) as mediaCount
     FROM media_items
     WHERE type = ? AND folder IS NOT NULL
     GROUP BY folder
     ORDER BY folder COLLATE NOCASE ASC`,
    [type]
  )
}

export async function getRecentlyAdded(type = 'audio', limit = 20) {
  const db = await getDatabase()
  return await db.getAllAsync(
    `SELECT * FROM media_items
     WHERE type = ?
     ORDER BY dateAdded DESC
     LIMIT ?`,
    [type, limit]
  )
}

// ----------------- Playlists Repository -----------------

export async function createPlaylist(name) {
  const db = await getDatabase()
  const id = `pl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  const now = Date.now()
  await db.runAsync(
    'INSERT INTO playlists (id, name, createdAt, updatedAt, itemCount) VALUES (?, ?, ?, ?, 0)',
    [id, name.trim(), now, now]
  )
  return { id, name: name.trim(), createdAt: now, updatedAt: now, itemCount: 0 }
}

export async function renamePlaylist(id, newName) {
  const db = await getDatabase()
  const now = Date.now()
  await db.runAsync(
    'UPDATE playlists SET name = ?, updatedAt = ? WHERE id = ?',
    [newName.trim(), now, id]
  )
}

export async function deletePlaylist(id) {
  const db = await getDatabase()
  await db.runAsync('DELETE FROM playlists WHERE id = ?', [id])
}

export async function getPlaylists() {
  const db = await getDatabase()
  return await db.getAllAsync('SELECT * FROM playlists ORDER BY name COLLATE NOCASE ASC')
}

export async function addItemsToPlaylist(playlistId, mediaIds) {
  if (!mediaIds || mediaIds.length === 0) return
  const db = await getDatabase()
  const now = Date.now()

  await db.withTransactionAsync(async () => {
    const lastSortResult = await db.getFirstAsync(
      'SELECT MAX(sortOrder) as maxSort FROM playlist_items WHERE playlistId = ?',
      [playlistId]
    )
    let currentSort = (lastSortResult?.maxSort ?? -1) + 1

    for (const mediaId of mediaIds) {
      const itemId = `pi_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      await db.runAsync(
        'INSERT INTO playlist_items (id, playlistId, mediaId, sortOrder, addedAt) VALUES (?, ?, ?, ?, ?)',
        [itemId, playlistId, mediaId, currentSort++, now]
      )
    }

    const countResult = await db.getFirstAsync(
      'SELECT COUNT(*) as count FROM playlist_items WHERE playlistId = ?',
      [playlistId]
    )
    await db.runAsync(
      'UPDATE playlists SET itemCount = ?, updatedAt = ? WHERE id = ?',
      [countResult?.count || 0, now, playlistId]
    )
  })
}

export async function removeItemFromPlaylist(playlistId, mediaId) {
  const db = await getDatabase()
  const now = Date.now()
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM playlist_items WHERE playlistId = ? AND mediaId = ?', [playlistId, mediaId])
    const countResult = await db.getFirstAsync(
      'SELECT COUNT(*) as count FROM playlist_items WHERE playlistId = ?',
      [playlistId]
    )
    await db.runAsync(
      'UPDATE playlists SET itemCount = ?, updatedAt = ? WHERE id = ?',
      [countResult?.count || 0, now, playlistId]
    )
  })
}

export async function getPlaylistItems(playlistId) {
  const db = await getDatabase()
  return await db.getAllAsync(
    `SELECT m.*, pi.sortOrder, pi.id as playlistItemId
     FROM playlist_items pi
     JOIN media_items m ON pi.mediaId = m.id
     WHERE pi.playlistId = ?
     ORDER BY pi.sortOrder ASC`,
    [playlistId]
  )
}

// ----------------- Favorites Repository -----------------

export async function toggleFavorite(mediaId, type = 'audio') {
  const db = await getDatabase()
  const existing = await db.getFirstAsync('SELECT * FROM favorites WHERE mediaId = ?', [mediaId])
  if (existing) {
    await db.runAsync('DELETE FROM favorites WHERE mediaId = ?', [mediaId])
    return false
  } else {
    await db.runAsync(
      'INSERT INTO favorites (mediaId, type, addedAt) VALUES (?, ?, ?)',
      [mediaId, type, Date.now()]
    )
    return true
  }
}

export async function isFavorite(mediaId) {
  const db = await getDatabase()
  const existing = await db.getFirstAsync('SELECT mediaId FROM favorites WHERE mediaId = ?', [mediaId])
  return !!existing
}

export async function getFavorites(type = 'audio') {
  const db = await getDatabase()
  return await db.getAllAsync(
    `SELECT m.*, f.addedAt as favoriteAddedAt
     FROM favorites f
     JOIN media_items m ON f.mediaId = m.id
     WHERE f.type = ?
     ORDER BY f.addedAt DESC`,
    [type]
  )
}

// ----------------- Play History & Playback State -----------------

export async function recordPlayHistory(mediaId, position = 0, completionPercentage = 0.0) {
  const db = await getDatabase()
  const id = `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  await db.runAsync(
    'INSERT INTO play_history (id, mediaId, playedAt, position, completionPercentage) VALUES (?, ?, ?, ?, ?)',
    [id, mediaId, Date.now(), position, completionPercentage]
  )
}

export async function getRecentlyPlayed(type = 'audio', limit = 20) {
  const db = await getDatabase()
  return await db.getAllAsync(
    `SELECT m.*, MAX(h.playedAt) as lastPlayedAt, h.position as lastPosition, h.completionPercentage
     FROM play_history h
     JOIN media_items m ON h.mediaId = m.id
     WHERE m.type = ?
     GROUP BY h.mediaId
     ORDER BY lastPlayedAt DESC
     LIMIT ?`,
    [type, limit]
  )
}

export async function savePlaybackState({ mediaId, position, duration, speed = 1.0, isVideo = 0 }) {
  const db = await getDatabase()
  const now = Date.now()
  await db.runAsync(
    `INSERT INTO playback_state (mediaId, position, duration, updatedAt, speed, isVideo)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(mediaId) DO UPDATE SET
       position=excluded.position,
       duration=excluded.duration,
       updatedAt=excluded.updatedAt,
       speed=excluded.speed,
       isVideo=excluded.isVideo;`,
    [mediaId, position, duration, now, speed, isVideo ? 1 : 0]
  )
}

export async function getPlaybackState(mediaId) {
  const db = await getDatabase()
  return await db.getFirstAsync('SELECT * FROM playback_state WHERE mediaId = ?', [mediaId])
}

export async function getLastPlaybackState(isVideo = 0) {
  const db = await getDatabase()
  return await db.getFirstAsync(
    `SELECT ps.*, m.title, m.artist, m.album, m.artworkUri, m.uri, m.type
     FROM playback_state ps
     JOIN media_items m ON ps.mediaId = m.id
     WHERE ps.isVideo = ?
     ORDER BY ps.updatedAt DESC
     LIMIT 1`,
    [isVideo ? 1 : 0]
  )
}

export async function getContinueWatchingVideos(limit = 10) {
  const db = await getDatabase()
  return await db.getAllAsync(
    `SELECT m.*, ps.position, ps.duration, ps.updatedAt as lastWatchedAt
     FROM playback_state ps
     JOIN media_items m ON ps.mediaId = m.id
     WHERE ps.isVideo = 1 AND ps.position > 5000 AND (CAST(ps.position AS REAL) / MAX(ps.duration, 1)) < 0.95
     ORDER BY ps.updatedAt DESC
     LIMIT ?`,
    [limit]
  )
}

// ----------------- Settings Repository -----------------

export async function getSetting(key, defaultValue = null) {
  const db = await getDatabase()
  const row = await db.getFirstAsync('SELECT value FROM settings WHERE key = ?', [key])
  if (!row) return defaultValue
  try {
    return JSON.parse(row.value)
  } catch {
    return row.value
  }
}

export async function setSetting(key, value) {
  const db = await getDatabase()
  const serialized = typeof value === 'string' ? value : JSON.stringify(value)
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, serialized]
  )
}

export async function clearAllLibraryData() {
  const db = await getDatabase()
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM playlist_items')
    await db.runAsync('DELETE FROM playlists')
    await db.runAsync('DELETE FROM favorites')
    await db.runAsync('DELETE FROM play_history')
    await db.runAsync('DELETE FROM playback_state')
    await db.runAsync('DELETE FROM media_items')
    await db.runAsync('DELETE FROM artists')
    await db.runAsync('DELETE FROM albums')
    await db.runAsync('DELETE FROM folders')
  })
}
