import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Music, Heart, MoreVertical, Volume2 } from 'lucide-react-native'
import { useTheme } from '../stores/useTheme'
import { formatTime } from '../utils/format'

export function TrackItem({
  track,
  isActive = false,
  isPlaying = false,
  isFavorite = false,
  onPress,
  onToggleFavorite,
  onMorePress
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
    onToggleFavorite?.(track)
  }

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: isActive ? theme.colors.accentSubtle : 'transparent',
          borderRadius: radii.md
        }
      ]}
      activeOpacity={0.7}
      onPress={handlePress}
    >
      {/* Artwork or Icon */}
      <View
        style={[
          styles.artworkWrapper,
          {
            backgroundColor: theme.colors.surfaceHighlight,
            borderRadius: radii.sm
          }
        ]}
      >
        {track.artworkUri ? (
          <Image
            source={{ uri: track.artworkUri }}
            style={[styles.artwork, { borderRadius: radii.sm }]}
            resizeMode="cover"
          />
        ) : (
          <Music size={18} color={isActive ? theme.colors.accent : theme.colors.textMuted} />
        )}

        {isActive && (
          <View style={[styles.playingBadge, { backgroundColor: theme.colors.accent }]}>
            <Volume2 size={12} color="#FFFFFF" />
          </View>
        )}
      </View>

      {/* Title & Artist */}
      <View style={styles.infoWrapper}>
        <Text
          numberOfLines={1}
          style={[
            styles.title,
            {
              color: isActive ? theme.colors.accentLight : theme.colors.textPrimary,
              fontSize: typography.sizes.body,
              fontWeight: isActive ? typography.weights.semibold : typography.weights.medium
            }
          ]}
        >
          {track.title || 'Unknown Title'}
        </Text>
        <Text
          numberOfLines={1}
          style={[
            styles.subtitle,
            {
              color: theme.colors.textSecondary,
              fontSize: typography.sizes.caption
            }
          ]}
        >
          {track.artist || 'Unknown Artist'}
          {track.album && track.album !== 'Unknown Album' ? ` • ${track.album}` : ''}
        </Text>
      </View>

      {/* Right side: Duration, Favorite, More */}
      <View style={styles.rightActions}>
        <Text style={[styles.duration, { color: theme.colors.textMuted, fontSize: typography.sizes.caption }]}>
          {formatTime(track.duration)}
        </Text>

        {onToggleFavorite && (
          <TouchableOpacity
            style={styles.actionIcon}
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
            style={styles.actionIcon}
            onPress={(e) => {
              e.stopPropagation()
              onMorePress(track)
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MoreVertical size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginVertical: 2,
    gap: 12
  },
  artworkWrapper: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  artwork: {
    width: '100%',
    height: '100%'
  },
  playingBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    borderRadius: 8,
    padding: 2
  },
  infoWrapper: {
    flex: 1,
    justifyContent: 'center'
  },
  title: {
    letterSpacing: -0.1
  },
  subtitle: {
    marginTop: 2
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  duration: {
    minWidth: 32,
    textAlign: 'right'
  },
  actionIcon: {
    padding: 4
  }
})
