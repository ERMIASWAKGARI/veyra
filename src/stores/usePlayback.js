import { useState, useEffect } from 'react'
import { PlaybackManager } from '../playback/PlaybackManager'

export function usePlayback() {
  const [playbackState, setPlaybackState] = useState(PlaybackManager.currentState)

  useEffect(() => {
    const unsubscribe = PlaybackManager.subscribe((newState) => {
      setPlaybackState(newState)
    })
    return unsubscribe
  }, [])

  return {
    ...playbackState,
    playMedia: (media, queue, index) => PlaybackManager.playMedia(media, queue, index),
    play: () => PlaybackManager.play(),
    pause: () => PlaybackManager.pause(),
    togglePlayPause: () => PlaybackManager.togglePlayPause(),
    seekTo: (ms) => PlaybackManager.seekTo(ms),
    seekBy: (deltaSec) => PlaybackManager.seekBy(deltaSec),
    skipToNext: () => PlaybackManager.skipToNext(),
    skipToPrevious: () => PlaybackManager.skipToPrevious(),
    toggleShuffle: () => PlaybackManager.toggleShuffle(),
    cycleRepeatMode: () => PlaybackManager.cycleRepeatMode(),
    setPlaybackSpeed: (speed) => PlaybackManager.setPlaybackSpeed(speed),
    addToQueue: (item) => PlaybackManager.addToQueue(item),
    playNext: (item) => PlaybackManager.playNext(item),
    removeFromQueue: (index) => PlaybackManager.removeFromQueue(index),
    startSleepTimer: (minutes) => PlaybackManager.startSleepTimer(minutes),
    cancelSleepTimer: () => PlaybackManager.cancelSleepTimer(),
    restoreLastSession: (isVideo) => PlaybackManager.restoreLastPlaybackSession(isVideo)
  }
}
