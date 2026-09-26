import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Plus, ListMusic, MoreVertical, Trash2, Edit3, Play } from 'lucide-react-native'
import { useTheme } from '../../src/stores/useTheme'
import { getPlaylists, createPlaylist, renamePlaylist, deletePlaylist } from '../../src/database/db'
import { EmptyState } from '../../src/components/EmptyState'

export default function PlaylistsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { theme, spacing, radii, typography } = useTheme()

  const [playlists, setPlaylists] = useState([])
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [editingPlaylist, setEditingPlaylist] = useState(null)
  const [editName, setEditName] = useState('')

  const loadPlaylists = useCallback(async () => {
    try {
      const list = await getPlaylists()
      setPlaylists(list)
    } catch (e) {
      console.warn('Error loading playlists:', e)
    }
  }, [])

  useEffect(() => {
    loadPlaylists()
  }, [loadPlaylists])

  const handleCreate = async () => {
    if (!newPlaylistName.trim()) return
    try {
      await createPlaylist(newPlaylistName.trim())
      setNewPlaylistName('')
      setCreateModalVisible(false)
      loadPlaylists()
    } catch (err) {
      Alert.alert('Error', 'Unable to create playlist.')
    }
  }

  const handleRename = async () => {
    if (!editingPlaylist || !editName.trim()) return
    try {
      await renamePlaylist(editingPlaylist.id, editName.trim())
      setEditingPlaylist(null)
      setEditName('')
      loadPlaylists()
    } catch (err) {
      Alert.alert('Error', 'Unable to rename playlist.')
    }
  }

  const handleDelete = (playlist) => {
    Alert.alert(
      'Delete Playlist',
      `Are you sure you want to delete "${playlist.name}"? Media files will not be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deletePlaylist(playlist.id)
            loadPlaylists()
          }
        }
      ]
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.borderSubtle }]}>
        <Text
          style={[
            styles.title,
            { color: theme.colors.textPrimary, fontSize: typography.sizes.title, fontWeight: typography.weights.bold }
          ]}
        >
          Playlists
        </Text>

        <TouchableOpacity
          style={[styles.createBtn, { backgroundColor: theme.colors.accent, borderRadius: radii.full }]}
          onPress={() => setCreateModalVisible(true)}
        >
          <Plus size={16} color="#FFFFFF" />
          <Text style={styles.createBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      {/* Playlist List */}
      <FlatList
        data={playlists}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.playlistCard, { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.md }]}
            activeOpacity={0.8}
            onPress={() => router.push(`/playlists/${item.id}`)}
          >
            <View style={[styles.cardIcon, { backgroundColor: theme.colors.accentSubtle, borderRadius: radii.sm }]}>
              <ListMusic size={22} color={theme.colors.accent} />
            </View>

            <View style={styles.cardInfo}>
              <Text style={[styles.playlistTitle, { color: theme.colors.textPrimary }]}>{item.name}</Text>
              <Text style={[styles.playlistSub, { color: theme.colors.textSecondary }]}>
                {item.itemCount} items
              </Text>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={(e) => {
                  e.stopPropagation()
                  setEditingPlaylist(item)
                  setEditName(item.name)
                }}
              >
                <Edit3 size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={(e) => {
                  e.stopPropagation()
                  handleDelete(item)
                }}
              >
                <Trash2 size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <EmptyState
            title="No playlists yet"
            message="Create custom playlists to organize your favorite music and videos."
            actionLabel="Create Playlist"
            onAction={() => setCreateModalVisible(true)}
          />
        }
      />

      {/* Create Modal */}
      <Modal visible={createModalVisible} transparent animationType="fade" onRequestClose={() => setCreateModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border, borderRadius: radii.xl }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>New Playlist</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.textPrimary, borderRadius: radii.sm }]}
              placeholder="Playlist name..."
              placeholderTextColor={theme.colors.textMuted}
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateModalVisible(false)}>
                <Text style={{ color: theme.colors.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveModalBtn, { backgroundColor: theme.colors.accent, borderRadius: radii.sm }]} onPress={handleCreate}>
                <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rename Modal */}
      <Modal visible={!!editingPlaylist} transparent animationType="fade" onRequestClose={() => setEditingPlaylist(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border, borderRadius: radii.xl }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>Rename Playlist</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.textPrimary, borderRadius: radii.sm }]}
              value={editName}
              onChangeText={setEditName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingPlaylist(null)}>
                <Text style={{ color: theme.colors.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveModalBtn, { backgroundColor: theme.colors.accent, borderRadius: radii.sm }]} onPress={handleRename}>
                <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Save</Text>
              </TouchableOpacity>
            </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1
  },
  title: {
    letterSpacing: -0.3
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  createBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600'
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 40
  },
  playlistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginVertical: 4,
    gap: 12
  },
  cardIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cardInfo: {
    flex: 1
  },
  playlistTitle: {
    fontSize: 15,
    fontWeight: '600'
  },
  playlistSub: {
    fontSize: 12,
    marginTop: 2
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  actionBtn: {
    padding: 8
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  modalBox: {
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    padding: 20
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 16
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 20
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  saveModalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8
  }
})
