import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Alert
} from 'react-native'
import { X, Trash2, BookmarkPlus, ArrowUp, ArrowDown } from 'lucide-react-native'
import { usePlayback } from '../stores/usePlayback'
import { useTheme } from '../stores/useTheme'
import { createPlaylist, addItemsToPlaylist } from '../database/db'
import { formatTime } from '../utils/format'

export function QueueModal({ visible, onClose }) {
  const { theme, spacing, radii, typography } = useTheme()
  const { queue, currentIndex, removeFromQueue, playMedia } = usePlayback()
  const [savingPlaylist, setSavingPlaylist] = useState(false)

  const handleSaveQueueAsPlaylist = async () => {
    if (!queue || queue.length === 0) return
    const name = `Queue — ${new Date().toLocaleDateString()}`
    try {
      setSavingPlaylist(true)
      const pl = await createPlaylist(name)
      const ids = queue.map((item) => item.id)
      await addItemsToPlaylist(pl.id, ids)
      Alert.alert('Saved!', `Queue saved as playlist "${name}"`)
    } catch (err) {
      Alert.alert('Error', 'Unable to save playlist.')
    } finally {
      setSavingPlaylist(false)
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.container,
            { backgroundColor: theme.colors.surfaceElevated, borderTopColor: theme.colors.border }
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.borderSubtle }]}>
            <View>
              <Text
                style={[
                  styles.title,
                  { color: theme.colors.textPrimary, fontSize: typography.sizes.title, fontWeight: typography.weights.bold }
                ]}
              >
                Playback Queue
              </Text>
              <Text
                style={[
                  styles.countText,
                  { color: theme.colors.textSecondary, fontSize: typography.sizes.caption }
                ]}
              >
                {queue.length} track{queue.length === 1 ? '' : 's'}
              </Text>
            </View>

            <View style={styles.headerActions}>
              {queue.length > 0 && (
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: theme.colors.surfaceHighlight, borderRadius: radii.sm }]}
                  onPress={handleSaveQueueAsPlaylist}
                  disabled={savingPlaylist}
                >
                  <BookmarkPlus size={16} color={theme.colors.accentLight} />
                  <Text style={[styles.saveBtnText, { color: theme.colors.accentLight }]}>
                    Save Playlist
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.closeBtn, { backgroundColor: theme.colors.surfaceHighlight, borderRadius: radii.full }]}
                onPress={onClose}
              >
                <X size={20} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Queue List */}
          <FlatList
            data={queue}
            keyExtractor={(item, index) => `${item.id}_${index}`}
            contentContainerStyle={styles.listContent}
            renderItem={({ item, index }) => {
              const isCurrent = index === currentIndex
              return (
                <View
                  style={[
                    styles.itemRow,
                    {
                      backgroundColor: isCurrent ? theme.colors.accentSubtle : 'transparent',
                      borderRadius: radii.md
                    }
                  ]}
                >
                  <TouchableOpacity
                    style={styles.itemInfo}
                    onPress={() => playMedia(item, queue, index)}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.trackTitle,
                        {
                          color: isCurrent ? theme.colors.accentLight : theme.colors.textPrimary,
                          fontSize: typography.sizes.body,
                          fontWeight: isCurrent ? typography.weights.semibold : typography.weights.medium
                        }
                      ]}
                    >
                      {item.title}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[styles.trackArtist, { color: theme.colors.textSecondary, fontSize: typography.sizes.caption }]}
                    >
                      {item.artist} • {formatTime(item.duration)}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => removeFromQueue(index)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Trash2 size={16} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </View>
              )
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={{ color: theme.colors.textMuted }}>Queue is empty</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end'
  },
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    height: '65%',
    paddingBottom: 24
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1
  },
  title: {
    letterSpacing: -0.3
  },
  countText: {
    marginTop: 2
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  saveBtnText: {
    fontSize: 12,
    fontWeight: '600'
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center'
  },
  listContent: {
    padding: 12
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginVertical: 2
  },
  itemInfo: {
    flex: 1
  },
  trackTitle: {
    lineHeight: 20
  },
  trackArtist: {
    marginTop: 2
  },
  removeBtn: {
    padding: 8
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center'
  }
})
