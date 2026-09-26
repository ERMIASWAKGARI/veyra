import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert
} from 'react-native'
import { X, Plus, ListMusic, Check } from 'lucide-react-native'
import { useTheme } from '../stores/useTheme'
import { getPlaylists, createPlaylist, addItemsToPlaylist } from '../database/db'

export function PlaylistSelectModal({ visible, mediaItem, onClose }) {
  const { theme, spacing, radii, typography } = useTheme()
  const [playlists, setPlaylists] = useState([])
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    if (visible) {
      loadPlaylists()
    }
  }, [visible])

  const loadPlaylists = async () => {
    const list = await getPlaylists()
    setPlaylists(list)
  }

  const handleSelectPlaylist = async (playlist) => {
    if (!mediaItem) return
    try {
      await addItemsToPlaylist(playlist.id, [mediaItem.id])
      Alert.alert('Added', `Added to playlist "${playlist.name}"`)
      onClose()
    } catch (err) {
      Alert.alert('Error', 'Failed to add item to playlist.')
    }
  }

  const handleCreateAndAdd = async () => {
    if (!newPlaylistName.trim()) return
    try {
      const pl = await createPlaylist(newPlaylistName.trim())
      if (mediaItem) {
        await addItemsToPlaylist(pl.id, [mediaItem.id])
      }
      setNewPlaylistName('')
      setIsCreating(false)
      Alert.alert('Success', `Created playlist "${pl.name}" and added item.`)
      onClose()
    } catch (err) {
      Alert.alert('Error', 'Failed to create playlist.')
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
          <View style={[styles.header, { borderBottomColor: theme.colors.borderSubtle }]}>
            <View>
              <Text
                style={[
                  styles.title,
                  { color: theme.colors.textPrimary, fontSize: typography.sizes.title, fontWeight: typography.weights.bold }
                ]}
              >
                Add to Playlist
              </Text>
              {mediaItem && (
                <Text
                  numberOfLines={1}
                  style={[styles.itemTitle, { color: theme.colors.textSecondary, fontSize: typography.sizes.caption }]}
                >
                  {mediaItem.title}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Create new playlist input / button */}
          <View style={styles.createSection}>
            {isCreating ? (
              <View style={styles.createInputRow}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                      color: theme.colors.textPrimary,
                      borderRadius: radii.sm
                    }
                  ]}
                  placeholder="Playlist name..."
                  placeholderTextColor={theme.colors.textMuted}
                  value={newPlaylistName}
                  onChangeText={setNewPlaylistName}
                  autoFocus
                />
                <TouchableOpacity
                  style={[styles.createBtn, { backgroundColor: theme.colors.accent, borderRadius: radii.sm }]}
                  onPress={handleCreateAndAdd}
                >
                  <Text style={styles.createBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.newBtn, { backgroundColor: theme.colors.accentSubtle, borderRadius: radii.md }]}
                onPress={() => setIsCreating(true)}
              >
                <Plus size={18} color={theme.colors.accent} />
                <Text style={[styles.newBtnText, { color: theme.colors.accentLight }]}>
                  New Playlist
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* List of playlists */}
          <FlatList
            data={playlists}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.playlistRow, { borderBottomColor: theme.colors.borderSubtle }]}
                onPress={() => handleSelectPlaylist(item)}
              >
                <View style={[styles.iconWrapper, { backgroundColor: theme.colors.surfaceHighlight, borderRadius: radii.sm }]}>
                  <ListMusic size={18} color={theme.colors.accentLight} />
                </View>
                <View style={styles.playlistInfo}>
                  <Text
                    style={[
                      styles.playlistName,
                      { color: theme.colors.textPrimary, fontSize: typography.sizes.body, fontWeight: typography.weights.semibold }
                    ]}
                  >
                    {item.name}
                  </Text>
                  <Text style={[styles.playlistCount, { color: theme.colors.textSecondary, fontSize: typography.sizes.caption }]}>
                    {item.itemCount} items
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              !isCreating ? (
                <View style={styles.empty}>
                  <Text style={{ color: theme.colors.textMuted }}>No playlists found.</Text>
                </View>
              ) : null
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
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end'
  },
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    height: '60%',
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
    letterSpacing: -0.2
  },
  itemTitle: {
    marginTop: 2,
    maxWidth: 240
  },
  closeBtn: {
    padding: 6
  },
  createSection: {
    paddingHorizontal: 20,
    paddingVertical: 12
  },
  createInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  input: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14
  },
  createBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  createBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 8
  },
  newBtnText: {
    fontWeight: '600',
    fontSize: 14
  },
  listContent: {
    paddingHorizontal: 20
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12
  },
  iconWrapper: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  playlistInfo: {
    flex: 1
  },
  playlistName: {
    lineHeight: 20
  },
  playlistCount: {
    marginTop: 2
  },
  empty: {
    padding: 30,
    alignItems: 'center'
  }
})
