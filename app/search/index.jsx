import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Search as SearchIcon, X, Music2, Video, Users, Disc } from 'lucide-react-native'
import { useTheme } from '../../src/stores/useTheme'
import { usePlayback } from '../../src/stores/usePlayback'
import { searchMedia } from '../../src/database/db'
import { TrackItem } from '../../src/components/TrackItem'
import { VideoCard } from '../../src/components/VideoCard'

export default function SearchScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { theme, spacing, radii, typography } = useTheme()
  const { currentMedia, isPlaying, playMedia } = usePlayback()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState({ songs: [], videos: [], artists: [], albums: [] })
  const [isSearching, setIsSearching] = useState(false)

  const performSearch = useCallback(async (text) => {
    if (!text || text.trim().length === 0) {
      setResults({ songs: [], videos: [], artists: [], albums: [] })
      return
    }
    setIsSearching(true)
    try {
      const res = await searchMedia(text.trim())
      setResults(res)
    } catch (err) {
      console.warn('Search query error:', err)
    } finally {
      setIsSearching(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query)
    }, 200)
    return () => clearTimeout(timer)
  }, [query, performSearch])

  const hasAnyResults =
    results.songs.length > 0 ||
    results.videos.length > 0 ||
    results.artists.length > 0 ||
    results.albums.length > 0

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      {/* Search Input Bar */}
      <View style={[styles.searchBarWrapper, { borderBottomColor: theme.colors.borderSubtle }]}>
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: theme.colors.surfaceElevated,
              borderColor: theme.colors.border,
              borderRadius: radii.md
            }
          ]}
        >
          <SearchIcon size={18} color={theme.colors.textMuted} />
          <TextInput
            style={[styles.input, { color: theme.colors.textPrimary }]}
            placeholder="Search songs, videos, artists, albums..."
            placeholderTextColor={theme.colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
              <X size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {query.trim().length > 0 && !hasAnyResults && !isSearching && (
          <View style={styles.noResults}>
            <Text style={[styles.noResultsText, { color: theme.colors.textMuted }]}>
              No results found for “{query}”
            </Text>
          </View>
        )}

        {/* Songs Section */}
        {results.songs.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
              Songs ({results.songs.length})
            </Text>
            {results.songs.map((song, idx) => (
              <TrackItem
                key={song.id}
                track={song}
                isActive={currentMedia?.id === song.id}
                isPlaying={isPlaying && currentMedia?.id === song.id}
                onPress={() => {
                  playMedia(song, results.songs, idx)
                  router.push('/player/audio')
                }}
              />
            ))}
          </View>
        )}

        {/* Videos Section */}
        {results.videos.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
              Videos ({results.videos.length})
            </Text>
            {results.videos.map((vid, idx) => (
              <VideoCard
                key={vid.id}
                video={vid}
                onPress={() => {
                  playMedia(vid, results.videos, idx)
                  router.push('/player/video')
                }}
              />
            ))}
          </View>
        )}

        {/* Artists Section */}
        {results.artists.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
              Artists ({results.artists.length})
            </Text>
            {results.artists.map((artist) => (
              <View
                key={artist.name}
                style={[styles.artistRow, { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.md }]}
              >
                <View style={[styles.avatarCircle, { backgroundColor: theme.colors.accentSubtle, borderRadius: radii.full }]}>
                  <Users size={18} color={theme.colors.accent} />
                </View>
                <View style={styles.artistInfo}>
                  <Text style={[styles.artistName, { color: theme.colors.textPrimary }]}>{artist.name}</Text>
                  <Text style={[styles.artistCount, { color: theme.colors.textSecondary }]}>
                    {artist.trackCount} tracks
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Albums Section */}
        {results.albums.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
              Albums ({results.albums.length})
            </Text>
            {results.albums.map((album) => (
              <View
                key={album.title}
                style={[styles.artistRow, { backgroundColor: theme.colors.surfaceElevated, borderRadius: radii.md }]}
              >
                <View style={[styles.avatarCircle, { backgroundColor: theme.colors.accentSubtle, borderRadius: radii.sm }]}>
                  <Disc size={18} color={theme.colors.accent} />
                </View>
                <View style={styles.artistInfo}>
                  <Text style={[styles.artistName, { color: theme.colors.textPrimary }]}>{album.title}</Text>
                  <Text style={[styles.artistCount, { color: theme.colors.textSecondary }]}>
                    {album.artist} • {album.trackCount} tracks
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  searchBarWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    height: 44,
    gap: 8
  },
  input: {
    flex: 1,
    fontSize: 14,
    height: '100%'
  },
  clearBtn: {
    padding: 4
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 40
  },
  noResults: {
    padding: 40,
    alignItems: 'center'
  },
  noResultsText: {
    fontSize: 14
  },
  section: {
    marginBottom: 20
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10
  },
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginVertical: 4,
    gap: 12
  },
  avatarCircle: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center'
  },
  artistInfo: {
    flex: 1
  },
  artistName: {
    fontSize: 15,
    fontWeight: '600'
  },
  artistCount: {
    fontSize: 12,
    marginTop: 2
  }
})
