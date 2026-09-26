import React from 'react'
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native'
import { X, Moon, Check, PowerOff } from 'lucide-react-native'
import { useTheme } from '../stores/useTheme'
import { usePlayback } from '../stores/usePlayback'
import { APP_CONFIG } from '../constants/config'

export function SleepTimerModal({ visible, onClose }) {
  const { theme, spacing, radii, typography } = useTheme()
  const { sleepTimerActive, sleepTimerMinutesRemaining, startSleepTimer, cancelSleepTimer } = usePlayback()
  const presets = APP_CONFIG.playback.sleepTimerPresetsMinutes

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
            <View style={styles.titleGroup}>
              <Moon size={18} color={theme.colors.accentLight} />
              <Text
                style={[
                  styles.title,
                  { color: theme.colors.textPrimary, fontSize: typography.sizes.bodyLg, fontWeight: typography.weights.bold }
                ]}
              >
                Sleep Timer
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {sleepTimerActive && (
            <View style={[styles.activeBanner, { backgroundColor: theme.colors.accentSubtle }]}>
              <Text style={[styles.activeText, { color: theme.colors.accentLight }]}>
                Timer active: ~{sleepTimerMinutesRemaining}m remaining
              </Text>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: theme.colors.accentLight, borderRadius: radii.xs }]}
                onPress={() => cancelSleepTimer()}
              >
                <PowerOff size={12} color={theme.colors.accentLight} />
                <Text style={[styles.cancelBtnText, { color: theme.colors.accentLight }]}>Turn Off</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.list}>
            {presets.map((mins) => (
              <TouchableOpacity
                key={mins}
                style={[styles.row, { borderRadius: radii.md }]}
                onPress={() => {
                  startSleepTimer(mins)
                  onClose()
                }}
              >
                <Text
                  style={[
                    styles.presetText,
                    { color: theme.colors.textPrimary, fontWeight: typography.weights.medium }
                  ]}
                >
                  {mins} Minutes
                </Text>
              </TouchableOpacity>
            ))}
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
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  title: {
    letterSpacing: -0.2
  },
  closeBtn: {
    padding: 4
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  activeText: {
    fontSize: 13,
    fontWeight: '600'
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  cancelBtnText: {
    fontSize: 11,
    fontWeight: '600'
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
  presetText: {
    fontSize: 15
  }
})
