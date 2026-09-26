import React from 'react'
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native'
import { X, Check } from 'lucide-react-native'
import { useTheme } from '../stores/useTheme'
import { APP_CONFIG } from '../constants/config'

export function SpeedModal({ visible, currentSpeed, isVideo = false, onSelectSpeed, onClose }) {
  const { theme, spacing, radii, typography } = useTheme()
  const speeds = isVideo ? APP_CONFIG.playback.videoSpeeds : APP_CONFIG.playback.audioSpeeds

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.container,
            { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border, borderRadius: radii.xl }
          ]}
        >
          <View style={[styles.header, { borderBottomColor: theme.colors.borderSubtle }]}>
            <Text
              style={[
                styles.title,
                { color: theme.colors.textPrimary, fontSize: typography.sizes.bodyLg, fontWeight: typography.weights.bold }
              ]}
            >
              Playback Speed
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.list}>
            {speeds.map((speed) => {
              const isSelected = Math.abs(currentSpeed - speed) < 0.01
              return (
                <TouchableOpacity
                  key={speed}
                  style={[
                    styles.row,
                    {
                      backgroundColor: isSelected ? theme.colors.accentSubtle : 'transparent',
                      borderRadius: radii.md
                    }
                  ]}
                  onPress={() => {
                    onSelectSpeed(speed)
                    onClose()
                  }}
                >
                  <Text
                    style={[
                      styles.speedText,
                      {
                        color: isSelected ? theme.colors.accentLight : theme.colors.textPrimary,
                        fontWeight: isSelected ? typography.weights.bold : typography.weights.medium
                      }
                    ]}
                  >
                    {speed}x {speed === 1.0 ? '(Normal)' : ''}
                  </Text>
                  {isSelected && <Check size={18} color={theme.colors.accentLight} />}
                </TouchableOpacity>
              )
            })}
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  container: {
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    overflow: 'hidden'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1
  },
  title: {
    letterSpacing: -0.2
  },
  closeBtn: {
    padding: 4
  },
  list: {
    padding: 12
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 2
  },
  speedText: {
    fontSize: 15
  }
})
