import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronLeft } from 'lucide-react-native'
import { useTheme } from '../stores/useTheme'

export function Header({
  title,
  showBack = false,
  rightActions = null,
  subtitle = null
}) {
  const router = useRouter()
  const { theme, spacing, radii, typography } = useTheme()

  return (
    <View style={[styles.header, { borderBottomColor: theme.colors.borderSubtle }]}>
      <View style={styles.leftContainer}>
        {showBack && (
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.full }]}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft size={22} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        )}
        <View style={styles.titleWrapper}>
          <Text
            numberOfLines={1}
            style={[
              styles.title,
              { color: theme.colors.textPrimary, fontSize: typography.sizes.title, fontWeight: typography.weights.bold }
            ]}
          >
            {title}
          </Text>
          {subtitle && (
            <Text
              numberOfLines={1}
              style={[
                styles.subtitle,
                { color: theme.colors.textSecondary, fontSize: typography.sizes.caption }
              ]}
            >
              {subtitle}
            </Text>
          )}
        </View>
      </View>

      {rightActions && <View style={styles.rightContainer}>{rightActions}</View>}
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center'
  },
  titleWrapper: {
    flex: 1
  },
  title: {
    letterSpacing: -0.3
  },
  subtitle: {
    marginTop: 2
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  }
})
