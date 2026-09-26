import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { FolderSearch, RefreshCw } from 'lucide-react-native'
import { useTheme } from '../stores/useTheme'

export function EmptyState({
  title = 'No media found yet.',
  message = 'Scan your device to build your library.',
  actionLabel = 'Scan Device',
  onAction,
  loading = false
}) {
  const { theme, spacing, radii, typography } = useTheme()

  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.full }]}>
        <FolderSearch size={36} color={theme.colors.accent} />
      </View>

      <Text
        style={[
          styles.title,
          { color: theme.colors.textPrimary, fontSize: typography.sizes.bodyLg, fontWeight: typography.weights.bold }
        ]}
      >
        {title}
      </Text>

      <Text
        style={[
          styles.message,
          { color: theme.colors.textSecondary, fontSize: typography.sizes.body }
        ]}
      >
        {message}
      </Text>

      {onAction && (
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: theme.colors.accent, borderRadius: radii.md }
          ]}
          activeOpacity={0.8}
          onPress={onAction}
          disabled={loading}
        >
          {loading ? (
            <RefreshCw size={18} color="#FFFFFF" />
          ) : (
            <Text style={[styles.buttonText, { fontWeight: typography.weights.semibold }]}>
              {actionLabel}
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40
  },
  iconCircle: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  title: {
    textAlign: 'center',
    marginBottom: 8
  },
  message: {
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 260,
    lineHeight: 20
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14
  }
})
