import { useSyncExternalStore } from 'react'
import { PlaybackManager } from '../playback/PlaybackManager'

const actions = {
  playMedia: PlaybackManager.playMedia.bind(PlaybackManager),
  shuffleMedia: PlaybackManager.shuffleMedia.bind(PlaybackManager),
  play: PlaybackManager.play.bind(PlaybackManager),
  pause: PlaybackManager.pause.bind(PlaybackManager),
  togglePlayPause: PlaybackManager.togglePlayPause.bind(PlaybackManager),
  seekTo: PlaybackManager.seekTo.bind(PlaybackManager),
  seekBy: PlaybackManager.seekBy.bind(PlaybackManager),
  skipToNext: PlaybackManager.skipToNext.bind(PlaybackManager),
  skipToPrevious: PlaybackManager.skipToPrevious.bind(PlaybackManager),
  toggleShuffle: PlaybackManager.toggleShuffle.bind(PlaybackManager),
  cycleRepeatMode: PlaybackManager.cycleRepeatMode.bind(PlaybackManager),
  setPlaybackSpeed: PlaybackManager.setPlaybackSpeed.bind(PlaybackManager),
  addToQueue: PlaybackManager.addToQueue.bind(PlaybackManager),
  playNext: PlaybackManager.playNext.bind(PlaybackManager),
  removeFromQueue: PlaybackManager.removeFromQueue.bind(PlaybackManager),
  startSleepTimer: PlaybackManager.startSleepTimer.bind(PlaybackManager),
  cancelSleepTimer: PlaybackManager.cancelSleepTimer.bind(PlaybackManager),
  restoreLastSession: PlaybackManager.restoreLastPlaybackSession.bind(PlaybackManager)
}

export function usePlayback({ progress = false } = {}) {
  const state = useSyncExternalStore(
    progress ? PlaybackManager.subscribeProgress : PlaybackManager.subscribe,
    progress ? PlaybackManager.getProgressSnapshot : PlaybackManager.getSnapshot,
    progress ? PlaybackManager.getProgressSnapshot : PlaybackManager.getSnapshot
  )
  return { ...state, ...actions }
}
