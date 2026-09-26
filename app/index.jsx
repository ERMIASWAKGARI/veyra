import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  ActivityIndicator
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  Sparkles,
  Music2,
  Video as VideoIcon,
  Heart,
  ListMusic,
  FolderSync,
  Play,
  Clock,
  ChevronRight
} from 'lucide-react-native'
import { useTheme } from '../src/stores/useTheme'
import { usePlayback } from '../src/stores/usePlayback'
import { APP_CONFIG } from '../src/constants/config'
import {
  getRecentlyPlayed,
  getContinueWatchingVideos,
  getFavorites,
  getLastPlaybackState,
  getPlaylists
} from '../src/database/db'
import { scanLocalMedia, seedDemoMediaIfEmpty } from '../src/services/mediaScanner/mediaScanner'
import { EmptyState } from '../src/components/EmptyState'
import { formatTime } from '../src/utils/format'

export default function HomeScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { theme, spacing, radii, typography } = useTheme()
  const { playMedia } = usePlayback()

  const [refreshing, setRefreshing] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [scanStatus, setScanStatus] = useState('')
  const [recentlyPlayedAudio, setRecentlyPlayedAudio] = useState([])
  const [continueWatching, setContinueWatching] = useState([])
  const [favoriteAudio, setFavoriteAudio] = useState([])
  const [playlists, setPlaylists] = useState([])
  const [lastAudioSession, setLastAudioSession] = useState(null)
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false)

  const loadDashboardData = useCallback(async () => {
    try {
      const [recentAudio, watching, favs, pls, lastAudio] = await Promise.all([
        getRecentlyPlayed('audio', 8),
        getContinueWatchingVideos(4),
        getFavorites('audio'),
        getPlaylists(),
        getLastPlaybackState(0)
      ])

      setRecentlyPlayedAudio(recentAudio)
      setContinueWatching(watching)
      setFavoriteAudio(favs.slice(0, 6))
      setPlaylists(pls.slice(0, 4))
      setLastAudioSession(lastAudio)
    } catch (e) {
      console.warn('Dashboard data fetch error:', e)
    } finally {
      setHasLoadedInitial(true)
    }
  }, [])

  useEffect(() => {
    // Initial load and seed demo media if library is completely empty
    seedDemoMediaIfEmpty().then(() => {
      loadDashboardData()
    })
  }, [loadDashboardData])

  const handleScan = async () => {
    try {
      setIsScanning(true)
      setScanStatus('Discovering local media...')
      await scanLocalMedia({
        onProgress: ({ status }) => setScanStatus(status)
      })
      await loadDashboardData()
    } catch (err) {
      console.warn('Scan error:', err)
    } finally {
      setIsScanning(false)
      setScanStatus('')
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadDashboardData()
    setRefreshing(false)
  }

  const isEmptyLibrary =
    hasLoadedInitial &&
    recentlyPlayedAudio.length === 0 &&
    continueWatching.length === 0 &&
    favoriteAudio.length === 0 &&
    playlists.length === 0 &&
    !lastAudioSession

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.borderSubtle }]}>
        <View style={styles.brandRow}>
          <View style={[styles.logoIcon, { backgroundColor: theme.colors.accent, borderRadius: radii.sm }]}>
            <Sparkles size={18} color="#FFFFFF" />
          </View>
          <Text
            style={[
              styles.appName,
              { color: theme.colors.textPrimary, fontSize: typography.sizes.title, fontWeight: typography.weights.bold }
            ]}
          >
            {APP_CONFIG.appName}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.scanButton, { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.full }]}
          activeOpacity={0.8}
          onPress={handleScan}
          disabled={isScanning}
        >
          {isScanning ? (
            <ActivityIndicator size="small" color={theme.colors.accent} />
          ) : (
            <>
              <FolderSync size={16} color={theme.colors.textPrimary} />
              <Text style={[styles.scanButtonText, { color: theme.colors.textPrimary }]}>
                Scan
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Scanning status banner */}
      {isScanning && (
        <View style={[styles.scanningBanner, { backgroundColor: theme.colors.accentSubtle }]}>
          <ActivityIndicator size="small" color={theme.colors.accentLight} />
          <Text style={[styles.scanningText, { color: theme.colors.accentLight }]}>
            {scanStatus || 'Indexing device media...'}
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.accent}
          />
        }
      >
        {/* Quick Access Tiles */}
        <View style={styles.quickAccessGrid}>
          <TouchableOpacity
            style={[styles.tile, { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.md }]}
            activeOpacity={0.8}
            onPress={() => router.push('/music')}
          >
            <View style={[styles.tileIconCircle, { backgroundColor: theme.colors.accentSubtle }]}>
              <Music2 size={20} color={theme.colors.accent} />
            </View>
            <Text style={[styles.tileLabel, { color: theme.colors.textPrimary }]}>Music</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tile, { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.md }]}
            activeOpacity={0.8}
            onPress={() => router.push('/videos')}
          >
            <View style={[styles.tileIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <VideoIcon size={20} color={theme.colors.success} />
            </View>
            <Text style={[styles.tileLabel, { color: theme.colors.textPrimary }]}>Videos</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tile, { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.md }]}
            activeOpacity={0.8}
            onPress={() => router.push('/playlists')}
          >
            <View style={[styles.tileIconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
              <ListMusic size={20} color={theme.colors.warning} />
            </View>
            <Text style={[styles.tileLabel, { color: theme.colors.textPrimary }]}>Playlists</Text>
          </TouchableOpacity>
        </View>

        {/* Empty State Banner */}
        {isEmptyLibrary ? (
          <EmptyState
            title="No media found yet."
            message="Scan your device to build your library."
            actionLabel="Scan Device"
            onAction={handleScan}
            loading={isScanning}
          />
        ) : (
          <>
            {/* Continue Watching (Section 25) */}
            {continueWatching.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                    Continue Watching
                  </Text>
                  <TouchableOpacity onPress={() => router.push('/videos')}>
                    <ChevronRight size={18} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
                  {continueWatching.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.watchCard, { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.md }]}
                      activeOpacity={0.85}
                      onPress={() => {
                        playMedia(item, [item], 0)
                        router.push('/player/video')
                      }}
                    >
                      <View style={[styles.watchThumb, { backgroundColor: theme.colors.surfaceHighlight }]}>
                        {item.artworkUri ? (
                          <Image source={{ uri: item.artworkUri }} style={styles.fullImage} />
                        ) : (
                          <VideoIcon size={24} color={theme.colors.textMuted} />
                        )}
                        <View style={[styles.resumeBadge, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
                          <Text style={styles.resumeText}>
                            {formatTime(item.position)} / {formatTime(item.duration)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.watchInfo}>
                        <Text numberOfLines={1} style={[styles.watchTitle, { color: theme.colors.textPrimary }]}>
                          {item.title}
                        </Text>
                        <Text style={[styles.watchSub, { color: theme.colors.textSecondary }]}>
                          Resume playback
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Recently Played Music */}
            {recentlyPlayedAudio.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                    Recently Played
                  </Text>
                  <TouchableOpacity onPress={() => router.push('/music')}>
                    <ChevronRight size={18} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <View style={styles.trackList}>
                  {recentlyPlayedAudio.map((track) => (
                    <TouchableOpacity
                      key={track.id}
                      style={[styles.recentRow, { borderBottomColor: theme.colors.borderSubtle }]}
                      activeOpacity={0.7}
                      onPress={() => playMedia(track, recentlyPlayedAudio, recentlyPlayedAudio.indexOf(track))}
                    >
                      <View style={[styles.trackThumb, { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.sm }]}>
                        {track.artworkUri ? (
                          <Image source={{ uri: track.artworkUri }} style={styles.fullImage} />
                        ) : (
                          <Music2 size={18} color={theme.colors.textMuted} />
                        )}
                      </View>
                      <View style={styles.trackDetails}>
                        <Text numberOfLines={1} style={[styles.trackName, { color: theme.colors.textPrimary }]}>
                          {track.title}
                        </Text>
                        <Text numberOfLines={1} style={[styles.trackArtist, { color: theme.colors.textSecondary }]}>
                          {track.artist}
                        </Text>
                      </View>
                      <View style={[styles.playCircle, { backgroundColor: theme.colors.accentSubtle, borderRadius: radii.full }]}>
                        <Play size={14} color={theme.colors.accent} fill={theme.colors.accent} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
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
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  logoIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center'
  },
  appName: {
    letterSpacing: 0.5
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  scanButtonText: {
    fontSize: 12,
    fontWeight: '600'
  },
  scanningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  scanningText: {
    fontSize: 12,
    fontWeight: '600'
  },
  scrollContent: {
    paddingBottom: 40
  },
  quickAccessGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8
  },
  tileIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  tileLabel: {
    fontSize: 13,
    fontWeight: '600'
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2
  },
  horizontalList: {
    gap: 12,
    paddingRight: 16
  },
  watchCard: {
    width: 200,
    overflow: 'hidden'
  },
  watchThumb: {
    width: '100%',
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  resumeBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  resumeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600'
  },
  watchInfo: {
    padding: 10
  },
  watchTitle: {
    fontSize: 14,
    fontWeight: '600'
  },
  watchSub: {
    fontSize: 11,
    marginTop: 2
  },
  trackList: {
    gap: 2
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 12
  },
  trackThumb: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  fullImage: {
    width: '100%',
    height: '100%'
  },
  trackDetails: {
    flex: 1
  },
  trackName: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20
  },
  trackArtist: {
    fontSize: 12,
    marginTop: 2
  },
  playCircle: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center'
  }
})
