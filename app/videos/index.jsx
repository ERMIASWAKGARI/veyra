import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
  Platform
} from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  Video as VideoIcon,
  Folder,
  Heart,
  Clock,
  ArrowUpDown,
  FilePlus,
  FolderPlus,
  FolderSync
} from 'lucide-react-native'
import { useTheme } from '../../src/stores/useTheme'
import { usePlayback } from '../../src/stores/usePlayback'
import {
  getAllMediaItems,
  getFoldersSummary,
  getFavorites,
  getRecentlyPlayed,
  toggleFavorite,
  getPlaybackStates
} from '../../src/database/db'
import { scanLocalMedia, pickFilesAndImport, scanCustomFolderSAF } from '../../src/services/mediaScanner/mediaScanner'
import { VideoCard } from '../../src/components/VideoCard'
import { EmptyState } from '../../src/components/EmptyState'

const TABS = [
  { id: 'all', label: 'All Videos', icon: VideoIcon },
  { id: 'folders', label: 'Folders', icon: Folder },
  { id: 'favorites', label: 'Favorites', icon: Heart },
  { id: 'recent', label: 'Recently Played', icon: Clock }
]

export default function VideosScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { theme, spacing, radii, typography } = useTheme()
  const { playMedia } = usePlayback()

  const [activeTab, setActiveTab] = useState('all')
  const [videos, setVideos] = useState([])
  const [folders, setFolders] = useState([])
  const [favoritesMap, setFavoritesMap] = useState({})
  const [resumePositions, setResumePositions] = useState({})
  const [refreshing, setRefreshing] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [scanStatus, setScanStatus] = useState('')

  const handleScanVideos = async () => {
    try {
      setIsScanning(true)
      setScanStatus('Scanning device videos...')
      const res = await scanLocalMedia({
        scanAudio: false,
        scanVideo: true,
        onProgress: ({ status }) => setScanStatus(status)
      })
      await loadData()
      if (res && res.totalScanned > 0) {
        setScanStatus(`Found ${res.totalScanned} video(s)`)
        setTimeout(() => setScanStatus(''), 2500)
      }
    } catch (err) {
      console.warn('Video scan error:', err)
    } finally {
      setIsScanning(false)
    }
  }

  const handlePickFiles = async () => {
    try {
      setIsScanning(true)
      setScanStatus('Opening file picker...')
      const res = await pickFilesAndImport({
        mediaType: 'video',
        onProgress: ({ status }) => setScanStatus(status)
      })
      await loadData()
      if (res && res.totalScanned > 0) {
        setScanStatus(`Imported ${res.totalScanned} video(s)`)
        setTimeout(() => setScanStatus(''), 2500)
      }
    } catch (err) {
      console.warn('Pick files error:', err)
    } finally {
      setIsScanning(false)
    }
  }

  const handlePickFolder = async () => {
    try {
      setIsScanning(true)
      setScanStatus('Opening folder picker...')
      const res = await scanCustomFolderSAF({
        onProgress: ({ status }) => setScanStatus(status)
      })
      await loadData()
      if (res && res.newOrUpdated > 0) {
        setScanStatus(`Added ${res.newOrUpdated} video(s)`)
        setTimeout(() => setScanStatus(''), 2500)
      }
    } catch (err) {
      console.warn('Folder import error:', err)
    } finally {
      setIsScanning(false)
    }
  }

  const loadData = useCallback(async () => {
    try {
      const [list, folderList, favList] = await Promise.all([
        activeTab === 'all' ? getAllMediaItems({ type: 'video' })
          : activeTab === 'favorites' ? getFavorites('video')
          : activeTab === 'recent' ? getRecentlyPlayed('video') : Promise.resolve([]),
        activeTab === 'folders' ? getFoldersSummary('video') : Promise.resolve([]),
        getFavorites('video')
      ])
      const states = await getPlaybackStates(list.map((item) => item.id))
      setVideos(list)
      setFolders(folderList)
      setFavoritesMap(Object.fromEntries(favList.map((item) => [item.id, true])))
      setResumePositions(Object.fromEntries(states.filter((state) => state.position > 5000).map((state) => [state.mediaId, state.position])))
    } catch (error) {
      console.warn('Error loading videos:', error)
    }
  }, [activeTab])

  useFocusEffect(useCallback(() => {
    loadData()
  }, [loadData]))

  const handleToggleFavorite = async (video) => {
    const isNowFav = await toggleFavorite(video.id, 'video')
    setFavoritesMap((prev) => ({ ...prev, [video.id]: isNowFav }))
    if (activeTab === 'favorites' && !isNowFav) {
      setVideos((prev) => prev.filter((v) => v.id !== video.id))
    }
  }

  const handlePlayVideo = (video, index) => {
    playMedia(video, videos, index)
    router.push('/player/video')
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.borderSubtle }]}>
        <Text
          style={[
            styles.title,
            { color: theme.colors.textPrimary, fontSize: typography.sizes.title, fontWeight: typography.weights.bold }
          ]}
        >
          Video Library
        </Text>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[
              styles.iconButton,
              { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.full, marginRight: spacing.xs }
            ]}
            onPress={handlePickFiles}
            disabled={isScanning}
          >
            <FilePlus size={16} color={theme.colors.accent} />
          </TouchableOpacity>

          {Platform.OS === 'android' && (
            <TouchableOpacity
              style={[
                styles.iconButton,
                { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.full, marginRight: spacing.xs }
              ]}
              onPress={handlePickFolder}
              disabled={isScanning}
            >
              <FolderPlus size={16} color={theme.colors.accent} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.full }]}
            onPress={handleScanVideos}
            disabled={isScanning}
          >
            {isScanning ? (
              <ActivityIndicator size="small" color={theme.colors.accent} />
            ) : (
              <FolderSync size={16} color={theme.colors.textPrimary} />
            )}
          </TouchableOpacity>
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

      {/* Video Content */}
      {activeTab === 'folders' ? (
        <FlatList
          data={folders}
          keyExtractor={(item) => item.folder}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={[styles.folderCard, { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.md }]}>
              <View style={[styles.folderIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderRadius: radii.md }]}>
                <Folder size={20} color={theme.colors.success} />
              </View>
              <View style={styles.folderText}>
                <Text style={[styles.folderTitle, { color: theme.colors.textPrimary }]}>{item.folder}</Text>
                <Text style={[styles.folderSub, { color: theme.colors.textSecondary }]}>
                  {item.mediaCount} videos
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<EmptyState title="No video folders found" />}
        />
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                loadData().finally(() => setRefreshing(false))
              }}
            />
          }
          renderItem={({ item, index }) => (
            <VideoCard
              video={item}
              resumePosition={resumePositions[item.id] || 0}
              isFavorite={!!favoritesMap[item.id]}
              onPress={() => handlePlayVideo(item, index)}
              onToggleFavorite={handleToggleFavorite}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              title={activeTab === 'favorites' ? 'No favorite videos' : 'No videos found'}
              message={
                activeTab === 'favorites'
                  ? 'Favorite videos by tapping the heart icon.'
                  : (scanStatus || 'Scan your device to index videos, or pick video files directly.')
              }
              actionLabel={activeTab === 'all' ? 'Scan Videos' : undefined}
              onAction={activeTab === 'all' ? handleScanVideos : undefined}
              secondaryActionLabel={activeTab === 'all' ? 'Pick Files' : undefined}
              onSecondaryAction={activeTab === 'all' ? handlePickFiles : undefined}
              tertiaryActionLabel={activeTab === 'all' && Platform.OS === 'android' ? 'Pick Folder' : undefined}
              onTertiaryAction={activeTab === 'all' && Platform.OS === 'android' ? handlePickFolder : undefined}
              tip={activeTab === 'all' ? "Tip: If Android blocks a folder (e.g. Downloads) for privacy, use 'Pick Files' to select video files directly." : undefined}
              loading={isScanning}
            />
          }
        />
      )}
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
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 40
  },
  folderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginVertical: 4,
    gap: 14
  },
  folderIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  folderText: {
    flex: 1
  },
  folderTitle: {
    fontSize: 15,
    fontWeight: '600'
  },
  folderSub: {
    fontSize: 12,
    marginTop: 2
  }
})
