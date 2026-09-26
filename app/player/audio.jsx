import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  ChevronDown,
  Heart,
  Shuffle,
  Repeat,
  Repeat1,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  RotateCw,
  ListMusic,
  Gauge,
  Moon,
  Music2
} from 'lucide-react-native'
import { useTheme } from '../../src/stores/useTheme'
import { usePlayback } from '../../src/stores/usePlayback'
import { toggleFavorite, isFavorite } from '../../src/database/db'
import { formatTime } from '../../src/utils/format'
import { QueueModal } from '../../src/components/QueueModal'
import { SpeedModal } from '../../src/components/SpeedModal'
import { SleepTimerModal } from '../../src/components/SleepTimerModal'

const { width } = Dimensions.get('window')
const ARTWORK_SIZE = Math.min(width - 64, 340)

export default function AudioPlayerScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { theme, spacing, radii, typography } = useTheme()
  const {
    currentMedia,
    isPlaying,
    position,
    duration,
    speed,
    shuffleEnabled,
    repeatMode,
    togglePlayPause,
    seekTo,
    seekBy,
    skipToNext,
    skipToPrevious,
    toggleShuffle,
    cycleRepeatMode,
    setPlaybackSpeed,
    sleepTimerActive
  } = usePlayback()

  const [isFav, setIsFav] = useState(false)
  const [queueModalVisible, setQueueModalVisible] = useState(false)
  const [speedModalVisible, setSpeedModalVisible] = useState(false)
  const [sleepTimerVisible, setSleepTimerVisible] = useState(false)

  // Track scrubber drag state
  const [isScrubbing, setIsScrubbing] = useState(false)
  const [scrubPosition, setScrubPosition] = useState(0)

  useEffect(() => {
    if (currentMedia?.id) {
      isFavorite(currentMedia.id).then(setIsFav)
    }
  }, [currentMedia?.id])

  const handleToggleFavorite = async () => {
    if (!currentMedia?.id) return
    const newState = await toggleFavorite(currentMedia.id, 'audio')
    setIsFav(newState)
  }

  const currentPos = isScrubbing ? scrubPosition : position
  const progressRatio = duration > 0 ? Math.min(1, Math.max(0, currentPos / duration)) : 0

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.playerBackground, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 20) }]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.full }]}
          onPress={() => router.back()}
        >
          <ChevronDown size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textMuted }]}>
            PLAYING FROM LIBRARY
          </Text>
          <Text numberOfLines={1} style={[styles.headerAlbum, { color: theme.colors.textSecondary }]}>
            {currentMedia?.album || 'Unknown Album'}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.full }]}
          onPress={() => setSleepTimerVisible(true)}
        >
          <Moon
            size={18}
            color={sleepTimerActive ? theme.colors.accentLight : theme.colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      {/* Center Artwork */}
      <View style={styles.artworkArea}>
        <View
          style={[
            styles.artworkWrapper,
            {
              width: ARTWORK_SIZE,
              height: ARTWORK_SIZE,
              borderRadius: radii.xl,
              backgroundColor: theme.colors.surfaceElevated,
              shadowColor: theme.colors.accent,
              shadowOpacity: isPlaying ? 0.35 : 0.1,
              shadowRadius: 24,
              elevation: isPlaying ? 10 : 3
            }
          ]}
        >
          {currentMedia?.artworkUri ? (
            <Image
              source={{ uri: currentMedia.artworkUri }}
              style={[styles.artwork, { borderRadius: radii.xl }]}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.artworkPlaceholder}>
              <Music2 size={72} color={theme.colors.textMuted} />
            </View>
          )}
        </View>
      </View>

      {/* Track Info & Favorite */}
      <View style={styles.metaRow}>
        <View style={styles.metaText}>
          <Text
            numberOfLines={1}
            style={[
              styles.trackTitle,
              { color: theme.colors.textPrimary, fontSize: typography.sizes.title, fontWeight: typography.weights.bold }
            ]}
          >
            {currentMedia?.title || 'No Media Selected'}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.trackArtist,
              { color: theme.colors.textSecondary, fontSize: typography.sizes.body }
            ]}
          >
            {currentMedia?.artist || 'Unknown Artist'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={handleToggleFavorite}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Heart
            size={24}
            color={isFav ? theme.colors.accent : theme.colors.textMuted}
            fill={isFav ? theme.colors.accent : 'transparent'}
          />
        </TouchableOpacity>
      </View>

      {/* Scrubber Progress Bar */}
      <View style={styles.scrubberArea}>
        <TouchableOpacity
          style={styles.scrubberTrackWrapper}
          activeOpacity={1}
          onPress={(e) => {
            if (duration > 0) {
              const { locationX } = e.nativeEvent
              const newRatio = Math.max(0, Math.min(1, locationX / (width - 48)))
              seekTo(newRatio * duration)
            }
          }}
        >
          <View style={[styles.scrubberTrack, { backgroundColor: theme.colors.surfaceHighlight, borderRadius: radii.full }]}>
            <View
              style={[
                styles.scrubberFill,
                { width: `${progressRatio * 100}%`, backgroundColor: theme.colors.accent, borderRadius: radii.full }
              ]}
            />
          </View>
        </TouchableOpacity>

        <View style={styles.timeRow}>
          <Text style={[styles.timeText, { color: theme.colors.textMuted }]}>
            {formatTime(currentPos)}
          </Text>
          <Text style={[styles.timeText, { color: theme.colors.textMuted }]}>
            {formatTime(duration)}
          </Text>
        </View>
      </View>

      {/* Main Transport Controls */}
      <View style={styles.controlsRow}>
        {/* Shuffle */}
        <TouchableOpacity
          style={styles.secondaryControl}
          onPress={toggleShuffle}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Shuffle
            size={20}
            color={shuffleEnabled ? theme.colors.accentLight : theme.colors.textMuted}
          />
        </TouchableOpacity>

        {/* Seek -10s */}
        <TouchableOpacity
          style={styles.secondaryControl}
          onPress={() => seekBy(-10)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <RotateCcw size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>

        {/* Skip Previous */}
        <TouchableOpacity
          style={styles.mainControl}
          onPress={skipToPrevious}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <SkipBack size={28} color={theme.colors.textPrimary} fill={theme.colors.textPrimary} />
        </TouchableOpacity>

        {/* Big Play / Pause Button */}
        <TouchableOpacity
          style={[styles.playButton, { backgroundColor: theme.colors.accent, borderRadius: radii.full }]}
          onPress={togglePlayPause}
          activeOpacity={0.85}
        >
          {isPlaying ? (
            <Pause size={30} color="#FFFFFF" fill="#FFFFFF" />
          ) : (
            <Play size={30} color="#FFFFFF" fill="#FFFFFF" style={{ marginLeft: 3 }} />
          )}
        </TouchableOpacity>

        {/* Skip Next */}
        <TouchableOpacity
          style={styles.mainControl}
          onPress={skipToNext}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <SkipForward size={28} color={theme.colors.textPrimary} fill={theme.colors.textPrimary} />
        </TouchableOpacity>

        {/* Seek +10s */}
        <TouchableOpacity
          style={styles.secondaryControl}
          onPress={() => seekBy(10)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <RotateCw size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>

        {/* Repeat Mode */}
        <TouchableOpacity
          style={styles.secondaryControl}
          onPress={cycleRepeatMode}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {repeatMode === 1 ? (
            <Repeat1 size={20} color={theme.colors.accentLight} />
          ) : (
            <Repeat
              size={20}
              color={repeatMode === 2 ? theme.colors.accentLight : theme.colors.textMuted}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Bottom Utility Controls (Queue & Speed) */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.utilityBtn, { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.full }]}
          onPress={() => setSpeedModalVisible(true)}
        >
          <Gauge size={16} color={theme.colors.textSecondary} />
          <Text style={[styles.utilityText, { color: theme.colors.textPrimary }]}>{speed}x</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.utilityBtn, { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.full }]}
          onPress={() => setQueueModalVisible(true)}
        >
          <ListMusic size={16} color={theme.colors.textSecondary} />
          <Text style={[styles.utilityText, { color: theme.colors.textPrimary }]}>Queue</Text>
        </TouchableOpacity>
      </View>

      {/* Modals */}
      <QueueModal visible={queueModalVisible} onClose={() => setQueueModalVisible(false)} />
      <SpeedModal
        visible={speedModalVisible}
        currentSpeed={speed}
        isVideo={false}
        onSelectSpeed={setPlaybackSpeed}
        onClose={() => setSpeedModalVisible(false)}
      />
      <SleepTimerModal
        visible={sleepTimerVisible}
        onClose={() => setSleepTimerVisible(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between'
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitleContainer: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 12
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1
  },
  headerAlbum: {
    fontSize: 12,
    marginTop: 2
  },
  artworkArea: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12
  },
  artworkWrapper: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center'
  },
  artwork: {
    width: '100%',
    height: '100%'
  },
  artworkPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8
  },
  metaText: {
    flex: 1,
    paddingRight: 16
  },
  trackTitle: {
    lineHeight: 28,
    letterSpacing: -0.3
  },
  trackArtist: {
    marginTop: 4
  },
  favoriteButton: {
    padding: 6
  },
  scrubberArea: {
    marginVertical: 8
  },
  scrubberTrackWrapper: {
    height: 24,
    justifyContent: 'center'
  },
  scrubberTrack: {
    height: 5,
    width: '100%',
    overflow: 'hidden'
  },
  scrubberFill: {
    height: '100%'
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500'
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 12
  },
  secondaryControl: {
    padding: 8
  },
  mainControl: {
    padding: 8
  },
  playButton: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingTop: 8
  },
  utilityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  utilityText: {
    fontSize: 13,
    fontWeight: '600'
  }
})
