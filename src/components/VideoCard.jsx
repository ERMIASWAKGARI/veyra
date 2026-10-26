import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Video as VideoIcon, Play, MoreVertical, Heart } from 'lucide-react-native'
import { useTheme } from '../stores/useTheme'
import { formatTime } from '../utils/format'

export function VideoCard({
  video,
  resumePosition = 0,
  isFavorite = false,
  onPress = undefined,
  onToggleFavorite = undefined,
  onMorePress = undefined
}) {
  const { theme, spacing, radii, typography } = useTheme()

  const handlePress = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    } catch {}
    onPress?.()
  }

  const handleToggle = (e) => {
    e.stopPropagation()
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    } catch {}
    onToggleFavorite?.(video)
  }

  const progressRatio =
    video.duration > 0 && resumePosition > 0
      ? Math.min(1, Math.max(0, resumePosition / video.duration))
      : 0

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: radii.md
        }
      ]}
      activeOpacity={0.8}
      onPress={handlePress}
    >
      {/* Thumbnail Banner */}
      <View style={[styles.thumbnailWrapper, { backgroundColor: theme.colors.surfaceElevated }]}>
        {video.artworkUri ? (
          <Image
            source={{ uri: video.artworkUri }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <VideoIcon size={32} color={theme.colors.textMuted} />
          </View>
        )}

        {/* Play Icon Badge */}
        <View style={[styles.playOverlay, { backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: radii.full }]}>
          <Play size={18} color="#FFFFFF" fill="#FFFFFF" />
        </View>

        {/* Duration badge */}
        <View style={[styles.durationBadge, { backgroundColor: 'rgba(0, 0, 0, 0.75)', borderRadius: radii.xs }]}>
          <Text style={styles.durationText}>{formatTime(video.duration)}</Text>
        </View>

        {/* Resume progress bar */}
        {progressRatio > 0 && (
          <View style={[styles.progressTrack, { backgroundColor: 'rgba(255, 255, 255, 0.3)' }]}>
            <View
              style={[
                styles.progressBar,
                { width: `${progressRatio * 100}%`, backgroundColor: theme.colors.accent }
              ]}
            />
          </View>
        )}
      </View>

      {/* Info footer */}
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text
            numberOfLines={2}
            style={[
              styles.title,
              { color: theme.colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.semibold }
            ]}
          >
            {video.title || 'Untitled Video'}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.details,
              { color: theme.colors.textSecondary, fontSize: typography.sizes.caption }
            ]}
          >
            {video.folder ? `${video.folder} • ` : ''}
            {resumePosition > 0
              ? `Resume at ${formatTime(resumePosition)}`
              : `${formatTime(video.duration)}`}
          </Text>
        </View>

        <View style={styles.actions}>
          {onToggleFavorite && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleToggle}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Heart
                size={18}
                color={isFavorite ? theme.colors.accent : theme.colors.textMuted}
                fill={isFavorite ? theme.colors.accent : 'transparent'}
              />
            </TouchableOpacity>
          )}

          {onMorePress && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={(e) => {
                e.stopPropagation()
                onMorePress(video)
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MoreVertical size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: 'hidden',
    marginVertical: 6
  },
  thumbnailWrapper: {
    width: '100%',
    height: 160,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center'
  },
  thumbnail: {
    width: '100%',
    height: '100%'
  },
  thumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  playOverlay: {
    position: 'absolute',
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center'
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600'
  },
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3
  },
  progressBar: {
    height: '100%'
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8
  },
  textContainer: {
    flex: 1
  },
  title: {
    lineHeight: 20
  },
  details: {
    marginTop: 4
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  actionBtn: {
    padding: 6
  }
})
