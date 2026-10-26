const { defineConfig } = require('eslint/config')
const expo = require('eslint-config-expo/flat')

module.exports = defineConfig([
  expo,
  // expo-video SharedObjects intentionally expose mutable native player properties.
  { files: ['app/player/video.jsx'], rules: { 'react-hooks/immutability': 'off' } },
  // Keep the stable async loader used by route focus subscriptions in this screen.
  { files: ['app/videos/index.jsx'], rules: { 'react-hooks/preserve-manual-memoization': 'off' } },
  { ignores: ['dist/**', 'android/**', '.expo/**'] }
])
