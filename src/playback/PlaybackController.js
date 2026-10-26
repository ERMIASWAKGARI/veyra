import { APP_CONFIG } from '../constants/config.js'

const INITIAL_STATE = {
  isPlaying: false, playbackState: 1, position: 0, duration: 0,
  speed: 1, shuffleEnabled: false, repeatMode: 0,
  currentMedia: null, queue: [], currentIndex: -1,
  sleepTimerActive: false, sleepTimerMinutesRemaining: null, error: null
}

// Clock ticks have their own subscribers so they cannot redraw library screens.
export class PlaybackController {
  constructor(engine, repository) {
    this.engine = engine
    this.repository = repository
    this.currentState = { ...INITIAL_STATE }
    this.snapshot = this.currentState
    this.listeners = new Set()
    this.progressListeners = new Set()
    this.owner = 'audio'
    this.foreground = true
    this.videoControls = null
    this.lastPersistedAt = 0
    this.failedIds = new Set()
    this.commandId = 0
    this.preferencesReady = repository.getSetting('autoplayNext', true).then((enabled) => engine.setAutoplayEnabled?.(enabled)).catch(() => {})
    this.unsubscribeEngine = engine.subscribe((event, data) => this._handleEngineEvent(event, data))
    engine.getPlaybackState().then((state) => {
      if (this.commandId === 0 && state?.currentMedia) {
        this._handleEngineEvent('onQueueChanged', state)
        this._handleEngineEvent('onPlaybackStateChanged', state)
      }
    }).catch(() => {})
  }

  _commit(patch) {
    const changedKeys = Object.keys(patch).filter((key) => !Object.is(this.currentState[key], patch[key]))
    if (!changedKeys.length) return
    this.currentState = { ...this.currentState, ...patch }
    if (changedKeys.some((key) => key !== 'position')) {
      this.snapshot = this.currentState
      for (const listener of this.listeners) listener()
    }
    for (const listener of this.progressListeners) listener()
    if (this.currentState.isPlaying && Date.now() - this.lastPersistedAt >= 10000) {
      this.lastPersistedAt = Date.now()
      this._persistCurrentPosition()
    }
  }

  subscribe = (listener) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  subscribeProgress = (listener) => {
    this.progressListeners.add(listener)
    this._updateProgressTracking()
    return () => {
      this.progressListeners.delete(listener)
      this._updateProgressTracking()
    }
  }

  getSnapshot = () => this.snapshot
  getProgressSnapshot = () => this.currentState

  _updateProgressTracking() {
    this.engine.setProgressUpdatesEnabled?.(this.foreground && this.progressListeners.size > 0 && this.owner === 'audio')
  }

  setForeground(active) {
    this.foreground = active
    this._updateProgressTracking()
    if (!active) this._persistCurrentPosition()
    else if (this.owner === 'audio') {
      this.engine.getPlaybackState().then((state) => {
        if (this.owner !== 'audio') return
        this._handleEngineEvent('onQueueChanged', state)
        this._handleEngineEvent('onPlaybackStateChanged', state)
      }).catch(() => {})
    }
    this._updateSleepTimer()
  }

  _resolveMedia(media) {
    if (!media) return null
    return this.currentState.queue.find((item) => item.id === media.id)
      || (this.currentState.currentMedia?.id === media.id ? this.currentState.currentMedia : media)
  }

  _handleEngineEvent(event, data) {
    if (this.owner !== 'audio' || !data) return
    if (event === 'onPlaybackProgress') {
      if (data.mediaId && data.mediaId !== this.currentState.currentMedia?.id) return
      this._commit({ position: data.position || 0, duration: data.duration || this.currentState.duration })
    } else if (event === 'onPlaybackStateChanged') {
      const media = this._resolveMedia(data.currentMedia)
      const changedMedia = media && media.id !== this.currentState.currentMedia?.id
      if (changedMedia) this._persistCurrentPosition()
      this._commit({
        isPlaying: !!data.isPlaying, playbackState: data.playbackState ?? this.currentState.playbackState,
        position: data.position ?? this.currentState.position,
        duration: data.duration || (changedMedia ? media.duration || 0 : this.currentState.duration),
        speed: data.speed ?? this.currentState.speed,
        shuffleEnabled: data.shuffleEnabled ?? this.currentState.shuffleEnabled,
        repeatMode: data.repeatMode ?? this.currentState.repeatMode,
        ...(media ? { currentMedia: media } : {})
      })
      if (data.duration > 0 && media?.id && !media.duration) {
        this.repository.updateMediaDuration(media.id, data.duration).catch(() => {})
      }
      if (!data.isPlaying) this._persistCurrentPosition()
    } else if (event === 'onMediaChanged') {
      const media = this._resolveMedia(data.media)
      const changed = media?.id !== this.currentState.currentMedia?.id
      if (changed) this._persistCurrentPosition()
      this._commit({ currentMedia: media, ...(changed ? { position: 0, duration: media?.duration || 0 } : {}) })
      if (media) this.repository.recordPlayHistory(media.id, 0, 0).catch(() => {})
    } else if (event === 'onQueueChanged') {
      const patch = {}
      if (data.queue) {
        const queue = data.queue.map((item) => this._resolveMedia(item))
        if (queue.length !== this.currentState.queue.length || queue.some((item, index) => item !== this.currentState.queue[index])) patch.queue = queue
      }
      if (data.currentIndex != null) patch.currentIndex = data.currentIndex
      if (data.queue?.length === 0) Object.assign(patch, { currentMedia: null, position: 0, duration: 0, isPlaying: false })
      this._commit(patch)
    } else if (event === 'onPlayerError') {
      this.failedIds.add(this.currentState.currentMedia?.id)
      this._commit({ error: data.message || 'Unable to play this file.', isPlaying: false })
      const nextIndex = this.currentState.queue.findIndex((item) => !this.failedIds.has(item.id))
      if (nextIndex >= 0) this.engine.setQueue(this.currentState.queue, nextIndex).catch(() => {})
    }
  }

  async playMedia(mediaItem, queue = null, startIndex = 0, { shuffle = false } = {}) {
    if (!mediaItem?.uri) return
    this._persistCurrentPosition()
    const command = ++this.commandId
    this.failedIds.clear()
    const items = queue?.length ? queue : [mediaItem]
    const selected = items[startIndex] || mediaItem
    const type = selected.type || 'audio'
    const filteredQueue = items.filter((item) => (item.type || 'audio') === type)
    const index = Math.max(0, filteredQueue.indexOf(selected))
    this.owner = type
    this.videoControls = null
    this._commit({
      currentMedia: selected, queue: filteredQueue, currentIndex: index,
      position: 0, duration: selected.duration || 0, isPlaying: false,
      playbackState: 2, shuffleEnabled: shuffle, error: null
    })
    this._updateProgressTracking()
    // Video is decoded only by the visible video player, never also by the audio service.
    if (type === 'video') {
      this.videoReady = this.engine.stop()
      await this.videoReady
    }
    else {
      await this.preferencesReady
      if (command !== this.commandId) return
      await this.engine.setQueue(filteredQueue, index)
      if (command !== this.commandId) return
      await this.engine.setShuffleMode(shuffle)
    }
  }

  async shuffleMedia(items) {
    if (!items?.length) return
    const index = Math.floor(Math.random() * items.length)
    await this.playMedia(items[index], items, index, { shuffle: true })
  }

  async play() {
    if (this.owner === 'video') return this.videoControls?.play()
    await this.engine.resume()
  }

  async pause() {
    if (this.owner === 'video') this.videoControls?.pause()
    else await this.engine.pause()
    this._persistCurrentPosition()
  }

  async togglePlayPause() {
    return this.currentState.isPlaying ? this.pause() : this.play()
  }

  async seekTo(positionMs) {
    const position = Math.max(0, Math.min(positionMs, this.currentState.duration || Infinity))
    if (this.owner === 'video') this.videoControls?.seekTo(position)
    else await this.engine.seekTo(position)
    this._commit({ position })
    this._persistCurrentPosition()
  }

  async seekBy(deltaSeconds) {
    return this.seekTo(this.currentState.position + deltaSeconds * 1000)
  }

  async skipToNext() {
    if (this.owner !== 'video') return this.engine.skipToNext()
    const { queue, currentIndex, repeatMode } = this.currentState
    const index = currentIndex + 1 < queue.length ? currentIndex + 1 : repeatMode === 2 ? 0 : -1
    if (index < 0) return this.pause()
    return this.playMedia(queue[index], queue, index)
  }

  async skipToPrevious() {
    if (this.currentState.position > 3000) return this.seekTo(0)
    if (this.owner !== 'video') return this.engine.skipToPrevious()
    const { queue, currentIndex } = this.currentState
    const index = Math.max(0, currentIndex - 1)
    return this.playMedia(queue[index], queue, index)
  }

  async toggleShuffle() { await this.engine.setShuffleMode(!this.currentState.shuffleEnabled) }
  async cycleRepeatMode() { await this.engine.setRepeatMode({ 0: 2, 2: 1, 1: 0 }[this.currentState.repeatMode]) }
  async setPlaybackSpeed(speed) {
    if (this.owner === 'video') this.videoControls?.setSpeed(speed)
    else await this.engine.setPlaybackSpeed(speed)
    this._commit({ speed })
  }
  async addToQueue(item) {
    if (this.owner === 'audio' && item.type !== 'video') await this.engine.addToQueue(item)
  }
  async playNext(item) {
    if (this.owner === 'audio' && item.type !== 'video') await this.engine.addNext(item)
  }
  async removeFromQueue(index) { await this.engine.removeFromQueue(index) }

  attachVideo(mediaId, controls) {
    this.videoControls = controls
    return () => {
      if (this.currentState.currentMedia?.id === mediaId && this.videoControls === controls) {
        this.videoControls = null
        this._commit({ isPlaying: false })
        this._persistCurrentPosition()
      }
    }
  }

  updateVideo(mediaId, patch) {
    if (this.owner === 'video' && this.currentState.currentMedia?.id === mediaId) this._commit(patch)
  }

  startSleepTimer(minutes) {
    this.cancelSleepTimer()
    if (!(minutes > 0)) return
    this.sleepDeadline = Date.now() + minutes * 60000
    this.engine.setSleepTimer?.(minutes * 60000)
    this.sleepTimeout = setTimeout(() => { this.pause(); this.cancelSleepTimer() }, minutes * 60000)
    this.sleepInterval = setInterval(() => this._updateSleepTimer(), 30000)
    this._updateSleepTimer()
  }

  _updateSleepTimer() {
    if (!this.sleepDeadline) return
    if (Date.now() >= this.sleepDeadline) {
      this.pause()
      this.cancelSleepTimer()
    } else this._commit({ sleepTimerActive: true, sleepTimerMinutesRemaining: Math.ceil((this.sleepDeadline - Date.now()) / 60000) })
  }

  cancelSleepTimer() {
    clearTimeout(this.sleepTimeout)
    clearInterval(this.sleepInterval)
    this.sleepDeadline = null
    this.engine.setSleepTimer?.(0)
    this._commit({ sleepTimerActive: false, sleepTimerMinutesRemaining: null })
  }

  async _persistCurrentPosition() {
    const { currentMedia, position, duration, speed } = this.currentState
    if (!currentMedia) return
    const completed = duration > 0 && position / duration >= APP_CONFIG.playback.completionThresholdRatio
    await this.repository.savePlaybackState({
      mediaId: currentMedia.id, position: completed ? 0 : position,
      duration, speed, isVideo: currentMedia.type === 'video' ? 1 : 0
    }).catch(() => {})
  }

  async restoreLastPlaybackSession(isVideo = 0) {
    const session = await this.repository.getLastPlaybackState(isVideo)
    if (!session) return null
    const mediaItem = await this.repository.getMediaItemById(session.mediaId)
    return mediaItem ? { mediaItem, session } : null
  }

  dispose() {
    this.cancelSleepTimer()
    this.unsubscribeEngine()
    this.listeners.clear()
    this.progressListeners.clear()
    this.engine.setProgressUpdatesEnabled?.(false)
  }
}
