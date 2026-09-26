import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  Modal
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useVideoPlayer, VideoView } from 'expo-video'
import {
  ChevronLeft,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Gauge,
  Subtitles,
  Maximize2,
  Check,
  SkipBack,
  SkipForward
} from 'lucide-react-native'
import { useTheme } from '../../src/stores/useTheme'
import { usePlayback } from '../../src/stores/usePlayback'
import { savePlaybackState, getPlaybackState, recordPlayHistory } from '../../src/database/db'
import { formatTime } from '../../src/utils/format'
import { SpeedModal } from '../../src/components/SpeedModal'
import { APP_CONFIG } from '../../src/constants/config'
import { NativePlaybackEngine } from '../../src/playback/NativePlaybackEngine'

export default function VideoPlayerScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { theme, spacing, radii, typography } = useTheme()
  const { currentMedia, skipToNext, skipToPrevious } = usePlayback()

  const [showControls, setShowControls] = useState(true)
  const [speedModalVisible, setSpeedModalVisible] = useState(false)
  const [subtitleModalVisible, setSubtitleModalVisible] = useState(false)
  const [currentSpeed, setCurrentSpeed] = useState(1.0)
  const [selectedSubtitle, setSelectedSubtitle] = useState('Off')

  const controlsTimeoutRef = useRef(null)

  // Pause background audio when video player opens
  useEffect(() => {
    NativePlaybackEngine.pause().catch(() => {})
  }, [])

  // Initialize Media3 video player with explicit volume and unmuted state
  const player = useVideoPlayer(currentMedia?.uri || '', (p) => {
    p.loop = false
    p.playbackRate = currentSpeed
    p.volume = 1.0
    p.muted = false
    p.play()
  })

  // Handle media switching
  useEffect(() => {
    if (player && currentMedia?.uri) {
      try {
        player.replace(currentMedia.uri)
        player.volume = 1.0
        player.muted = false
        player.play()
      } catch (err) {
        console.warn('Video replace error:', err)
      }
    }
  }, [currentMedia?.uri, player])

  // Pause video on unmount
  useEffect(() => {
    return () => {
      try {
        player?.pause()
      } catch {}
    }
  }, [player])

  // Restore resume position from SQLite
  useEffect(() => {
    if (currentMedia?.id && player) {
      getPlaybackState(currentMedia.id).then((saved) => {
        if (saved && saved.position > 3000) {
          player.currentTime = saved.position / 1000
        }
      })
    }
  }, [currentMedia?.id, player])

  // Periodic persistence of video resume position
  useEffect(() => {
    if (!currentMedia?.id) return
    const interval = setInterval(() => {
      if (player) {
        const curMs = (player.currentTime || 0) * 1000
        const durMs = (player.duration || 0) * 1000
        const completion = durMs > 0 ? curMs / durMs : 0
        const effectivePos = completion >= APP_CONFIG.playback.completionThresholdRatio ? 0 : curMs

        savePlaybackState({
          mediaId: currentMedia.id,
          position: effectivePos,
          duration: durMs,
          speed: currentSpeed,
          isVideo: 1
        }).catch(() => {})
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [currentMedia?.id, player, currentSpeed])

  // Auto-hide controls timer
  const resetControlsTimer = () => {
    setShowControls(true)
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false)
    }, 4000)
  }

  useEffect(() => {
    resetControlsTimer()
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    }
  }, [])

  const handleTogglePlay = () => {
    if (!player) return
    resetControlsTimer()
    if (player.playing) {
      player.pause()
    } else {
      player.play()
    }
  }

  const handleSeekBy = (deltaSeconds) => {
    if (!player) return
    resetControlsTimer()
    const target = Math.max(0, Math.min((player.currentTime || 0) + deltaSeconds, player.duration || Infinity))
    player.currentTime = target
  }

  const handleSelectSpeed = (speed) => {
    setCurrentSpeed(speed)
    if (player) {
      player.playbackRate = speed
    }
  }

  const curPosMs = (player?.currentTime || 0) * 1000
  const durMs = (player?.duration || 0) * 1000
  const progressRatio = durMs > 0 ? Math.min(1, Math.max(0, curPosMs / durMs)) : 0

  return (
    <View style={styles.container}>
      {/* Video View backed by Media3 */}
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={() => {
          if (showControls) {
            setShowControls(false)
          } else {
            resetControlsTimer()
          }
        }}
      >
        <VideoView
          style={StyleSheet.absoluteFill}
          player={player}
          allowsFullscreen
          allowsPictureInPicture
          showsTimecodes={false}
        />
      </TouchableOpacity>

      {/* Control HUD Overlay */}
      {showControls && (
        <View style={[styles.hudOverlay, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 20) }]}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.back()}
            >
              <ChevronLeft size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.titleContainer}>
              <Text numberOfLines={1} style={styles.videoTitle}>
                {currentMedia?.title || 'Video Player'}
              </Text>
            </View>

            <View style={styles.topActions}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => setSubtitleModalVisible(true)}
              >
                <Subtitles size={20} color={selectedSubtitle !== 'Off' ? theme.colors.accentLight : '#FFFFFF'} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.speedBtn}
                onPress={() => setSpeedModalVisible(true)}
              >
                <Gauge size={16} color="#FFFFFF" />
                <Text style={styles.speedBtnText}>{currentSpeed}x</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Center Transport Controls */}
          <View style={styles.centerControls}>
            <TouchableOpacity
              style={styles.centerAction}
              onPress={() => handleSeekBy(-10)}
            >
              <RotateCcw size={32} color="#FFFFFF" />
              <Text style={styles.seekBadge}>-10s</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bigPlayBtn, { backgroundColor: theme.colors.accent }]}
              onPress={handleTogglePlay}
            >
              {player?.playing ? (
                <Pause size={34} color="#FFFFFF" fill="#FFFFFF" />
              ) : (
                <Play size={34} color="#FFFFFF" fill="#FFFFFF" style={{ marginLeft: 3 }} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.centerAction}
              onPress={() => handleSeekBy(10)}
            >
              <RotateCw size={32} color="#FFFFFF" />
              <Text style={styles.seekBadge}>+10s</Text>
            </TouchableOpacity>
          </View>

          {/* Bottom Bar Scrubber */}
          <View style={styles.bottomBar}>
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{formatTime(curPosMs)}</Text>
              <Text style={styles.timeText}>{formatTime(durMs)}</Text>
            </View>

            <TouchableOpacity
              style={styles.scrubberTouch}
              activeOpacity={1}
              onPress={(e) => {
                if (durMs > 0 && player) {
                  const { locationX } = e.nativeEvent
                  const screenW = Dimensions.get('window').width - 48
                  const ratio = Math.max(0, Math.min(1, locationX / screenW))
                  player.currentTime = (ratio * durMs) / 1000
                  resetControlsTimer()
                }
              }}
            >
              <View style={styles.scrubberTrack}>
                <View style={[styles.scrubberProgress, { width: `${progressRatio * 100}%`, backgroundColor: theme.colors.accent }]} />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Speed Modal */}
      <SpeedModal
        visible={speedModalVisible}
        currentSpeed={currentSpeed}
        isVideo={true}
        onSelectSpeed={handleSelectSpeed}
        onClose={() => setSpeedModalVisible(false)}
      />

      {/* Subtitles Modal (Section 23) */}
      <Modal visible={subtitleModalVisible} transparent animationType="fade" onRequestClose={() => setSubtitleModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border, borderRadius: radii.xl }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>Subtitles</Text>
            {['Off', 'Track 1 (Embedded)', 'Track 2 (English)'].map((sub) => {
              const selected = selectedSubtitle === sub
              return (
                <TouchableOpacity
                  key={sub}
                  style={[styles.modalRow, selected && { backgroundColor: theme.colors.accentSubtle, borderRadius: radii.md }]}
                  onPress={() => {
                    setSelectedSubtitle(sub)
                    setSubtitleModalVisible(false)
                  }}
                >
                  <Text style={[styles.modalRowText, { color: selected ? theme.colors.accentLight : theme.colors.textPrimary }]}>
                    {sub}
                  </Text>
                  {selected && <Check size={18} color={theme.colors.accentLight} />}
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000'
  },
  hudOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'space-between',
    paddingHorizontal: 20
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10
  },
  iconBtn: {
    padding: 8
  },
  titleContainer: {
    flex: 1,
    paddingHorizontal: 12
  },
  videoTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600'
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  speedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14
  },
  speedBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600'
  },
  centerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40
  },
  centerAction: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10
  },
  seekBadge: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4
  },
  bigPlayBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6
  },
  bottomBar: {
    paddingVertical: 10
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  timeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500'
  },
  scrubberTouch: {
    height: 24,
    justifyContent: 'center'
  },
  scrubberTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden'
  },
  scrubberProgress: {
    height: '100%'
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
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
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginVertical: 2
  },
  modalRowText: {
    fontSize: 14,
    fontWeight: '500'
  }
})
