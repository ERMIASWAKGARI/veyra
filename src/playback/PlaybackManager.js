import { AppState } from 'react-native'
import { NativePlaybackEngine } from './NativePlaybackEngine'
import { PlaybackController } from './PlaybackController'
import * as repository from '../database/db'

export const PlaybackManager = new PlaybackController(NativePlaybackEngine, repository)

PlaybackManager.setForeground(AppState.currentState === 'active')
AppState.addEventListener('change', (state) => PlaybackManager.setForeground(state === 'active'))
