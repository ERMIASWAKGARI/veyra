// In-memory web storage driver for browser testing without wa-sqlite OPFS issues

const webStorage = {
  media: new Map(),
  playlists: new Map(),
  playlistItems: new Map(),
  favorites: new Map(),
  history: [],
  playbackState: new Map(),
  settings: new Map()
}

export async function getDatabase() {
  return webStorage
}

export async function upsertMediaItem(item) {
  if (!item || !item.id) return
  webStorage.media.set(item.id, {
    ...item,
    title: item.title || 'Unknown Title',
    artist: item.artist || 'Unknown Artist',
    album: item.album || 'Unknown Album',
    duration: item.duration || 0,
    dateAdded: item.dateAdded || Date.now(),
    dateModified: item.dateModified || Date.now()
  })
}

export async function upsertMediaItemsBatch(items) {
  if (!items) return
  for (const item of items) {
    await upsertMediaItem(item)
  }
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
  let list = Array.from(webStorage.media.values()).filter((m) => m.type === type)

  if (artist) list = list.filter((m) => m.artist === artist)
  if (album) list = list.filter((m) => m.album === album)
  if (folder) list = list.filter((m) => m.folder === folder)
  if (genre) list = list.filter((m) => m.genre === genre)

  list.sort((a, b) => {
    let valA = a[sortBy] ?? ''
    let valB = b[sortBy] ?? ''
    if (typeof valA === 'string') {
      const cmp = valA.localeCompare(valB)
      return order === 'DESC' ? -cmp : cmp
    }
    return order === 'DESC' ? valB - valA : valA - valB
  })

  return list.slice(offset, offset + limit)
}

export async function getMediaItemById(id) {
  return webStorage.media.get(id) || null
}

export async function searchMedia(query, limit = 50) {
  if (!query || query.trim().length === 0) return { songs: [], videos: [], artists: [], albums: [] }
  const q = query.trim().toLowerCase()

  const all = Array.from(webStorage.media.values())

  const songs = all
    .filter((m) => m.type === 'audio' && (
      (m.title && m.title.toLowerCase().includes(q)) ||
      (m.artist && m.artist.toLowerCase().includes(q)) ||
      (m.album && m.album.toLowerCase().includes(q))
    ))
    .slice(0, limit)

  const videos = all
    .filter((m) => m.type === 'video' && (
      (m.title && m.title.toLowerCase().includes(q)) ||
      (m.folder && m.folder.toLowerCase().includes(q))
    ))
    .slice(0, limit)

  const artistsMap = new Map()
  all.filter((m) => m.type === 'audio' && m.artist && m.artist.toLowerCase().includes(q) && m.artist !== 'Unknown Artist')
    .forEach((m) => {
      const count = (artistsMap.get(m.artist) || 0) + 1
      artistsMap.set(m.artist, count)
    })
  const artists = Array.from(artistsMap.entries()).map(([name, trackCount]) => ({ name, trackCount })).slice(0, limit)

  const albumsMap = new Map()
  all.filter((m) => m.type === 'audio' && m.album && m.album.toLowerCase().includes(q) && m.album !== 'Unknown Album')
    .forEach((m) => {
      const existing = albumsMap.get(m.album) || { title: m.album, artist: m.artist, artworkUri: m.artworkUri, trackCount: 0 }
      existing.trackCount++
      albumsMap.set(m.album, existing)
    })
  const albums = Array.from(albumsMap.values()).slice(0, limit)

  return { songs, videos, artists, albums }
}

export async function getArtistsSummary() {
  const map = new Map()
  Array.from(webStorage.media.values())
    .filter((m) => m.type === 'audio')
    .forEach((m) => {
      const a = m.artist || 'Unknown Artist'
      const existing = map.get(a) || { name: a, trackCount: 0, albums: new Set() }
      existing.trackCount++
      if (m.album) existing.albums.add(m.album)
      map.set(a, existing)
    })

  return Array.from(map.values()).map((item) => ({
    name: item.name,
    trackCount: item.trackCount,
    albumCount: item.albums.size
  }))
}

export async function getAlbumsSummary() {
  const map = new Map()
  Array.from(webStorage.media.values())
    .filter((m) => m.type === 'audio')
    .forEach((m) => {
      const title = m.album || 'Unknown Album'
      const existing = map.get(title) || { title, artist: m.artist, artworkUri: m.artworkUri, trackCount: 0, year: m.year }
      existing.trackCount++
      map.set(title, existing)
    })

  return Array.from(map.values())
}

export async function getGenresSummary() {
  const map = new Map()
  Array.from(webStorage.media.values())
    .filter((m) => m.type === 'audio' && m.genre)
    .forEach((m) => {
      const count = (map.get(m.genre) || 0) + 1
      map.set(m.genre, count)
    })
  return Array.from(map.entries()).map(([genre, trackCount]) => ({ genre, trackCount }))
}

export async function getFoldersSummary(type = 'audio') {
  const map = new Map()
  Array.from(webStorage.media.values())
    .filter((m) => m.type === type && m.folder)
    .forEach((m) => {
      const count = (map.get(m.folder) || 0) + 1
      map.set(m.folder, count)
    })
  return Array.from(map.entries()).map(([folder, mediaCount]) => ({ folder, mediaCount }))
}

export async function getRecentlyAdded(type = 'audio', limit = 20) {
  return Array.from(webStorage.media.values())
    .filter((m) => m.type === type)
    .sort((a, b) => b.dateAdded - a.dateAdded)
    .slice(0, limit)
}

// ----------------- Playlists -----------------

export async function createPlaylist(name) {
  const id = `pl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
  const now = Date.now()
  const pl = { id, name: name.trim(), createdAt: now, updatedAt: now, itemCount: 0 }
  webStorage.playlists.set(id, pl)
  webStorage.playlistItems.set(id, [])
  return pl
}

export async function renamePlaylist(id, newName) {
  const pl = webStorage.playlists.get(id)
  if (pl) {
    pl.name = newName.trim()
    pl.updatedAt = Date.now()
  }
}

export async function deletePlaylist(id) {
  webStorage.playlists.delete(id)
  webStorage.playlistItems.delete(id)
}

export async function getPlaylists() {
  return Array.from(webStorage.playlists.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export async function addItemsToPlaylist(playlistId, mediaIds) {
  const pl = webStorage.playlists.get(playlistId)
  if (!pl || !mediaIds) return

  const list = webStorage.playlistItems.get(playlistId) || []
  let sort = list.length
  for (const mid of mediaIds) {
    list.push({ playlistItemId: `pi_${Date.now()}_${Math.random()}`, mediaId: mid, sortOrder: sort++ })
  }
  webStorage.playlistItems.set(playlistId, list)
  pl.itemCount = list.length
  pl.updatedAt = Date.now()
}

export async function removeItemFromPlaylist(playlistId, mediaId) {
  const pl = webStorage.playlists.get(playlistId)
  if (!pl) return
  let list = webStorage.playlistItems.get(playlistId) || []
  list = list.filter((i) => i.mediaId !== mediaId)
  webStorage.playlistItems.set(playlistId, list)
  pl.itemCount = list.length
  pl.updatedAt = Date.now()
}

export async function getPlaylistItems(playlistId) {
  const list = webStorage.playlistItems.get(playlistId) || []
  const items = []
  for (const item of list) {
    const m = webStorage.media.get(item.mediaId)
    if (m) {
      items.push({ ...m, sortOrder: item.sortOrder, playlistItemId: item.playlistItemId })
    }
  }
  return items
}

// ----------------- Favorites -----------------

export async function toggleFavorite(mediaId, type = 'audio') {
  if (webStorage.favorites.has(mediaId)) {
    webStorage.favorites.delete(mediaId)
    return false
  } else {
    webStorage.favorites.set(mediaId, { mediaId, type, addedAt: Date.now() })
    return true
  }
}

export async function isFavorite(mediaId) {
  return webStorage.favorites.has(mediaId)
}

export async function getFavorites(type = 'audio') {
  const favs = Array.from(webStorage.favorites.values()).filter((f) => f.type === type)
  const items = []
  for (const f of favs) {
    const m = webStorage.media.get(f.mediaId)
    if (m) items.push({ ...m, favoriteAddedAt: f.addedAt })
  }
  return items.sort((a, b) => b.favoriteAddedAt - a.favoriteAddedAt)
}

// ----------------- History & Playback State -----------------

export async function recordPlayHistory(mediaId, position = 0, completionPercentage = 0.0) {
  webStorage.history.unshift({
    id: `hist_${Date.now()}`,
    mediaId,
    playedAt: Date.now(),
    position,
    completionPercentage
  })
}

export async function getRecentlyPlayed(type = 'audio', limit = 20) {
  const seen = new Set()
  const items = []
  for (const h of webStorage.history) {
    if (seen.has(h.mediaId)) continue
    const m = webStorage.media.get(h.mediaId)
    if (m && m.type === type) {
      seen.add(h.mediaId)
      items.push({ ...m, lastPlayedAt: h.playedAt, lastPosition: h.position })
      if (items.length >= limit) break
    }
  }
  return items
}

export async function updateMediaDuration(id, duration) {
  if (!id || !duration || duration <= 0) return
  const m = webStorage.media.get(id)
  if (m && (!m.duration || m.duration === 0)) {
    m.duration = Math.round(duration)
  }
}

export async function savePlaybackState({ mediaId, position, duration, speed = 1.0, isVideo = 0 }) {
  webStorage.playbackState.set(mediaId, {
    mediaId,
    position,
    duration,
    speed,
    isVideo,
    updatedAt: Date.now()
  })
}

export async function getPlaybackState(mediaId) {
  return webStorage.playbackState.get(mediaId) || null
}

export async function getLastPlaybackState(isVideo = 0) {
  const list = Array.from(webStorage.playbackState.values())
    .filter((p) => p.isVideo === (isVideo ? 1 : 0))
    .sort((a, b) => b.updatedAt - a.updatedAt)

  if (list.length === 0) return null
  const ps = list[0]
  const m = webStorage.media.get(ps.mediaId)
  if (!m) return null
  return { ...ps, title: m.title, artist: m.artist, album: m.album, artworkUri: m.artworkUri, uri: m.uri, type: m.type }
}

export async function getContinueWatchingVideos(limit = 10) {
  const list = Array.from(webStorage.playbackState.values())
    .filter((p) => p.isVideo === 1 && p.position > 5000 && (p.position / Math.max(p.duration, 1)) < 0.95)
    .sort((a, b) => b.updatedAt - a.updatedAt)

  const items = []
  for (const ps of list.slice(0, limit)) {
    const m = webStorage.media.get(ps.mediaId)
    if (m) items.push({ ...m, position: ps.position, duration: ps.duration, lastWatchedAt: ps.updatedAt })
  }
  return items
}

// ----------------- Settings -----------------

export async function getSetting(key, defaultValue = null) {
  return webStorage.settings.has(key) ? webStorage.settings.get(key) : defaultValue
}

export async function setSetting(key, value) {
  webStorage.settings.set(key, value)
}

export async function clearDemoMedia() {
  for (const key of webStorage.media.keys()) {
    if (key.startsWith('demo_')) {
      webStorage.media.delete(key)
    }
  }
}

export async function clearAllLibraryData() {
  webStorage.media.clear()
  webStorage.playlists.clear()
  webStorage.playlistItems.clear()
  webStorage.favorites.clear()
  webStorage.history = []
  webStorage.playbackState.clear()
}

