import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  Moon,
  Sun,
  Laptop,
  FolderSync,
  Trash2,
  ShieldCheck,
  Info,
  Clock,
  Gauge,
  Check,
  Volume2
} from 'lucide-react-native'
import { useTheme } from '../../src/stores/useTheme'
import { APP_CONFIG } from '../../src/constants/config'
import { scanLocalMedia } from '../../src/services/mediaScanner/mediaScanner'
import { clearAllLibraryData } from '../../src/database/db'
import { Header } from '../../src/components/Header'

export default function SettingsScreen() {
  const insets = useSafeAreaInsets()
  const { theme, spacing, radii, typography, themePreference, setThemePreference } = useTheme()

  const [autoplayNext, setAutoplayNext] = useState(true)
  const [resumePlayback, setResumePlayback] = useState(true)
  const [isScanning, setIsScanning] = useState(false)
  const [themeModalVisible, setThemeModalVisible] = useState(false)

  const handleRescan = async () => {
    try {
      setIsScanning(true)
      await scanLocalMedia()
      Alert.alert('Scan Complete', 'Your local library has been updated.')
    } catch {
      Alert.alert('Scan Notice', 'Media scan finished.')
    } finally {
      setIsScanning(false)
    }
  }

  const handleClearCache = () => {
    Alert.alert(
      'Clear Library Database & Cache',
      'This will clear indexed metadata and resume states. Your actual audio and video files on device will NOT be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearAllLibraryData()
            Alert.alert('Cleared', 'Library index reset. Tap Scan to rebuild.')
          }
        }
      ]
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <Header title="Settings" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>
            APPEARANCE
          </Text>
          <View style={[styles.card, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border, borderRadius: radii.md }]}>
            <TouchableOpacity
              style={styles.row}
              onPress={() => setThemeModalVisible(true)}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconBox, { backgroundColor: theme.colors.accentSubtle, borderRadius: radii.sm }]}>
                  {themePreference === 'dark' ? (
                    <Moon size={18} color={theme.colors.accent} />
                  ) : themePreference === 'light' ? (
                    <Sun size={18} color={theme.colors.accent} />
                  ) : (
                    <Laptop size={18} color={theme.colors.accent} />
                  )}
                </View>
                <View>
                  <Text style={[styles.rowLabel, { color: theme.colors.textPrimary }]}>Theme</Text>
                  <Text style={[styles.rowSub, { color: theme.colors.textSecondary }]}>
                    {themePreference === 'dark'
                      ? 'Dark theme'
                      : themePreference === 'light'
                      ? 'Light theme'
                      : 'System default'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Playback Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>
            PLAYBACK
          </Text>
          <View style={[styles.card, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border, borderRadius: radii.md }]}>
            <View style={[styles.row, { borderBottomColor: theme.colors.borderSubtle, borderBottomWidth: 1 }]}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconBox, { backgroundColor: theme.colors.accentSubtle, borderRadius: radii.sm }]}>
                  <Volume2 size={18} color={theme.colors.accent} />
                </View>
                <View>
                  <Text style={[styles.rowLabel, { color: theme.colors.textPrimary }]}>Autoplay Next</Text>
                  <Text style={[styles.rowSub, { color: theme.colors.textSecondary }]}>
                    Automatically advance to next track in queue
                  </Text>
                </View>
              </View>
              <Switch
                value={autoplayNext}
                onValueChange={setAutoplayNext}
                trackColor={{ false: theme.colors.surfaceHighlight, true: theme.colors.accent }}
              />
            </View>

            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconBox, { backgroundColor: theme.colors.accentSubtle, borderRadius: radii.sm }]}>
                  <Clock size={18} color={theme.colors.accent} />
                </View>
                <View>
                  <Text style={[styles.rowLabel, { color: theme.colors.textPrimary }]}>Resume Playback</Text>
                  <Text style={[styles.rowSub, { color: theme.colors.textSecondary }]}>
                    Restore position when reopening videos and tracks
                  </Text>
                </View>
              </View>
              <Switch
                value={resumePlayback}
                onValueChange={setResumePlayback}
                trackColor={{ false: theme.colors.surfaceHighlight, true: theme.colors.accent }}
              />
            </View>
          </View>
        </View>

        {/* Library & Storage */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>
            LIBRARY & STORAGE
          </Text>
          <View style={[styles.card, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border, borderRadius: radii.md }]}>
            <TouchableOpacity
              style={[styles.row, { borderBottomColor: theme.colors.borderSubtle, borderBottomWidth: 1 }]}
              onPress={handleRescan}
              disabled={isScanning}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconBox, { backgroundColor: theme.colors.accentSubtle, borderRadius: radii.sm }]}>
                  <FolderSync size={18} color={theme.colors.accent} />
                </View>
                <View>
                  <Text style={[styles.rowLabel, { color: theme.colors.textPrimary }]}>Rescan Library</Text>
                  <Text style={[styles.rowSub, { color: theme.colors.textSecondary }]}>
                    Scan device for newly added music and videos
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.row} onPress={handleClearCache}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconBox, { backgroundColor: theme.colors.errorSubtle, borderRadius: radii.sm }]}>
                  <Trash2 size={18} color={theme.colors.error} />
                </View>
                <View>
                  <Text style={[styles.rowLabel, { color: theme.colors.error }]}>Clear Database & Cache</Text>
                  <Text style={[styles.rowSub, { color: theme.colors.textSecondary }]}>
                    Reset metadata index (media files are preserved)
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Privacy & About */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>
            PRIVACY & ABOUT
          </Text>
          <View style={[styles.card, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border, borderRadius: radii.md }]}>
            <View style={[styles.row, { borderBottomColor: theme.colors.borderSubtle, borderBottomWidth: 1 }]}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderRadius: radii.sm }]}>
                  <ShieldCheck size={18} color={theme.colors.success} />
                </View>
                <View>
                  <Text style={[styles.rowLabel, { color: theme.colors.textPrimary }]}>Offline & Private</Text>
                  <Text style={[styles.rowSub, { color: theme.colors.textSecondary }]}>
                    No account, no tracking, zero media uploads
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconBox, { backgroundColor: theme.colors.accentSubtle, borderRadius: radii.sm }]}>
                  <Info size={18} color={theme.colors.accent} />
                </View>
                <View>
                  <Text style={[styles.rowLabel, { color: theme.colors.textPrimary }]}>{APP_CONFIG.appName}</Text>
                  <Text style={[styles.rowSub, { color: theme.colors.textSecondary }]}>
                    Version {APP_CONFIG.version} (Build {APP_CONFIG.buildNumber})
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Theme Choice Modal */}
      <Modal visible={themeModalVisible} transparent animationType="fade" onRequestClose={() => setThemeModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border, borderRadius: radii.xl }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>Select Theme</Text>
            {[
              { id: 'dark', label: 'Dark theme' },
              { id: 'light', label: 'Light theme' },
              { id: 'system', label: 'System default' }
            ].map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={[styles.modalRow, themePreference === opt.id && { backgroundColor: theme.colors.accentSubtle, borderRadius: radii.md }]}
                onPress={() => {
                  setThemePreference(opt.id)
                  setThemeModalVisible(false)
                }}
              >
                <Text style={[styles.modalRowText, { color: themePreference === opt.id ? theme.colors.accentLight : theme.colors.textPrimary }]}>
                  {opt.label}
                </Text>
                {themePreference === opt.id && <Check size={18} color={theme.colors.accentLight} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  section: {
    marginBottom: 24
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4
  },
  card: {
    borderWidth: 1,
    overflow: 'hidden'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1
  },
  iconBox: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600'
  },
  rowSub: {
    fontSize: 12,
    marginTop: 2
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  modalBox: {
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    padding: 16
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginVertical: 2
  },
  modalRowText: {
    fontSize: 14,
    fontWeight: '500'
  }
})
