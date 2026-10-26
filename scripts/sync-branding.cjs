// Rebuild launcher resources from the four approved PNGs. Never redraw the artwork.
const fs = require('node:fs/promises')
const path = require('node:path')
const { generateImageAsync } = require('@expo/image-utils')

const root = path.resolve(__dirname, '..')
const branding = path.join(root, 'assets/branding')
const resources = path.join(root, 'android/app/src/main/res')
const sources = {
  icon: path.join(branding, 'veyra-icon-1024.png'),
  store: path.join(branding, 'veyra-icon-playstore-512.png'),
  background: path.join(branding, 'adaptive-icon/ic_launcher_background-xxxhdpi-432.png'),
  foreground: path.join(branding, 'adaptive-icon/ic_launcher_foreground-xxxhdpi-432.png')
}

async function resize(src, destination, size) {
  const { source } = await generateImageAsync({ projectRoot: root, cacheType: 'veyra-branding' }, {
    src, width: size, height: size, resizeMode: 'contain'
  })
  await fs.mkdir(path.dirname(destination), { recursive: true })
  await fs.writeFile(destination, source)
}

async function main() {
  for (const [density, scale] of Object.entries({ mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 })) {
    for (const [name, source, size] of [
      ['ic_launcher', sources.store, 48 * scale],
      ['ic_launcher_round', sources.store, 48 * scale],
      ['ic_launcher_background', sources.background, 108 * scale],
      ['ic_launcher_foreground', sources.foreground, 108 * scale]
    ]) {
      const target = path.join(resources, `mipmap-${density}`, name)
      await resize(source, `${target}.png`, size)
      // aapt requires a single file per resource name; replace the old WebP placeholder.
      await fs.unlink(`${target}.webp`).catch((error) => { if (error.code !== 'ENOENT') throw error })
    }
    await resize(sources.icon, path.join(resources, `drawable-${density}/splashscreen_logo.png`), 160 * scale)
    await resize(sources.store, path.join(branding, `legacy-launcher-icon/ic_launcher-${density}-${48 * scale}.png`), 48 * scale)
    // Keep density exports consistent with the approved 432px foreground/background.
    for (const layer of ['background', 'foreground']) {
      if (density === 'xxxhdpi') continue
      await resize(sources[layer], path.join(branding, `adaptive-icon/ic_launcher_${layer}-${density}-${108 * scale}.png`), 108 * scale)
    }
  }
  for (const [destination, source] of Object.entries({
    'icon.png': sources.icon, 'favicon.png': sources.store, 'splash-icon.png': sources.icon,
    'android-icon-background.png': sources.background, 'android-icon-foreground.png': sources.foreground
  })) await fs.copyFile(source, path.join(root, 'assets', destination))
  console.log('Updated Android launcher, splash, and fallback assets from the approved VEYRA logos.')
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
