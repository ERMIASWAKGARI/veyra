import React, { createContext, useContext, useState, useEffect } from 'react'
import { useColorScheme } from 'react-native'
import { darkTheme, lightTheme, spacing, radii, typography } from '../constants/theme'
import { getSetting, setSetting } from '../database/db'
import { APP_CONFIG } from '../constants/config'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme()
  const [themePreference, setThemePreference] = useState('system') // 'system' | 'dark' | 'light'

  useEffect(() => {
    getSetting(APP_CONFIG.storageKeys.theme, 'system').then((saved) => {
      if (saved) setThemePreference(saved)
    })
  }, [])

  const changeTheme = async (mode) => {
    setThemePreference(mode)
    await setSetting(APP_CONFIG.storageKeys.theme, mode)
  }

  const isDark =
    themePreference === 'dark' || (themePreference === 'system' && systemScheme !== 'light')

  const currentTheme = isDark ? darkTheme : lightTheme

  const value = {
    theme: currentTheme,
    isDark,
    themePreference,
    setThemePreference: changeTheme,
    spacing,
    radii,
    typography
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    return {
      theme: darkTheme,
      isDark: true,
      themePreference: 'dark',
      setThemePreference: () => {},
      spacing,
      radii,
      typography
    }
  }
  return context
}
