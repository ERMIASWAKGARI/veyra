import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, AppState, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useEvent, useEventListener } from 'expo'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useVideoPlayer, VideoView } from 'expo-video'
import { Check, ChevronLeft, Gauge, Maximize2, Pause, Play, RotateCcw, RotateCw, SkipBack, SkipForward, Subtitles } from 'lucide-react-native'
import { useTheme } from '../../src/stores/useTheme'
import { usePlayback } from '../../src/stores/usePlayback'
import { usePlayerControls } from '../../src/stores/usePlayerControls'
import { getPlaybackState, getSetting, recordPlayHistory, savePlaybackState, updateMediaDuration } from '../../src/database/db'
import { PlaybackManager } from '../../src/playback/PlaybackManager'
import { formatTime } from '../../src/utils/format'
import { SpeedModal } from '../../src/components/SpeedModal'
import { SeekBar } from '../../src/components/SeekBar'
import { APP_CONFIG } from '../../src/constants/config'

export default function VideoPlayerScreen() {
  const { currentMedia } = usePlayback()
  const router = useRouter()
  if (!currentMedia || currentMedia.type !== 'video') {
    return <View style={styles.container}><TouchableOpacity accessibilityLabel="Back to library" onPress={() => router.back()} style={{ padding: 48 }}><Text style={{ color: '#FFFFFF' }}>Back to library</Text></TouchableOpacity></View>
  }
  return <VideoSession key={currentMedia.id} media={currentMedia} />
}

function VideoTimeline({ player, media, onSeek, onScrubStart, onScrubEnd }) {
  const { theme } = useTheme()
  const [remaining, setRemaining] = useState(false)
  const [position, setPosition] = useState(() => player.currentTime * 1000)
  const [duration, setDuration] = useState(() => player.duration * 1000 || media.duration || 0)
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    setPosition(currentTime * 1000)
    setDuration(player.duration * 1000 || media.duration || 0)
    PlaybackManager.updateVideo(media.id, { position: currentTime * 1000 })
  })
  useEffect(() => {
    player.timeUpdateEventInterval = 0.5
    return () => { player.timeUpdateEventInterval = 0 }
  }, [player])
  const seek = (value) => { onSeek(value); setPosition(value) }
  return (
    <View style={styles.bottomBar}>
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{formatTime(position)}</Text>
        <TouchableOpacity accessibilityLabel="Toggle remaining time" onPress={() => setRemaining(!remaining)}>
          <Text style={styles.timeText}>{remaining ? `-${formatTime(Math.max(0, duration - position))}` : formatTime(duration)}</Text>
        </TouchableOpacity>
      </View>
      <SeekBar position={position} duration={duration} onSeek={seek} onScrubStart={onScrubStart} onScrubEnd={onScrubEnd} color={theme.colors.accent} trackColor="rgba(255,255,255,0.35)" />
    </View>
  )
}

function VideoSession({ media }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { theme, radii } = useTheme()
  const { currentIndex, queue, skipToNext, skipToPrevious } = usePlayback()
  const viewRef = useRef(null)
  const fullscreen = useRef(false)
  const [speedVisible, setSpeedVisible] = useState(false)
  const [subtitlesVisible, setSubtitlesVisible] = useState(false)
  const [scrubbing, setScrubbing] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [subtitleTracks, setSubtitleTracks] = useState([])
  const [subtitle, setSubtitle] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const player = useVideoPlayer(null, (instance) => {
    instance.loop = false
    instance.audioMixingMode = 'doNotMix'
    instance.timeUpdateEventInterval = 0
  })
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: false })
  const { status, error } = useEvent(player, 'statusChange', { status: 'loading', error: null })
  const failure = loadError || error?.message
  const controls = usePlayerControls(isPlaying, scrubbing || speedVisible || subtitlesVisible || status !== 'readyToPlay' || !!failure)

  const persist = useCallback(() => {
    const position = player.currentTime * 1000
    const duration = player.duration * 1000 || media.duration || 0
    PlaybackManager.updateVideo(media.id, { position, duration, speed: player.playbackRate })
    return savePlaybackState({
      mediaId: media.id,
      position: duration > 0 && position / duration >= APP_CONFIG.playback.completionThresholdRatio ? 0 : position,
      duration, speed: player.playbackRate, isVideo: 1
    }).catch(() => {})
  }, [media.id, media.duration, player])

  useEventListener(player, 'sourceLoad', ({ duration, availableSubtitleTracks }) => {
    setSubtitleTracks(availableSubtitleTracks || [])
    setSubtitle(null)
    player.subtitleTrack = null
    PlaybackManager.updateVideo(media.id, { duration: duration * 1000 })
    updateMediaDuration(media.id, duration * 1000).catch(() => {})
  })
  useEventListener(player, 'playingChange', ({ isPlaying: playing }) => {
    PlaybackManager.updateVideo(media.id, { isPlaying: playing, playbackState: 3 })
    if (!playing) persist()
  })
  useEventListener(player, 'playToEnd', () => {
    persist()
    controls.reveal()
    getSetting('autoplayNext', true).then((enabled) => { if (enabled) skipToNext() }).catch(() => {})
  })

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [saved, resume] = await Promise.all([getPlaybackState(media.id), getSetting('resumePlayback', true)])
        await PlaybackManager.videoReady
        if (cancelled) return
        await player.replaceAsync(media.uri)
        if (cancelled) return
        const savedSpeed = saved?.speed || 1
        player.playbackRate = savedSpeed
        setSpeed(savedSpeed)
        if (resume && saved?.position > 0) player.currentTime = saved.position / 1000
        player.play()
        await recordPlayHistory(media.id, resume ? saved?.position || 0 : 0, 0)
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Unable to open this video.')
      }
    }
    load()
    return () => { cancelled = true }
  }, [media.id, media.uri, player, attempt])

  useEffect(() => {
    const detach = PlaybackManager.attachVideo(media.id, {
      play: () => player.play(), pause: () => player.pause(),
      seekTo: (ms) => { player.currentTime = ms / 1000 },
      setSpeed: (value) => { player.playbackRate = value }
    })
    const interval = setInterval(persist, 10000)
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && !fullscreen.current) { player.pause(); persist() }
    })
    return () => {
      clearInterval(interval)
      subscription.remove()
      persist()
      player.pause()
      detach()
    }
  }, [media.id, player, persist])

  const seek = (position) => {
    player.currentTime = Math.max(0, Math.min(position / 1000, player.duration || Infinity))
    PlaybackManager.updateVideo(media.id, { position: player.currentTime * 1000 })
    controls.reveal()
    persist()
  }
  const skip = async (direction) => {
    await persist()
    if (direction === 'next') await skipToNext()
    else await skipToPrevious()
    controls.reveal()
  }

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <VideoView
          ref={viewRef} style={StyleSheet.absoluteFill} player={player}
          nativeControls={false} contentFit="contain" surfaceType="surfaceView"
          fullscreenOptions={{ enable: true }}
          onFullscreenEnter={() => { fullscreen.current = true }}
          onFullscreenExit={() => { fullscreen.current = false; controls.reveal(); persist() }}
        />
      </View>
      <Pressable
        testID="video-controls-toggle" style={StyleSheet.absoluteFill}
        accessibilityRole="button" accessibilityLabel={controls.visible ? 'Hide video controls' : 'Show video controls'}
        onPress={controls.toggle}
      />
      {controls.visible && (
        <View testID="video-controls" pointerEvents="box-none" style={[styles.hudOverlay, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]} />
          <View pointerEvents="box-none" style={styles.topBar}>
            <TouchableOpacity accessibilityLabel="Back to library" style={styles.iconBtn} onPress={() => { persist(); router.back() }}><ChevronLeft size={24} color="#FFFFFF" /></TouchableOpacity>
            <View pointerEvents="none" style={styles.titleContainer}><Text numberOfLines={1} style={styles.videoTitle}>{media.title}</Text></View>
            <TouchableOpacity accessibilityLabel="Subtitles" style={styles.iconBtn} onPress={() => { controls.reveal(); setSubtitlesVisible(true) }}><Subtitles size={20} color={subtitle ? theme.colors.accentLight : '#FFFFFF'} /></TouchableOpacity>
            <TouchableOpacity accessibilityLabel="Playback speed" style={styles.speedBtn} onPress={() => { controls.reveal(); setSpeedVisible(true) }}><Gauge size={16} color="#FFFFFF" /><Text style={styles.speedBtnText}>{speed}x</Text></TouchableOpacity>
            <TouchableOpacity accessibilityLabel="Fullscreen" style={styles.iconBtn} onPress={() => {
              fullscreen.current = true
              viewRef.current?.enterFullscreen().catch((err) => { fullscreen.current = false; setLoadError(err.message) })
            }}><Maximize2 size={20} color="#FFFFFF" /></TouchableOpacity>
          </View>
          {failure ? (
            <View style={{ alignItems: 'center', padding: 20 }}>
              <Text style={{ color: '#FFFFFF', textAlign: 'center', marginBottom: 16 }}>{failure}</Text>
              <TouchableOpacity accessibilityLabel="Retry video" onPress={() => { setLoadError(null); setAttempt((value) => value + 1) }} style={styles.speedBtn}><Text style={styles.speedBtnText}>Try again</Text></TouchableOpacity>
            </View>
          ) : (
            <View pointerEvents="box-none" style={styles.centerControls}>
              <TouchableOpacity accessibilityLabel="Previous video" style={[styles.hudCircleBtn, currentIndex <= 0 && { opacity: 0.35 }]} disabled={currentIndex <= 0} onPress={() => skip('previous')}><SkipBack size={24} color="#FFFFFF" /></TouchableOpacity>
              <TouchableOpacity accessibilityLabel="Back ten seconds" style={styles.centerAction} onPress={() => seek((player.currentTime - 10) * 1000)}><RotateCcw size={26} color="#FFFFFF" /><Text style={styles.seekBadge}>-10s</Text></TouchableOpacity>
              <TouchableOpacity accessibilityLabel={isPlaying ? 'Pause video' : 'Play video'} style={[styles.bigPlayBtn, { backgroundColor: theme.colors.accent }]} onPress={() => {
                controls.reveal()
                if (isPlaying) player.pause()
                else { if (player.duration > 0 && player.currentTime >= player.duration) player.currentTime = 0; player.play() }
              }}>
                {status === 'loading' ? <ActivityIndicator color="#FFFFFF" /> : isPlaying ? <Pause size={32} color="#FFFFFF" fill="#FFFFFF" /> : <Play size={32} color="#FFFFFF" fill="#FFFFFF" />}
              </TouchableOpacity>
              <TouchableOpacity accessibilityLabel="Forward ten seconds" style={styles.centerAction} onPress={() => seek((player.currentTime + 10) * 1000)}><RotateCw size={26} color="#FFFFFF" /><Text style={styles.seekBadge}>+10s</Text></TouchableOpacity>
              <TouchableOpacity accessibilityLabel="Next video" style={[styles.hudCircleBtn, currentIndex >= queue.length - 1 && { opacity: 0.35 }]} disabled={currentIndex >= queue.length - 1} onPress={() => skip('next')}><SkipForward size={24} color="#FFFFFF" /></TouchableOpacity>
            </View>
          )}
          <VideoTimeline player={player} media={media} onSeek={seek} onScrubStart={() => setScrubbing(true)} onScrubEnd={() => { setScrubbing(false); controls.reveal() }} />
        </View>
      )}
      <SpeedModal visible={speedVisible} currentSpeed={speed} isVideo onSelectSpeed={(value) => { player.playbackRate = value; setSpeed(value); persist() }} onClose={() => { setSpeedVisible(false); controls.reveal() }} />
      <Modal visible={subtitlesVisible} transparent animationType="fade" onRequestClose={() => setSubtitlesVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border, borderRadius: radii.xl }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>Subtitles</Text>
            {[null, ...subtitleTracks].map((track, index) => (
              <TouchableOpacity key={track?.id || index} style={styles.modalRow} onPress={() => { player.subtitleTrack = track; setSubtitle(track); setSubtitlesVisible(false); controls.reveal() }}>
                <Text style={[styles.modalRowText, { color: theme.colors.textPrimary }]}>{track ? track.label || track.language || `Track ${index}` : 'Off'}</Text>
                {subtitle === track && <Check size={18} color={theme.colors.accentLight} />}
              </TouchableOpacity>
            ))}
            {!subtitleTracks.length && <Text style={{ color: theme.colors.textSecondary, padding: 12 }}>This video has no embedded subtitles.</Text>}
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
    ...StyleSheet.absoluteFill,
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
    gap: 8
  },
  hudCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  centerAction: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8
  },
  seekBadge: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2
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
    fontWeight: '600'
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
