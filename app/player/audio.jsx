import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  useWindowDimensions
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
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
import { SeekBar } from '../../src/components/SeekBar'

function AudioTimeline() {
  const { theme } = useTheme()
  const { position, duration, seekTo } = usePlayback({ progress: true })
  const [remaining, setRemaining] = useState(false)
  return (
    <View style={styles.scrubberArea}>
      <SeekBar position={position} duration={duration} onSeek={seekTo} color={theme.colors.accent} trackColor={theme.colors.surfaceHighlight} />
      <View style={styles.timeRow}>
        <Text style={[styles.timeText, { color: theme.colors.accentLight }]}>{formatTime(position)}</Text>
        <TouchableOpacity accessibilityLabel="Toggle remaining time" onPress={() => setRemaining(!remaining)} hitSlop={8}>
          <Text style={[styles.timeText, { color: theme.colors.textMuted }]}>{remaining ? `-${formatTime(Math.max(0, duration - position))}` : formatTime(duration)}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default function AudioPlayerScreen() {
  const router = useRouter()
  const { width, height } = useWindowDimensions()
  const artworkSize = Math.min(width - 64, height * 0.32, 330)
  const insets = useSafeAreaInsets()
  const { theme, spacing, radii, typography } = useTheme()
  const {
    currentMedia,
    isPlaying,
    speed,
    queue,
    currentIndex,
    shuffleEnabled,
    repeatMode,
    togglePlayPause,
    seekBy,
    skipToNext,
    skipToPrevious,
    toggleShuffle,
    cycleRepeatMode,
    setPlaybackSpeed,
    sleepTimerActive,
    error
  } = usePlayback()

  const [isFav, setIsFav] = useState(false)
  const [queueModalVisible, setQueueModalVisible] = useState(false)
  const [speedModalVisible, setSpeedModalVisible] = useState(false)
  const [sleepTimerVisible, setSleepTimerVisible] = useState(false)
  const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
    try {
      Haptics.impactAsync(style).catch(() => {})
    } catch {}
  }

  useEffect(() => {
    if (currentMedia?.id) {
      isFavorite(currentMedia.id).then(setIsFav)
    }
  }, [currentMedia?.id])

  const handleToggleFavorite = async () => {
    if (!currentMedia?.id) return
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium)
    const newState = await toggleFavorite(currentMedia.id, 'audio')
    setIsFav(newState)
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.playerBackground, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 20) }]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.full }]}
          onPress={() => {
            triggerHaptic()
            router.back()
          }}
        >
          <ChevronDown size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textMuted }]}>
            NOW PLAYING
          </Text>
          <Text numberOfLines={1} style={[styles.headerAlbum, { color: theme.colors.textSecondary }]}>
            {currentMedia?.album || 'Single / Local Audio'}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.full }]}
          onPress={() => {
            triggerHaptic()
            setSleepTimerVisible(true)
          }}
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
              width: artworkSize,
              height: artworkSize,
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
              style={[styles.artwork, { width: artworkSize, height: artworkSize }, { borderRadius: radii.xl }]}
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

      <AudioTimeline />
      {error && <Text accessibilityRole="alert" style={{ color: theme.colors.textSecondary, textAlign: 'center', paddingHorizontal: 24 }}>{error}</Text>}

      {/* Primary Transport Controls with Prominent Next & Prev Buttons */}
      <View style={styles.controlsRow}>
        {/* Shuffle */}
        <TouchableOpacity
          style={styles.secondaryControl}
          onPress={() => {
            triggerHaptic()
            toggleShuffle()
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Shuffle
            size={22}
            color={shuffleEnabled ? theme.colors.accentLight : theme.colors.textMuted}
          />
        </TouchableOpacity>

        {/* Prominent Previous Track Button */}
        <TouchableOpacity
          style={[styles.mainControl, { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.full }]}
          onPress={() => {
            triggerHaptic(Haptics.ImpactFeedbackStyle.Medium)
            skipToPrevious()
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <SkipBack size={26} color={theme.colors.textPrimary} fill={theme.colors.textPrimary} />
        </TouchableOpacity>

        {/* Large Play / Pause Button with Glow */}
        <TouchableOpacity
          style={[
            styles.playButton,
            {
              backgroundColor: theme.colors.accent,
              borderRadius: radii.full,
              shadowColor: theme.colors.accent,
              shadowOpacity: 0.45,
              shadowRadius: 12,
              elevation: 8
            }
          ]}
          onPress={() => {
            triggerHaptic(Haptics.ImpactFeedbackStyle.Medium)
            togglePlayPause()
          }}
          activeOpacity={0.85}
        >
          {isPlaying ? (
            <Pause size={32} color="#FFFFFF" fill="#FFFFFF" />
          ) : (
            <Play size={32} color="#FFFFFF" fill="#FFFFFF" style={{ marginLeft: 3 }} />
          )}
        </TouchableOpacity>

        {/* Prominent Next Track Button */}
        <TouchableOpacity
          style={[styles.mainControl, { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.full }]}
          onPress={() => {
            triggerHaptic(Haptics.ImpactFeedbackStyle.Medium)
            skipToNext()
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <SkipForward size={26} color={theme.colors.textPrimary} fill={theme.colors.textPrimary} />
        </TouchableOpacity>

        {/* Repeat Mode */}
        <TouchableOpacity
          style={styles.secondaryControl}
          onPress={() => {
            triggerHaptic()
            cycleRepeatMode()
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          {repeatMode === 1 ? (
            <Repeat1 size={22} color={theme.colors.accentLight} />
          ) : (
            <Repeat
              size={22}
              color={repeatMode === 2 ? theme.colors.accentLight : theme.colors.textMuted}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Secondary Fast Seek & Utility Controls */}
      <View style={styles.secondaryActionsRow}>
        <TouchableOpacity
          style={[styles.seekPill, { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.full }]}
          onPress={() => {
            triggerHaptic()
            seekBy(-10)
          }}
        >
          <RotateCcw size={16} color={theme.colors.textPrimary} />
          <Text style={[styles.seekPillText, { color: theme.colors.textPrimary }]}>-10s</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.utilityBtn, { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.full }]}
          onPress={() => {
            triggerHaptic()
            setSpeedModalVisible(true)
          }}
        >
          <Gauge size={15} color={theme.colors.accentLight} />
          <Text style={[styles.utilityText, { color: theme.colors.textPrimary }]}>{speed}x</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.utilityBtn, { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.full }]}
          onPress={() => {
            triggerHaptic()
            setQueueModalVisible(true)
          }}
        >
          <ListMusic size={15} color={theme.colors.accentLight} />
          <Text style={[styles.utilityText, { color: theme.colors.textPrimary }]}>
            {queue.length > 0 ? `${(currentIndex >= 0 ? currentIndex + 1 : 1)}/${queue.length}` : 'Queue'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.seekPill, { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.full }]}
          onPress={() => {
            triggerHaptic()
            seekBy(10)
          }}
        >
          <RotateCw size={16} color={theme.colors.textPrimary} />
          <Text style={[styles.seekPillText, { color: theme.colors.textPrimary }]}>+10s</Text>
        </TouchableOpacity>
      </View>

      {/* Modals */}
      <QueueModal visible={queueModalVisible} onClose={() => setQueueModalVisible(false)} />
      <SpeedModal
        visible={speedModalVisible}
        currentSpeed={speed}
        isVideo={false}
        onSelectSpeed={(s) => setPlaybackSpeed(s)}
        onClose={() => setSpeedModalVisible(false)}
      />
      <SleepTimerModal visible={sleepTimerVisible} onClose={() => setSleepTimerVisible(false)} />
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
  scrubberThumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    top: 5,
    marginLeft: -7,
    elevation: 3
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600'
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 8,
    paddingHorizontal: 8
  },
  secondaryControl: {
    padding: 10
  },
  mainControl: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center'
  },
  playButton: {
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingTop: 4,
    paddingBottom: 8
  },
  seekPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  seekPillText: {
    fontSize: 12,
    fontWeight: '600'
  },
  utilityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7
  },
  utilityText: {
    fontSize: 12,
    fontWeight: '600'
  }
})
