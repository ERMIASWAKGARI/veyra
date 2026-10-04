import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Play, Shuffle, ChevronLeft, Trash2 } from 'lucide-react-native'
import { useTheme } from '../../src/stores/useTheme'
import { usePlayback } from '../../src/stores/usePlayback'
import { getPlaylistItems, removeItemFromPlaylist, getPlaylists } from '../../src/database/db'
import { TrackItem } from '../../src/components/TrackItem'
import { EmptyState } from '../../src/components/EmptyState'

export default function PlaylistDetailScreen() {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { theme, spacing, radii, typography } = useTheme()
  const { currentMedia, isPlaying, playMedia } = usePlayback()

  const [playlist, setPlaylist] = useState(null)
  const [items, setItems] = useState([])

  const loadData = useCallback(async () => {
    if (!id) return
    const all = await getPlaylists()
    const found = all.find((p) => p.id === id)
    setPlaylist(found)

    const list = await getPlaylistItems(id)
    setItems(list)
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleRemoveItem = async (track) => {
    try {
      await removeItemFromPlaylist(id, track.id)
      loadData()
    } catch {
      Alert.alert('Error', 'Unable to remove track from playlist.')
    }
  }

  const handlePlayAll = () => {
    if (items.length === 0) return
    playMedia(items[0], items, 0)
    router.push(items[0]?.type === 'video' ? '/player/video' : '/player/audio')
  }

  const handleShuffle = () => {
    if (items.length === 0) return
    const rand = Math.floor(Math.random() * items.length)
    playMedia(items[rand], items, rand)
    router.push(items[rand]?.type === 'video' ? '/player/video' : '/player/audio')
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.borderSubtle }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.full }]}
          onPress={() => router.back()}
        >
          <ChevronLeft size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.titleWrapper}>
          <Text
            numberOfLines={1}
            style={[
              styles.title,
              { color: theme.colors.textPrimary, fontSize: typography.sizes.title, fontWeight: typography.weights.bold }
            ]}
          >
            {playlist?.name || 'Playlist'}
          </Text>
          <Text style={[styles.sub, { color: theme.colors.textSecondary, fontSize: typography.sizes.caption }]}>
            {items.length} items
          </Text>
        </View>
      </View>

      {/* Play Actions */}
      {items.length > 0 && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.colors.accent, borderRadius: radii.full }]}
            onPress={handlePlayAll}
          >
            <Play size={16} color="#FFFFFF" fill="#FFFFFF" />
            <Text style={styles.actionBtnText}>Play</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.full }]}
            onPress={handleShuffle}
          >
            <Shuffle size={16} color={theme.colors.textPrimary} />
            <Text style={[styles.actionBtnText, { color: theme.colors.textPrimary }]}>Shuffle</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Playlist Items */}
      <FlatList
        data={items}
        keyExtractor={(item) => `${item.id}_${item.playlistItemId}`}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <TrackItem
            track={item}
            isActive={currentMedia?.id === item.id}
            isPlaying={isPlaying && currentMedia?.id === item.id}
            onPress={() => {
              playMedia(item, items, index)
              router.push(item.type === 'video' ? '/player/video' : '/player/audio')
            }}
            onMorePress={() => handleRemoveItem(item)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title="Empty playlist"
            message="Add music or videos to this playlist from the library."
          />
        }
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center'
  },
  titleWrapper: {
    flex: 1
  },
  title: {
    letterSpacing: -0.3
  },
  sub: {
    marginTop: 2
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
  }
})
