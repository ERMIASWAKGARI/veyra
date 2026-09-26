export const APP_CONFIG = {
  appName: 'VEYRA',
  tagline: 'Fast, lightweight, offline-first media player',
  version: '1.0.0',
  buildNumber: 1,
  packageId: 'com.veyra.player',
  storageKeys: {
    theme: '@veyra_theme',
    lastPlayedMediaId: '@veyra_last_played_id',
    playbackSettings: '@veyra_playback_settings',
    hasCompletedInitialScan: '@veyra_initial_scan_done'
  },
  playback: {
    audioSpeeds: [0.75, 1.0, 1.25, 1.5, 2.0],
    videoSpeeds: [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0],
    skipIntervalSeconds: 10,
    completionThresholdRatio: 0.9, // Media considered completed when watched past 90%
    sleepTimerPresetsMinutes: [10, 20, 30, 45, 60]
  },
  database: {
    name: 'veyra.db',
    version: 1
  },
  supportedAudioMimeTypes: [
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a',
    'audio/aac',
    'audio/flac',
    'audio/ogg',
    'audio/wav',
    'audio/x-wav'
  ],
  supportedVideoMimeTypes: [
    'video/mp4',
    'video/mkv',
    'video/x-matroska',
    'video/webm',
    'video/3gpp',
    'video/quicktime'
  ]
}
