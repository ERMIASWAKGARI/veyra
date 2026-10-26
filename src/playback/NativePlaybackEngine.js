import { NativeModules, NativeEventEmitter, Platform } from 'react-native'

const { VeyraPlayback } = NativeModules

/**
 * NativePlaybackEngine encapsulates communication with the Android Jetpack Media3
 * MediaSessionService, or falls back to standard HTML5/WebAudio in dev/web environments
 * and expo-video ExoPlayer on native devices without the custom native module.
 */
class NativePlaybackEngineWrapper {
  constructor() {
    this.isNativeAvailable = Platform.OS === 'android' && !!VeyraPlayback
    this.progressUpdatesEnabled = false
    this.loadId = 0
    this.eventEmitter = this.isNativeAvailable ? new NativeEventEmitter(VeyraPlayback) : null
    this.listeners = new Set()

    // Fallback player state if custom native module is not present
    this.fallbackState = {
      isPlaying: false,
      playbackState: 1, // 1: IDLE, 2: BUFFERING, 3: READY, 4: ENDED
      position: 0,
      duration: 0,
      speed: 1.0,
      shuffleEnabled: false,
      repeatMode: 0, // 0: OFF, 1: ONE, 2: ALL
      currentMedia: null,
      queue: [],
      currentIndex: -1
    }
    this.fallbackAudio = null // For Web
    this.nativePlayer = null  // For Native fallback (Expo Go / Dev mode)
    this.nativePlayerSubscriptions = []
    this.shuffledIndices = []

    if (this.isNativeAvailable && this.eventEmitter) {
      this.eventEmitter.addListener('onPlaybackProgress', (state) => {
        this.notify('onPlaybackProgress', state)
      })
      this.eventEmitter.addListener('onPlaybackStateChanged', (state) => {
        this.notify('onPlaybackStateChanged', state)
      })
      this.eventEmitter.addListener('onMediaChanged', (data) => {
        this.notify('onMediaChanged', data)
      })
      this.eventEmitter.addListener('onQueueChanged', (data) => {
        this.notify('onQueueChanged', data)
      })
      this.eventEmitter.addListener('onPlayerError', (err) => {
        this.notify('onPlayerError', err)
      })
    }
  }

  subscribe(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  notify(event, data) {
    for (const listener of this.listeners) {
      try {
        listener(event, data)
      } catch (e) {
        console.error('Error notifying listener:', e)
      }
    }
  }

  // ---------------- Core Playback Controls ----------------

  async play(mediaItem) {
    if (this.isNativeAvailable) {
      return VeyraPlayback.play(mediaItem)
    }
    return this._playFallback(mediaItem)
  }

  async pause() {
    if (this.isNativeAvailable) {
      return VeyraPlayback.pause()
    }
    this._pauseFallback()
  }

  async resume() {
    if (this.isNativeAvailable) {
      return VeyraPlayback.resume()
    }
    this._resumeFallback()
  }

  async stop() {
    if (this.isNativeAvailable) {
      return VeyraPlayback.stop()
    }
    this._stopFallback()
  }

  async seekTo(positionMs) {
    if (this.isNativeAvailable) {
      return VeyraPlayback.seekTo(positionMs)
    }
    this._seekFallback(positionMs)
  }

  async skipToNext() {
    if (this.isNativeAvailable) {
      return VeyraPlayback.skipToNext()
    }
    return this._skipNextFallback()
  }

  async skipToPrevious() {
    if (this.isNativeAvailable) {
      return VeyraPlayback.skipToPrevious()
    }
    return this._skipPrevFallback()
  }

  async setQueue(items, startIndex = 0) {
    if (this.isNativeAvailable) {
      return VeyraPlayback.setQueue(items, startIndex)
    }
    return this._setQueueFallback(items, startIndex)
  }

  async addToQueue(item) {
    if (this.isNativeAvailable) {
      return VeyraPlayback.addToQueue(item)
    }
    this._addToQueueFallback(item)
  }

  async addNext(item) {
    if (this.isNativeAvailable) {
      return VeyraPlayback.addNext(item)
    }
    this._addNextFallback(item)
  }

  async removeFromQueue(index) {
    if (this.isNativeAvailable) {
      return VeyraPlayback.removeFromQueue(index)
    }
    this._removeFromQueueFallback(index)
  }

  async setShuffleMode(enabled) {
    if (this.isNativeAvailable) {
      return VeyraPlayback.setShuffleMode(enabled)
    }
    this._setShuffleFallback(enabled)
  }

  async setRepeatMode(mode) {
    if (this.isNativeAvailable) {
      return VeyraPlayback.setRepeatMode(mode)
    }
    this._setRepeatFallback(mode)
  }

  async setPlaybackSpeed(speed) {
    if (this.isNativeAvailable) {
      return VeyraPlayback.setPlaybackSpeed(speed)
    }
    this._setSpeedFallback(speed)
  }

  async getPlaybackState() {
    if (this.isNativeAvailable) {
      return VeyraPlayback.getPlaybackState()
    }
    if (this.nativePlayer) {
      this.fallbackState.position = this.nativePlayer.currentTime * 1000
      this.fallbackState.duration = this.nativePlayer.duration * 1000 || this.fallbackState.duration
    } else if (this.fallbackAudio) {
      this.fallbackState.position = this.fallbackAudio.currentTime * 1000
    }
    return { ...this.fallbackState }
  }

  setProgressUpdatesEnabled(enabled) {
    this.progressUpdatesEnabled = enabled
    if (this.isNativeAvailable) VeyraPlayback.setProgressUpdatesEnabled?.(enabled)
    else if (this.nativePlayer) this.nativePlayer.timeUpdateEventInterval = enabled ? 0.5 : 0
  }

  setAutoplayEnabled(enabled) {
    this.autoplayEnabled = enabled
    if (this.isNativeAvailable) VeyraPlayback.setAutoplayEnabled?.(enabled)
  }

  setSleepTimer(durationMs) {
    if (this.isNativeAvailable) VeyraPlayback.setSleepTimer?.(durationMs)
  }

  _emitProgress() {
    if (!this.progressUpdatesEnabled) return
    this.notify('onPlaybackProgress', {
      mediaId: this.fallbackState.currentMedia?.id,
      position: this.fallbackState.position,
      duration: this.fallbackState.duration
    })
  }

  // ---------------- Fallback implementation for dev & web ----------------

  _initAudioElementIfNeeded() {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (!this.fallbackAudio) {
        this.fallbackAudio = new Audio()
        this.fallbackAudio.addEventListener('play', () => {
          this.fallbackState.isPlaying = true
          this.fallbackState.playbackState = 3
          this._emitFallbackState()
        })
        this.fallbackAudio.addEventListener('pause', () => {
          this.fallbackState.isPlaying = false
          this._emitFallbackState()
        })
        this.fallbackAudio.addEventListener('timeupdate', () => {
          this.fallbackState.position = (this.fallbackAudio.currentTime || 0) * 1000
          this._emitProgress()
        })
        this.fallbackAudio.addEventListener('loadedmetadata', () => {
          this.fallbackState.duration = (this.fallbackAudio.duration || 0) * 1000
          this._emitFallbackState()
        })
        this.fallbackAudio.addEventListener('ended', () => {
          this._onTrackEnded()
        })
        this.fallbackAudio.addEventListener('error', (e) => {
          this.notify('onPlayerError', { errorCode: 1, message: 'Playback failed for this track' })
        })
      }
    }
  }

  _initNativePlayer(uri) {
    if (Platform.OS === 'web') return

    this._cleanupNativePlayer()

    try {
      const { createVideoPlayer } = require('expo-video')
      this.nativePlayer = createVideoPlayer(uri)
      this.nativePlayer.loop = false
      this.nativePlayer.volume = 1.0
      this.nativePlayer.muted = false
      this.nativePlayer.playbackRate = this.fallbackState.speed
      this.nativePlayer.timeUpdateEventInterval = this.progressUpdatesEnabled ? 0.5 : 0

      const subPlaying = this.nativePlayer.addListener('playingChange', ({ isPlaying }) => {
        this.fallbackState.isPlaying = isPlaying
        this.fallbackState.playbackState = isPlaying ? 3 : 1
        this._emitFallbackState()
      })

      const subTime = this.nativePlayer.addListener('timeUpdate', ({ currentTime }) => {
        this.fallbackState.position = (currentTime || 0) * 1000
        if (this.nativePlayer?.duration && this.nativePlayer.duration > 0) {
          this.fallbackState.duration = this.nativePlayer.duration * 1000
        }
        this._emitProgress()
      })

      const subStatus = this.nativePlayer.addListener('statusChange', ({ status, error }) => {
        this.fallbackState.playbackState = status === 'loading' ? 2 : status === 'readyToPlay' ? 3 : 1
        this._emitFallbackState()
        if (error) {
          console.warn('Native fallback player status error:', error)
          this.notify('onPlayerError', { errorCode: 1, message: error?.message || 'Playback failed' })
        }
      })

      const subEnd = this.nativePlayer.addListener('playToEnd', () => {
        this._onTrackEnded()
      })

      this.nativePlayerSubscriptions = [subPlaying, subTime, subStatus, subEnd]
    } catch (e) {
      console.warn('Failed to initialize native fallback player:', e)
    }
  }

  _cleanupNativePlayer() {
    if (this.nativePlayerSubscriptions) {
      for (const sub of this.nativePlayerSubscriptions) {
        try { sub.remove?.() } catch {}
      }
      this.nativePlayerSubscriptions = []
    }
    if (this.nativePlayer) {
      try {
        this.nativePlayer.pause()
        this.nativePlayer.release?.()
      } catch {}
      this.nativePlayer = null
    }
  }

  async _playFallback(mediaItem) {
    if (!mediaItem) return

    this.fallbackState.currentMedia = mediaItem
    this.fallbackState.position = 0
    this.fallbackState.duration = mediaItem.duration || 0
    this.fallbackState.isPlaying = false
    this.fallbackState.playbackState = 2

    const loadId = ++this.loadId
    try {
      if (Platform.OS === 'web') {
        this._initAudioElementIfNeeded()
        if (this.fallbackAudio && mediaItem.uri) {
          this.fallbackAudio.src = mediaItem.uri
          this.fallbackAudio.playbackRate = this.fallbackState.speed
          await this.fallbackAudio.play()
        }
      } else {
        if (!this.nativePlayer) this._initNativePlayer(null)
        if (!this.nativePlayer) throw new Error('Audio player unavailable')
        await this.nativePlayer.replaceAsync(mediaItem.uri)
        if (loadId !== this.loadId) return
        this.nativePlayer.playbackRate = this.fallbackState.speed
        this.nativePlayer.play()
      }
    } catch (error) {
      if (loadId !== this.loadId) return
      this.fallbackState.isPlaying = false
      this.notify('onPlayerError', { errorCode: 1, message: error.message || 'Unable to play this file' })
      return
    }
    if (loadId !== this.loadId) return

    this.notify('onMediaChanged', { media: mediaItem })
    this._emitFallbackState()
  }

  _pauseFallback() {
    this.fallbackState.isPlaying = false
    if (Platform.OS === 'web' && this.fallbackAudio) {
      this.fallbackAudio.pause()
    } else if (this.nativePlayer) {
      this.nativePlayer.pause()
    }
    this._emitFallbackState()
  }

  _resumeFallback() {
    this.fallbackState.isPlaying = true
    if (Platform.OS === 'web' && this.fallbackAudio) {
      this.fallbackAudio.play().catch(() => {})
    } else if (this.nativePlayer) {
      this.nativePlayer.play()
    }
    this._emitFallbackState()
  }

  _stopFallback() {
    ++this.loadId
    this.fallbackState.isPlaying = false
    this.fallbackState.position = 0
    if (Platform.OS === 'web' && this.fallbackAudio) {
      this.fallbackAudio.pause()
      this.fallbackAudio.currentTime = 0
    } else if (this.nativePlayer) {
      this._cleanupNativePlayer()
    }
    this._emitFallbackState()
  }

  _seekFallback(positionMs) {
    this.fallbackState.position = positionMs
    if (Platform.OS === 'web' && this.fallbackAudio) {
      this.fallbackAudio.currentTime = positionMs / 1000
    } else if (this.nativePlayer) {
      this.nativePlayer.currentTime = positionMs / 1000
    }
    this._emitFallbackState()
  }

  async _setQueueFallback(items, startIndex = 0) {
    this.fallbackState.queue = [...items]
    this.fallbackState.currentIndex = startIndex
    this._generateShuffledIndices()
    this.notify('onQueueChanged', { queue: this.fallbackState.queue, currentIndex: startIndex })
    if (items[startIndex]) {
      await this._playFallback(items[startIndex])
    }
  }

  _addToQueueFallback(item) {
    this.fallbackState.queue.push(item)
    this._generateShuffledIndices()
    this.notify('onQueueChanged', {
      queue: this.fallbackState.queue,
      currentIndex: this.fallbackState.currentIndex
    })
  }

  _addNextFallback(item) {
    const insertIndex = this.fallbackState.currentIndex + 1
    this.fallbackState.queue.splice(insertIndex, 0, item)
    this._generateShuffledIndices()
    this.notify('onQueueChanged', {
      queue: this.fallbackState.queue,
      currentIndex: this.fallbackState.currentIndex
    })
  }

  _removeFromQueueFallback(index) {
    if (index >= 0 && index < this.fallbackState.queue.length) {
      const wasCurrent = index === this.fallbackState.currentIndex
      if (index < this.fallbackState.currentIndex) this.fallbackState.currentIndex--
      this.fallbackState.queue.splice(index, 1)
      if (this.fallbackState.currentIndex >= this.fallbackState.queue.length) {
        this.fallbackState.currentIndex = this.fallbackState.queue.length - 1
      }
      if (wasCurrent) {
        const next = this.fallbackState.queue[this.fallbackState.currentIndex]
        if (next) this._playFallback(next)
        else {
          this._stopFallback()
          this.fallbackState.currentMedia = null
          this.notify('onMediaChanged', { media: null })
        }
      }
      this._generateShuffledIndices()
      this.notify('onQueueChanged', {
        queue: this.fallbackState.queue,
        currentIndex: this.fallbackState.currentIndex
      })
    }
  }

  _setShuffleFallback(enabled) {
    this.fallbackState.shuffleEnabled = enabled
    this._generateShuffledIndices()
    this._emitFallbackState()
  }

  _setRepeatFallback(mode) {
    this.fallbackState.repeatMode = mode
    this._emitFallbackState()
  }

  _setSpeedFallback(speed) {
    this.fallbackState.speed = speed
    if (Platform.OS === 'web' && this.fallbackAudio) {
      this.fallbackAudio.playbackRate = speed
    } else if (this.nativePlayer) {
      this.nativePlayer.playbackRate = speed
    }
    this._emitFallbackState()
  }

  _generateShuffledIndices() {
    const count = this.fallbackState.queue.length
    const indices = Array.from({ length: count }, (_, i) => i)
    // Fisher-Yates shuffle
    for (let i = count - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const temp = indices[i]
      indices[i] = indices[j]
      indices[j] = temp
    }
    this.shuffledIndices = indices
  }

  _skipNextFallback() {
    const queue = this.fallbackState.queue
    if (queue.length === 0) return

    let nextIndex = this.fallbackState.currentIndex + 1
    if (this.fallbackState.shuffleEnabled && this.shuffledIndices.length > 0) {
      const currentPos = this.shuffledIndices.indexOf(this.fallbackState.currentIndex)
      const nextPos = currentPos + 1
      nextIndex = nextPos < this.shuffledIndices.length ? this.shuffledIndices[nextPos] : queue.length
    }

    if (nextIndex >= queue.length) {
      if (this.fallbackState.repeatMode === 2) {
        // Repeat All
        nextIndex = this.fallbackState.shuffleEnabled ? this.shuffledIndices[0] : 0
      } else {
        this._pauseFallback()
        return
      }
    }

    this.fallbackState.currentIndex = nextIndex
    this._playFallback(queue[nextIndex])
    this.notify('onQueueChanged', { queue, currentIndex: nextIndex })
  }

  _skipPrevFallback() {
    const queue = this.fallbackState.queue
    if (queue.length === 0) return

    let prevIndex = this.fallbackState.currentIndex - 1
    if (this.fallbackState.shuffleEnabled) {
      const shuffledPosition = this.shuffledIndices.indexOf(this.fallbackState.currentIndex)
      prevIndex = this.shuffledIndices[Math.max(0, shuffledPosition - 1)]
    }
    if (prevIndex < 0) prevIndex = 0
    this.fallbackState.currentIndex = prevIndex
    this._playFallback(queue[prevIndex])
    this.notify('onQueueChanged', { queue, currentIndex: prevIndex })
  }

  _onTrackEnded() {
    if (this.autoplayEnabled === false) {
      this._pauseFallback()
      return
    }
    if (this.fallbackState.repeatMode === 1) {
      // Repeat One
      if (Platform.OS === 'web' && this.fallbackAudio) {
        this.fallbackAudio.currentTime = 0
        this.fallbackAudio.play().catch(() => {})
      } else if (this.nativePlayer) {
        this.nativePlayer.currentTime = 0
        this.nativePlayer.play()
      }
      this.fallbackState.position = 0
      this._emitFallbackState()
    } else {
      this._skipNextFallback()
    }
  }

  _emitFallbackState() {
    this.notify('onPlaybackStateChanged', { ...this.fallbackState })
  }
}

export const NativePlaybackEngine = new NativePlaybackEngineWrapper()
