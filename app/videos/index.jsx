import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  Video as VideoIcon,
  Folder,
  Heart,
  Clock,
  ArrowUpDown
} from 'lucide-react-native'
import { useTheme } from '../../src/stores/useTheme'
import { usePlayback } from '../../src/stores/usePlayback'
import {
  getAllMediaItems,
  getFoldersSummary,
  getFavorites,
  getRecentlyPlayed,
  toggleFavorite,
  getPlaybackState
} from '../../src/database/db'
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

  const loadData = useCallback(async () => {
    try {
      let list = []
      if (activeTab === 'all') {
        list = (await getAllMediaItems({ type: 'video', sortBy: 'title', order: 'ASC' }).catch(() => [])) || []
      } else if (activeTab === 'folders') {
        const folderList = (await getFoldersSummary('video').catch(() => [])) || []
        setFolders(folderList)
      } else if (activeTab === 'favorites') {
        list = (await getFavorites('video').catch(() => [])) || []
      } else if (activeTab === 'recent') {
        list = (await getRecentlyPlayed('video').catch(() => [])) || []
      }
      setVideos(list || [])

      // Preload favorites map and resume positions
      const favList = (await getFavorites('video').catch(() => [])) || []
      const fMap = {}
      favList.forEach((f) => {
        fMap[f.id] = true
      })
      setFavoritesMap(fMap)

      const positions = {}
      for (const item of (list || [])) {
        try {
          const state = await getPlaybackState(item.id)
          if (state && state.position > 5000) {
            positions[item.id] = state.position
          }
        } catch {}
      }
      setResumePositions(positions)
    } catch (e) {
      console.warn('Error loading video data:', e)
    } finally {
      setRefreshing(false)
    }
  }, [activeTab])

  useEffect(() => {
    loadData()
  }, [loadData])

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
                  : 'Scan your device to index videos.'
              }
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
