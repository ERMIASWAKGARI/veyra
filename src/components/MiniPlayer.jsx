import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native'
import { useRouter, usePathname } from 'expo-router'
import { Play, Pause, SkipForward, Music } from 'lucide-react-native'
import { usePlayback } from '../stores/usePlayback'
import { useTheme } from '../stores/useTheme'
import { truncateText } from '../utils/format'

export function MiniPlayer() {
  const router = useRouter()
  const pathname = usePathname()
  const { theme, spacing, radii, typography } = useTheme()
  const { currentMedia, isPlaying, togglePlayPause, skipToNext, position, duration } = usePlayback()

  // Do not show mini-player if no media is loaded or if already on the full player screen
  if (!currentMedia || pathname.startsWith('/player')) {
    return null
  }

  const progressRatio = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0

  const handlePress = () => {
    if (currentMedia.type === 'video') {
      router.push('/player/video')
    } else {
      router.push('/player/audio')
    }
  }

  return (
    <View style={[styles.outerContainer, { backgroundColor: theme.colors.surfaceElevated, borderTopColor: theme.colors.border }]}>
      {/* Top progress indicator line */}
      <View style={[styles.progressTrack, { backgroundColor: theme.colors.borderSubtle }]}>
        <View
          style={[
            styles.progressBar,
            {
              width: `${progressRatio * 100}%`,
              backgroundColor: theme.colors.accent
            }
          ]}
        />
      </View>

      <TouchableOpacity
        style={styles.innerContainer}
        activeOpacity={0.88}
        onPress={handlePress}
      >
        {/* Artwork Thumbnail */}
        <View style={[styles.artworkContainer, { backgroundColor: theme.colors.surfaceHighlight, borderRadius: radii.sm }]}>
          {currentMedia.artworkUri ? (
            <Image
              source={{ uri: currentMedia.artworkUri }}
              style={[styles.artwork, { borderRadius: radii.sm }]}
              resizeMode="cover"
            />
          ) : (
            <Music size={20} color={theme.colors.textMuted} />
          )}
        </View>

        {/* Media Title & Artist */}
        <View style={styles.textContainer}>
          <Text
            numberOfLines={1}
            style={[styles.title, { color: theme.colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.semibold }]}
          >
            {currentMedia.title || 'Unknown Title'}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.subtitle, { color: theme.colors.textSecondary, fontSize: typography.sizes.caption }]}
          >
            {currentMedia.artist || 'Unknown Artist'}
          </Text>
        </View>

        {/* Transport Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: theme.colors.accentSubtle, borderRadius: radii.full }]}
            onPress={(e) => {
              e.stopPropagation()
              togglePlayPause()
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {isPlaying ? (
              <Pause size={18} color={theme.colors.accent} fill={theme.colors.accent} />
            ) : (
              <Play size={18} color={theme.colors.accent} fill={theme.colors.accent} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            onPress={(e) => {
              e.stopPropagation()
              skipToNext()
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <SkipForward size={20} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  outerContainer: {
    borderTopWidth: 1,
    overflow: 'hidden'
  },
  progressTrack: {
    height: 2.5,
    width: '100%'
  },
  progressBar: {
    height: '100%'
  },
  innerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12
  },
  artworkContainer: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  artwork: {
    width: '100%',
    height: '100%'
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center'
  },
  title: {
    letterSpacing: -0.2
  },
  subtitle: {
    marginTop: 2
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  controlButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center'
  }
})
