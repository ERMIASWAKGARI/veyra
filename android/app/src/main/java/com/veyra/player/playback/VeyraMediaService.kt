package com.veyra.player.playback

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioManager
import android.os.Bundle
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionResult
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

/**
 * Authoritative native playback service for VEYRA using AndroidX Jetpack Media3.
 * Runs in the foreground independently of the React Native Activity lifecycle.
 */
class VeyraMediaService : MediaSessionService() {

    private var mediaSession: MediaSession? = null
    lateinit var player: ExoPlayer
        private set

    private var becomingNoisyReceiver: BroadcastReceiver? = null
    private var isReceiverRegistered = false

    interface StateChangeListener {
        fun onPlaybackStateChanged(isPlaying: Boolean, playbackState: Int, currentItem: MediaItem?, positionMs: Long, durationMs: Long)
        fun onQueueChanged(queue: List<MediaItem>, currentIndex: Int)
        fun onError(error: PlaybackException)
    }

    var stateChangeListener: StateChangeListener? = null

    @OptIn(UnstableApi::class)
    override fun onCreate() {
        super.onCreate()

        // 1. Initialize ExoPlayer with AudioAttributes for music playback and system audio focus
        val audioAttributes = AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .build()

        player = ExoPlayer.Builder(this)
            .setAudioAttributes(audioAttributes, /* handleAudioFocus= */ true)
            .setHandleAudioBecomingNoisy(true)
            .setWakeMode(C.WAKE_MODE_LOCAL)
            .build()

        // 2. Set up player listener to keep session, notifications, and bridge in sync
        player.addListener(object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                notifyStateChanged()
            }

            override fun onPlaybackStateChanged(playbackState: Int) {
                notifyStateChanged()
            }

            override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                notifyStateChanged()
                notifyQueueChanged()
            }

            override fun onTimelineChanged(timeline: androidx.media3.common.Timeline, reason: Int) {
                notifyQueueChanged()
            }

            override fun onPlayerError(error: PlaybackException) {
                stateChangeListener?.onError(error)
            }
        })

        // 3. Configure pending intent to launch main activity when notification or widget is tapped
        val sessionActivityPendingIntent = packageManager
            ?.getLaunchIntentForPackage(packageName)
            ?.let { sessionIntent ->
                PendingIntent.getActivity(
                    this,
                    0,
                    sessionIntent,
                    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
                )
            }

        // 4. Create MediaSession instance
        val sessionBuilder = MediaSession.Builder(this, player)
            .setCallback(VeyraSessionCallback())
        if (sessionActivityPendingIntent != null) {
            sessionBuilder.setSessionActivity(sessionActivityPendingIntent)
        }
        mediaSession = sessionBuilder.build()

        // 5. Register audio becoming noisy broadcast receiver as an extra safety measure
        registerBecomingNoisyReceiver()
    }

    private fun registerBecomingNoisyReceiver() {
        if (isReceiverRegistered) return
        becomingNoisyReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (AudioManager.ACTION_AUDIO_BECOMING_NOISY == intent?.action) {
                    if (player.isPlaying) {
                        player.pause()
                    }
                }
            }
        }
        val filter = IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY)
        registerReceiver(becomingNoisyReceiver, filter)
        isReceiverRegistered = true
    }

    private fun unregisterBecomingNoisyReceiver() {
        if (isReceiverRegistered && becomingNoisyReceiver != null) {
            try {
                unregisterReceiver(becomingNoisyReceiver)
            } catch (e: Exception) {
                // Ignore if already unregistered
            }
            isReceiverRegistered = false
        }
    }

    private fun notifyStateChanged() {
        val currentItem = player.currentMediaItem
        val isPlaying = player.isPlaying
        val playbackState = player.playbackState
        val positionMs = player.currentPosition
        val durationMs = if (player.duration > 0) player.duration else 0L

        stateChangeListener?.onPlaybackStateChanged(
            isPlaying = isPlaying,
            playbackState = playbackState,
            currentItem = currentItem,
            positionMs = positionMs,
            durationMs = durationMs
        )
    }

    private fun notifyQueueChanged() {
        val count = player.mediaItemCount
        val queue = ArrayList<MediaItem>(count)
        for (i in 0 until count) {
            queue.add(player.getMediaItemAt(i))
        }
        val currentIndex = player.currentMediaItemIndex
        stateChangeListener?.onQueueChanged(queue, currentIndex)
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? {
        return mediaSession
    }

    override fun onDestroy() {
        unregisterBecomingNoisyReceiver()
        mediaSession?.run {
            player.release()
            release()
            mediaSession = null
        }
        super.onDestroy()
    }

    private inner class VeyraSessionCallback : MediaSession.Callback {
        override fun onCustomCommand(
            session: MediaSession,
            controller: MediaSession.ControllerInfo,
            customCommand: SessionCommand,
            args: Bundle
        ): ListenableFuture<SessionResult> {
            return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
        }
    }
}
