import { NativePlaybackEngine } from './NativePlaybackEngine'
import {
  savePlaybackState,
  recordPlayHistory,
  getLastPlaybackState,
  getMediaItemById,
  updateMediaDuration
} from '../database/db'
import { APP_CONFIG } from '../constants/config'

class PlaybackManagerSingleton {
  constructor() {
    this.engine = NativePlaybackEngine
    this.listeners = new Set()
    this.sleepTimerId = null
    this.sleepTimerRemainingSeconds = 0
    this.sleepTimerIntervalId = null

    // Authoritative state cached from native player
    this.currentState = {
      isPlaying: false,
      playbackState: 1, // 1: IDLE, 2: BUFFERING, 3: READY, 4: ENDED
      position: 0,
      duration: 0,
      speed: 1.0,
      shuffleEnabled: false,
      repeatMode: 0,
      currentMedia: null,
      queue: [],
      currentIndex: -1,
      sleepTimerActive: false,
      sleepTimerMinutesRemaining: null
    }

    // Subscribe to engine broadcasts
    this.engine.subscribe((event, data) => {
      this._handleEngineEvent(event, data)
    })

    // Periodic state persistence to SQLite every 5 seconds while playing
    this.persistenceInterval = setInterval(() => {
      if (this.currentState.isPlaying && this.currentState.currentMedia) {
        this._persistCurrentPosition()
      }
    }, 5000)
  }

  _handleEngineEvent(event, data) {
    if (event === 'onPlaybackStateChanged') {
      const activeMedia = data.currentMedia || this.currentState.currentMedia
      if (data.duration > 0 && activeMedia?.id) {
        if (!activeMedia.duration || activeMedia.duration === 0) {
          activeMedia.duration = data.duration
          updateMediaDuration(activeMedia.id, data.duration).catch(() => {})
        }
      }

      this.currentState = {
        ...this.currentState,
        isPlaying: data.isPlaying,
        playbackState: data.playbackState,
        position: data.position,
        duration: data.duration,
        speed: data.speed,
        shuffleEnabled: data.shuffleEnabled,
        repeatMode: data.repeatMode,
        currentMedia: activeMedia
      }
      this._notifyListeners()
    } else if (event === 'onMediaChanged') {
      this.currentState.currentMedia = data.media
      if (data.media) {
        recordPlayHistory(data.media.id, 0, 0.0).catch(() => {})
      }
      this._notifyListeners()
    } else if (event === 'onQueueChanged') {
      this.currentState.queue = data.queue || []
      this.currentState.currentIndex = data.currentIndex ?? -1
      this._notifyListeners()
    } else if (event === 'onPlayerError') {
      console.warn('Playback Engine Error:', data)
      // Auto-skip failed track
      this.skipToNext().catch(() => {})
    }
  }

  _notifyListeners() {
    const snapshot = { ...this.currentState }
    for (const listener of this.listeners) {
      try {
        listener(snapshot)
      } catch (err) {
        console.error('Error in playback listener:', err)
      }
    }
  }

  subscribe(listener) {
    this.listeners.add(listener)
    listener({ ...this.currentState })
    return () => this.listeners.delete(listener)
  }

  // ---------------- Public Playback Controls ----------------

  async playMedia(mediaItem, queue = null, startIndex = 0) {
    if (queue && queue.length > 0) {
      await this.engine.setQueue(queue, startIndex)
    } else {
      await this.engine.setQueue([mediaItem], 0)
    }
  }

  async play() {
    await this.engine.resume()
  }

  async pause() {
    await this.engine.pause()
    this._persistCurrentPosition()
  }

  async togglePlayPause() {
    if (this.currentState.isPlaying) {
      await this.pause()
    } else {
      await this.play()
    }
  }

  async seekTo(positionMs) {
    await this.engine.seekTo(positionMs)
    this._persistCurrentPosition()
  }

  async seekBy(deltaSeconds) {
    const newPosition = Math.max(0, Math.min(
      this.currentState.position + deltaSeconds * 1000,
      this.currentState.duration || Infinity
    ))
    await this.seekTo(newPosition)
  }

  async skipToNext() {
    await this.engine.skipToNext()
  }

  async skipToPrevious() {
    // If more than 3 seconds in, restart track
    if (this.currentState.position > 3000) {
      await this.seekTo(0)
    } else {
      await this.engine.skipToPrevious()
    }
  }

  async toggleShuffle() {
    const nextState = !this.currentState.shuffleEnabled
    await this.engine.setShuffleMode(nextState)
  }

  async cycleRepeatMode() {
    // 0: OFF -> 2: ALL -> 1: ONE -> 0: OFF
    let nextMode = 0
    if (this.currentState.repeatMode === 0) nextMode = 2
    else if (this.currentState.repeatMode === 2) nextMode = 1
    else nextMode = 0
    await this.engine.setRepeatMode(nextMode)
  }

  async setPlaybackSpeed(speed) {
    await this.engine.setPlaybackSpeed(speed)
  }

  async addToQueue(mediaItem) {
    await this.engine.addToQueue(mediaItem)
  }

  async playNext(mediaItem) {
    await this.engine.addNext(mediaItem)
  }

  async removeFromQueue(index) {
    await this.engine.removeFromQueue(index)
  }

  // ---------------- Sleep Timer (Section 38) ----------------

  startSleepTimer(minutes) {
    this.cancelSleepTimer()
    if (!minutes || minutes <= 0) return

    this.sleepTimerRemainingSeconds = minutes * 60
    this.currentState.sleepTimerActive = true
    this.currentState.sleepTimerMinutesRemaining = minutes
    this._notifyListeners()

    this.sleepTimerIntervalId = setInterval(() => {
      this.sleepTimerRemainingSeconds--
      const minutesLeft = Math.ceil(this.sleepTimerRemainingSeconds / 60)
      if (minutesLeft !== this.currentState.sleepTimerMinutesRemaining) {
        this.currentState.sleepTimerMinutesRemaining = minutesLeft
        this._notifyListeners()
      }

      if (this.sleepTimerRemainingSeconds <= 0) {
        this.cancelSleepTimer()
        this.pause()
      }
    }, 1000)
  }

  cancelSleepTimer() {
    if (this.sleepTimerIntervalId) {
      clearInterval(this.sleepTimerIntervalId)
      this.sleepTimerIntervalId = null
    }
    this.sleepTimerRemainingSeconds = 0
    this.currentState.sleepTimerActive = false
    this.currentState.sleepTimerMinutesRemaining = null
    this._notifyListeners()
  }

  // ---------------- Persistence & Resumption (Section 21) ----------------

  async _persistCurrentPosition() {
    const { currentMedia, position, duration, speed } = this.currentState
    if (!currentMedia) return

    const completion = duration > 0 ? position / duration : 0
    // If past completion threshold (90%), treat as completed
    const effectivePosition = completion >= APP_CONFIG.playback.completionThresholdRatio ? 0 : position

    await savePlaybackState({
      mediaId: currentMedia.id,
      position: effectivePosition,
      duration: duration || 0,
      speed: speed || 1.0,
      isVideo: currentMedia.type === 'video' ? 1 : 0
    }).catch(() => {})
  }

  async restoreLastPlaybackSession(isVideo = 0) {
    const lastSession = await getLastPlaybackState(isVideo)
    if (lastSession) {
      const mediaItem = await getMediaItemById(lastSession.mediaId)
      if (mediaItem) {
        this.currentState.currentMedia = mediaItem
        this.currentState.position = lastSession.position
        this.currentState.duration = lastSession.duration
        this.currentState.speed = lastSession.speed
        this._notifyListeners()
        return { mediaItem, session: lastSession }
      }
    }
    return null
  }
}

export const PlaybackManager = new PlaybackManagerSingleton()
