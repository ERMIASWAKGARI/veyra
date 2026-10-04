package com.veyra.player.bridge

import android.content.ComponentName
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.common.util.concurrent.ListenableFuture
import com.google.common.util.concurrent.MoreExecutors
import com.veyra.player.playback.VeyraMediaService

class VeyraPlaybackModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var controllerFuture: ListenableFuture<MediaController>? = null
    private var mediaController: MediaController? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var progressTrackingRunnable: Runnable? = null
    private val PROGRESS_UPDATE_INTERVAL_MS = 250L

    override fun getName(): String = "VeyraPlayback"

    init {
        mainHandler.post {
            initializeController()
        }
    }

    private fun startProgressTracking() {
        stopProgressTracking()
        progressTrackingRunnable = object : Runnable {
            override fun run() {
                val controller = mediaController
                if (controller != null && controller.isPlaying) {
                    emitPlaybackState()
                    mainHandler.postDelayed(this, PROGRESS_UPDATE_INTERVAL_MS)
                } else {
                    stopProgressTracking()
                }
            }
        }
        mainHandler.post(progressTrackingRunnable!!)
    }

    private fun stopProgressTracking() {
        progressTrackingRunnable?.let { mainHandler.removeCallbacks(it) }
        progressTrackingRunnable = null
    }

    private fun initializeController() {
        val sessionToken = SessionToken(
            reactContext,
            ComponentName(reactContext, VeyraMediaService::class.java)
        )
        controllerFuture = MediaController.Builder(reactContext, sessionToken).buildAsync()
        controllerFuture?.addListener({
            try {
                mediaController = controllerFuture?.get()
                setupControllerListener()
                if (mediaController?.isPlaying == true) {
                    startProgressTracking()
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }, MoreExecutors.directExecutor())
    }

    private fun setupControllerListener() {
        mediaController?.addListener(object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                if (isPlaying) {
                    startProgressTracking()
                } else {
                    stopProgressTracking()
                }
                emitPlaybackState()
            }

            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_ENDED || playbackState == Player.STATE_IDLE) {
                    stopProgressTracking()
                }
                emitPlaybackState()
            }

            override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                emitMediaChanged(mediaItem)
                emitPlaybackState()
            }

            override fun onTimelineChanged(timeline: androidx.media3.common.Timeline, reason: Int) {
                emitQueueChanged()
            }

            override fun onPlayerError(error: PlaybackException) {
                val params = Arguments.createMap().apply {
                    putInt("errorCode", error.errorCode)
                    putString("message", error.message ?: "Unknown playback error")
                }
                sendEvent("onPlayerError", params)
            }
        })
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        }
    }

    private fun emitPlaybackState() {
        val controller = mediaController ?: return
        val currentItem = controller.currentMediaItem
        val durationMs = if (controller.duration > 0) controller.duration else 0L

        val stateMap = Arguments.createMap().apply {
            putBoolean("isPlaying", controller.isPlaying)
            putInt("playbackState", controller.playbackState)
            putDouble("position", controller.currentPosition.toDouble())
            putDouble("duration", durationMs.toDouble())
            putDouble("speed", controller.playbackParameters.speed.toDouble())
            putBoolean("shuffleEnabled", controller.shuffleModeEnabled)
            putInt("repeatMode", controller.repeatMode)
            if (currentItem != null) {
                putMap("currentMedia", mediaItemToWritableMap(currentItem))
            } else {
                putNull("currentMedia")
            }
        }
        sendEvent("onPlaybackStateChanged", stateMap)
    }

    private fun emitMediaChanged(mediaItem: MediaItem?) {
        val params = Arguments.createMap().apply {
            if (mediaItem != null) {
                putMap("media", mediaItemToWritableMap(mediaItem))
            } else {
                putNull("media")
            }
        }
        sendEvent("onMediaChanged", params)
    }

    private fun emitQueueChanged() {
        val controller = mediaController ?: return
        val count = controller.mediaItemCount
        val queueArray = Arguments.createArray()
        for (i in 0 until count) {
            queueArray.pushMap(mediaItemToWritableMap(controller.getMediaItemAt(i)))
        }

        val params = Arguments.createMap().apply {
            putArray("queue", queueArray)
            putInt("currentIndex", controller.currentMediaItemIndex)
        }
        sendEvent("onQueueChanged", params)
    }

    private fun mediaItemToWritableMap(item: MediaItem): WritableMap {
        val metadata = item.mediaMetadata
        return Arguments.createMap().apply {
            putString("id", item.mediaId)
            putString("uri", item.localConfiguration?.uri?.toString() ?: "")
            putString("title", metadata.title?.toString() ?: "")
            putString("artist", metadata.artist?.toString() ?: "")
            putString("album", metadata.albumTitle?.toString() ?: "")
            putString("artworkUri", metadata.artworkUri?.toString() ?: "")
        }
    }

    private fun buildMediaItem(map: ReadableMap): MediaItem {
        val id = map.getString("id") ?: ""
        val uriStr = map.getString("uri") ?: ""
        val title = map.getString("title") ?: "Unknown"
        val artist = map.getString("artist") ?: "Unknown"
        val album = map.getString("album") ?: "Unknown"
        val artworkUriStr = if (map.hasKey("artworkUri")) map.getString("artworkUri") else null

        val metadataBuilder = MediaMetadata.Builder()
            .setTitle(title)
            .setArtist(artist)
            .setAlbumTitle(album)

        if (!artworkUriStr.isNullOrEmpty()) {
            metadataBuilder.setArtworkUri(Uri.parse(artworkUriStr))
        }

        return MediaItem.Builder()
            .setMediaId(id)
            .setUri(Uri.parse(uriStr))
            .setMediaMetadata(metadataBuilder.build())
            .build()
    }

    private fun withController(action: (MediaController) -> Unit) {
        val current = mediaController
        if (current != null) {
            mainHandler.post { action(current) }
        } else {
            val future = controllerFuture
            if (future != null) {
                future.addListener({
                    try {
                        val controller = mediaController ?: future.get()
                        mediaController = controller
                        if (controller != null) {
                            mainHandler.post { action(controller) }
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }, MoreExecutors.directExecutor())
            }
        }
    }

    // ---------------- React Methods ----------------

    @ReactMethod
    fun play(mediaMap: ReadableMap) {
        withController { controller ->
            val item = buildMediaItem(mediaMap)
            controller.setMediaItem(item)
            controller.prepare()
            controller.play()
        }
    }

    @ReactMethod
    fun pause() {
        withController { controller ->
            controller.pause()
        }
    }

    @ReactMethod
    fun resume() {
        withController { controller ->
            controller.play()
        }
    }

    @ReactMethod
    fun stop() {
        withController { controller ->
            controller.stop()
        }
    }

    @ReactMethod
    fun seekTo(positionMs: Double) {
        withController { controller ->
            controller.seekTo(positionMs.toLong())
        }
    }

    @ReactMethod
    fun skipToNext() {
        withController { controller ->
            controller.seekToNextMediaItem()
        }
    }

    @ReactMethod
    fun skipToPrevious() {
        withController { controller ->
            controller.seekToPreviousMediaItem()
        }
    }

    @ReactMethod
    fun setQueue(items: ReadableArray, startIndex: Int) {
        withController { controller ->
            val mediaItems = ArrayList<MediaItem>(items.size())
            for (i in 0 until items.size()) {
                val map = items.getMap(i)
                if (map != null) {
                    mediaItems.add(buildMediaItem(map))
                }
            }
            controller.setMediaItems(mediaItems, startIndex, C.TIME_UNSET)
            controller.prepare()
            controller.play()
        }
    }

    @ReactMethod
    fun addToQueue(itemMap: ReadableMap) {
        withController { controller ->
            controller.addMediaItem(buildMediaItem(itemMap))
        }
    }

    @ReactMethod
    fun addNext(itemMap: ReadableMap) {
        withController { controller ->
            val currentIndex = controller.currentMediaItemIndex
            controller.addMediaItem(currentIndex + 1, buildMediaItem(itemMap))
        }
    }

    @ReactMethod
    fun removeFromQueue(index: Int) {
        withController { controller ->
            if (index in 0 until controller.mediaItemCount) {
                controller.removeMediaItem(index)
            }
        }
    }

    @ReactMethod
    fun setShuffleMode(enabled: Boolean) {
        mainHandler.post {
            mediaController?.shuffleModeEnabled = enabled
        }
    }

    @ReactMethod
    fun setRepeatMode(mode: Int) {
        mainHandler.post {
            val repeatMode = when (mode) {
                1 -> Player.REPEAT_MODE_ONE
                2 -> Player.REPEAT_MODE_ALL
                else -> Player.REPEAT_MODE_OFF
            }
            mediaController?.repeatMode = repeatMode
        }
    }

    @ReactMethod
    fun setPlaybackSpeed(speed: Double) {
        mainHandler.post {
            val currentParams = mediaController?.playbackParameters ?: PlaybackParameters.DEFAULT
            mediaController?.playbackParameters = currentParams.withSpeed(speed.toFloat())
        }
    }

    @ReactMethod
    fun getPlaybackState(promise: Promise) {
        mainHandler.post {
            val controller = mediaController
            if (controller == null) {
                promise.reject("UNAVAILABLE", "MediaController not initialized")
                return@post
            }
            val currentItem = controller.currentMediaItem
            val durationMs = if (controller.duration > 0) controller.duration else 0L

            val stateMap = Arguments.createMap().apply {
                putBoolean("isPlaying", controller.isPlaying)
                putInt("playbackState", controller.playbackState)
                putDouble("position", controller.currentPosition.toDouble())
                putDouble("duration", durationMs.toDouble())
                putDouble("speed", controller.playbackParameters.speed.toDouble())
                putBoolean("shuffleEnabled", controller.shuffleModeEnabled)
                putInt("repeatMode", controller.repeatMode)
                if (currentItem != null) {
                    putMap("currentMedia", mediaItemToWritableMap(currentItem))
                } else {
                    putNull("currentMedia")
                }
            }
            promise.resolve(stateMap)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Keep React Native happy for native event emitters
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Keep React Native happy for native event emitters
    }

    override fun onCatalystInstanceDestroy() {
        stopProgressTracking()
        mediaController?.release()
        mediaController = null
        super.onCatalystInstanceDestroy()
    }
}
