import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Modal,
  ActivityIndicator
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  Shuffle,
  Play,
  ArrowUpDown,
  Music2,
  Users,
  Disc,
  Folder,
  Heart,
  Check,
  FolderSync
} from 'lucide-react-native'
import { useTheme } from '../../src/stores/useTheme'
import { usePlayback } from '../../src/stores/usePlayback'
import {
  getAllMediaItems,
  getArtistsSummary,
  getAlbumsSummary,
  getFoldersSummary,
  getFavorites,
  toggleFavorite,
  isFavorite
} from '../../src/database/db'
import { scanLocalMedia, scanCustomFolderSAF } from '../../src/services/mediaScanner/mediaScanner'
import { TrackItem } from '../../src/components/TrackItem'
import { PlaylistSelectModal } from '../../src/components/PlaylistSelectModal'
import { EmptyState } from '../../src/components/EmptyState'

const TABS = [
  { id: 'songs', label: 'Songs', icon: Music2 },
  { id: 'artists', label: 'Artists', icon: Users },
  { id: 'albums', label: 'Albums', icon: Disc },
  { id: 'folders', label: 'Folders', icon: Folder },
  { id: 'favorites', label: 'Favorites', icon: Heart }
]

const SORT_OPTIONS = [
  { id: 'title', label: 'Title' },
  { id: 'artist', label: 'Artist' },
  { id: 'album', label: 'Album' },
  { id: 'duration', label: 'Duration' },
  { id: 'dateAdded', label: 'Date Added' }
]

export default function MusicScreen() {
  const insets = useSafeAreaInsets()
  const { theme, spacing, radii, typography } = useTheme()
  const { currentMedia, isPlaying, playMedia, addToQueue, playNext } = usePlayback()

  const [activeTab, setActiveTab] = useState('songs')
  const [items, setItems] = useState([])
  const [artists, setArtists] = useState([])
  const [albums, setAlbums] = useState([])
  const [folders, setFolders] = useState([])
  const [favoritesMap, setFavoritesMap] = useState({})
  const [refreshing, setRefreshing] = useState(false)

  // Sorting
  const [sortBy, setSortBy] = useState('title')
  const [sortOrder, setSortOrder] = useState('ASC')
  const [sortModalVisible, setSortModalVisible] = useState(false)

  // Playlist selector modal
  const [selectedTrackForPlaylist, setSelectedTrackForPlaylist] = useState(null)
  const [isScanning, setIsScanning] = useState(false)
  const [scanStatus, setScanStatus] = useState('')

  const loadData = useCallback(async () => {
    try {
      if (activeTab === 'songs') {
        const data = await getAllMediaItems({ type: 'audio', sortBy, order: sortOrder })
        setItems(data)
      } else if (activeTab === 'artists') {
        const data = await getArtistsSummary()
        setArtists(data)
      } else if (activeTab === 'albums') {
        const data = await getAlbumsSummary()
        setAlbums(data)
      } else if (activeTab === 'folders') {
        const data = await getFoldersSummary('audio')
        setFolders(data)
      } else if (activeTab === 'favorites') {
        const data = await getFavorites('audio')
        setItems(data)
      }

      // Preload favorites map for current items
      const favList = await getFavorites('audio')
      const fMap = {}
      favList.forEach((f) => {
        fMap[f.id] = true
      })
      setFavoritesMap(fMap)
    } catch (e) {
      console.warn('Error loading music data:', e)
    }
  }, [activeTab, sortBy, sortOrder])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleToggleFavorite = async (track) => {
    const isNowFav = await toggleFavorite(track.id, 'audio')
    setFavoritesMap((prev) => ({ ...prev, [track.id]: isNowFav }))
    if (activeTab === 'favorites' && !isNowFav) {
      setItems((prev) => prev.filter((item) => item.id !== track.id))
    }
  }

  const handleShuffleAll = () => {
    if (items.length === 0) return
    const randomIndex = Math.floor(Math.random() * items.length)
    playMedia(items[randomIndex], items, randomIndex)
  }

  const handlePlayAll = () => {
    if (items.length === 0) return
    playMedia(items[0], items, 0)
  }

  const handleScanAudio = async () => {
    try {
      setIsScanning(true)
      setScanStatus('Scanning audio storage...')
      await scanLocalMedia({
        scanAudio: true,
        scanVideo: false,
        onProgress: ({ status }) => setScanStatus(status)
      })
      await loadData()
    } catch (err) {
      console.warn('Audio scan error:', err)
    } finally {
      setIsScanning(false)
      setScanStatus('')
    }
  }

  const handlePickFolder = async () => {
    try {
      setIsScanning(true)
      setScanStatus('Opening folder picker...')
      await scanCustomFolderSAF({
        onProgress: ({ status }) => setScanStatus(status)
      })
      await loadData()
    } catch (err) {
      console.warn('Folder import error:', err)
    } finally {
      setIsScanning(false)
      setScanStatus('')
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.borderSubtle }]}>
        <Text
          style={[
            styles.title,
            { color: theme.colors.textPrimary, fontSize: typography.sizes.title, fontWeight: typography.weights.bold }
          ]}
        >
          Music Library
        </Text>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.full }]}
            onPress={handleScanAudio}
            disabled={isScanning}
          >
            {isScanning ? (
              <ActivityIndicator size="small" color={theme.colors.accent} />
            ) : (
              <FolderSync size={16} color={theme.colors.textPrimary} />
            )}
          </TouchableOpacity>

          {activeTab === 'songs' && (
            <TouchableOpacity
              style={[styles.sortButton, { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.full }]}
              onPress={() => setSortModalVisible(true)}
            >
              <ArrowUpDown size={16} color={theme.colors.textPrimary} />
              <Text style={[styles.sortButtonText, { color: theme.colors.textPrimary }]}>
                {SORT_OPTIONS.find((s) => s.id === sortBy)?.label}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabsWrapper, { borderBottomColor: theme.colors.borderSubtle }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsList}>
          {TABS.map((tab) => {
            const active = activeTab === tab.id
            const Icon = tab.icon
            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.tabItem,
                  active && { backgroundColor: theme.colors.accentSubtle, borderRadius: radii.full }
                ]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Icon size={16} color={active ? theme.colors.accentLight : theme.colors.textMuted} />
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color: active ? theme.colors.accentLight : theme.colors.textMuted,
                      fontWeight: active ? '700' : '500'
                    }
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      </View>

      {/* Play All / Shuffle All Action Row for Songs & Favorites */}
      {(activeTab === 'songs' || activeTab === 'favorites') && items.length > 0 && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.colors.accent, borderRadius: radii.full }]}
            onPress={handlePlayAll}
          >
            <Play size={16} color="#FFFFFF" fill="#FFFFFF" />
            <Text style={styles.actionBtnText}>Play All</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.full }]}
            onPress={handleShuffleAll}
          >
            <Shuffle size={16} color={theme.colors.textPrimary} />
            <Text style={[styles.actionBtnText, { color: theme.colors.textPrimary }]}>Shuffle</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content depending on active tab */}
      {activeTab === 'songs' || activeTab === 'favorites' ? (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData().finally(() => setRefreshing(false)) }} />
          }
          renderItem={({ item, index }) => (
            <TrackItem
              track={item}
              isActive={currentMedia?.id === item.id}
              isPlaying={isPlaying && currentMedia?.id === item.id}
              isFavorite={!!favoritesMap[item.id]}
              onPress={() => playMedia(item, items, index)}
              onToggleFavorite={handleToggleFavorite}
              onMorePress={(track) => setSelectedTrackForPlaylist(track)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              title={activeTab === 'favorites' ? 'No favorites yet' : 'No songs found'}
              message={
                activeTab === 'favorites'
                  ? 'Tap the heart icon on any song to save it here.'
                  : (scanStatus || 'Scan your device to discover audio tracks, or pick a music folder.')
              }
              actionLabel="Scan Audio"
              onAction={activeTab === 'songs' ? handleScanAudio : undefined}
              secondaryActionLabel="Pick Folder"
              onSecondaryAction={activeTab === 'songs' ? handlePickFolder : undefined}
              loading={isScanning}
            />
          }
        />
      ) : activeTab === 'artists' ? (
        <FlatList
          data={artists}
          keyExtractor={(item) => item.name}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={[styles.summaryCard, { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.md }]}>
              <View style={[styles.summaryIcon, { backgroundColor: theme.colors.accentSubtle, borderRadius: radii.full }]}>
                <Users size={20} color={theme.colors.accent} />
              </View>
              <View style={styles.summaryText}>
                <Text style={[styles.summaryTitle, { color: theme.colors.textPrimary }]}>{item.name}</Text>
                <Text style={[styles.summarySub, { color: theme.colors.textSecondary }]}>
                  {item.trackCount} tracks • {item.albumCount} albums
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<EmptyState title="No artists found" />}
        />
      ) : activeTab === 'albums' ? (
        <FlatList
          data={albums}
          keyExtractor={(item) => item.title}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={[styles.summaryCard, { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.md }]}>
              <View style={[styles.summaryIcon, { backgroundColor: theme.colors.accentSubtle, borderRadius: radii.md }]}>
                <Disc size={20} color={theme.colors.accent} />
              </View>
              <View style={styles.summaryText}>
                <Text style={[styles.summaryTitle, { color: theme.colors.textPrimary }]}>{item.title}</Text>
                <Text style={[styles.summarySub, { color: theme.colors.textSecondary }]}>
                  {item.artist} • {item.trackCount} tracks
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<EmptyState title="No albums found" />}
        />
      ) : (
        <FlatList
          data={folders}
          keyExtractor={(item) => item.folder}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={[styles.summaryCard, { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.md }]}>
              <View style={[styles.summaryIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderRadius: radii.md }]}>
                <Folder size={20} color={theme.colors.warning} />
              </View>
              <View style={styles.summaryText}>
                <Text style={[styles.summaryTitle, { color: theme.colors.textPrimary }]}>{item.folder}</Text>
                <Text style={[styles.summarySub, { color: theme.colors.textSecondary }]}>
                  {item.mediaCount} audio files
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<EmptyState title="No folders found" />}
        />
      )}

      {/* Sort options modal */}
      <Modal visible={sortModalVisible} transparent animationType="fade" onRequestClose={() => setSortModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border, borderRadius: radii.xl }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>Sort Songs By</Text>
            {SORT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={[styles.sortRow, sortBy === opt.id && { backgroundColor: theme.colors.accentSubtle, borderRadius: radii.sm }]}
                onPress={() => {
                  if (sortBy === opt.id) {
                    setSortOrder((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'))
                  } else {
                    setSortBy(opt.id)
                    setSortOrder('ASC')
                  }
                  setSortModalVisible(false)
                }}
              >
                <Text style={[styles.sortRowText, { color: sortBy === opt.id ? theme.colors.accentLight : theme.colors.textPrimary }]}>
                  {opt.label} {sortBy === opt.id ? `(${sortOrder})` : ''}
                </Text>
                {sortBy === opt.id && <Check size={18} color={theme.colors.accentLight} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Playlist Selector Modal */}
      <PlaylistSelectModal
        visible={!!selectedTrackForPlaylist}
        mediaItem={selectedTrackForPlaylist}
        onClose={() => setSelectedTrackForPlaylist(null)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    letterSpacing: -0.3
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '600'
  },
  tabsWrapper: {
    borderBottomWidth: 1
  },
  tabsList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  tabLabel: {
    fontSize: 13
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 40
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginVertical: 4,
    gap: 14
  },
  summaryIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  summaryText: {
    flex: 1
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '600'
  },
  summarySub: {
    fontSize: 12,
    marginTop: 2
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  modalBox: {
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    padding: 16
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  sortRowText: {
    fontSize: 14,
    fontWeight: '500'
  }
})
