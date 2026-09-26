import React from 'react'
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native'
import { Stack, useRouter, usePathname } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  Home,
  Music2,
  Video,
  ListMusic,
  Search,
  Settings as SettingsIcon
} from 'lucide-react-native'
import { ThemeProvider, useTheme } from '../src/stores/useTheme'
import { MiniPlayer } from '../src/components/MiniPlayer'

function NavigationBar() {
  const router = useRouter()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()
  const { theme, radii, typography } = useTheme()

  // Hide nav bar inside full-screen audio and video players
  if (pathname.startsWith('/player')) {
    return null
  }

  const navItems = [
    { label: 'Home', route: '/', icon: Home },
    { label: 'Music', route: '/music', icon: Music2 },
    { label: 'Videos', route: '/videos', icon: Video },
    { label: 'Playlists', route: '/playlists', icon: ListMusic },
    { label: 'Search', route: '/search', icon: Search },
    { label: 'Settings', route: '/settings', icon: SettingsIcon }
  ]

  const isCurrentRoute = (route) => {
    if (route === '/') return pathname === '/'
    return pathname.startsWith(route)
  }

  return (
    <View
      style={[
        styles.navContainer,
        {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.borderSubtle,
          paddingBottom: Math.max(insets.bottom, 8)
        }
      ]}
    >
      {navItems.map((item) => {
        const active = isCurrentRoute(item.route)
        const IconComponent = item.icon
        return (
          <TouchableOpacity
            key={item.route}
            style={styles.navButton}
            activeOpacity={0.7}
            onPress={() => {
              if (pathname !== item.route) {
                router.push(item.route)
              }
            }}
          >
            <View
              style={[
                styles.iconBadge,
                active && { backgroundColor: theme.colors.accentSubtle, borderRadius: radii.full }
              ]}
            >
              <IconComponent
                size={20}
                color={active ? theme.colors.accentLight : theme.colors.textMuted}
              />
            </View>
            <Text
              style={[
                styles.navLabel,
                {
                  color: active ? theme.colors.accentLight : theme.colors.textMuted,
                  fontSize: 10,
                  fontWeight: active ? '700' : '500'
                }
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

function RootContent() {
  const { theme, isDark } = useTheme()

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={styles.screenWrapper}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            contentStyle: { backgroundColor: theme.colors.background }
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="music/index" />
          <Stack.Screen name="videos/index" />
          <Stack.Screen name="playlists/index" />
          <Stack.Screen name="playlists/[id]" />
          <Stack.Screen name="search/index" />
          <Stack.Screen
            name="player/audio"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom'
            }}
          />
          <Stack.Screen
            name="player/video"
            options={{
              presentation: 'fullScreenModal',
              animation: 'fade'
            }}
          />
          <Stack.Screen name="settings/index" />
        </Stack>
      </View>

      {/* Authoritative persistent MiniPlayer */}
      <MiniPlayer />

      {/* Global Bottom Navigation */}
      <NavigationBar />
    </View>
  )
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootContent />
      </ThemeProvider>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  screenWrapper: {
    flex: 1
  },
  navContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    paddingTop: 6
  },
  navButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 2
  },
  iconBadge: {
    paddingHorizontal: 12,
    paddingVertical: 3,
    marginBottom: 2
  },
  navLabel: {
    letterSpacing: 0.1
  }
})
