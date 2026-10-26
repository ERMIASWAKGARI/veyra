import React, { useLayoutEffect, useRef, useState } from 'react'
import { PanResponder, StyleSheet, View } from 'react-native'

export function SeekBar({ position, duration, onSeek, onScrubStart = undefined, onScrubEnd = undefined, color = '#818CF8', trackColor = '#343640' }) {
  const [preview, setPreview] = useState(null)
  const latest = useRef({ duration, onSeek, onScrubStart, onScrubEnd })
  const geometry = useRef({ width: 1, startX: 0, position: 0 })
  useLayoutEffect(() => { latest.current = { duration, onSeek, onScrubStart, onScrubEnd } })

  // PanResponder stores callbacks; refs are read only when a gesture fires.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() => {
    const update = (x) => {
      const next = Math.max(0, Math.min(1, x / geometry.current.width)) * latest.current.duration
      geometry.current.position = next
      setPreview(next)
    }
    const finish = (cancelled) => {
      if (!cancelled) latest.current.onSeek(geometry.current.position)
      setPreview(null)
      latest.current.onScrubEnd?.()
    }
    return PanResponder.create({
      onStartShouldSetPanResponder: () => latest.current.duration > 0,
      onMoveShouldSetPanResponder: () => latest.current.duration > 0,
      onPanResponderGrant: (event) => {
        geometry.current.startX = event.nativeEvent.locationX
        latest.current.onScrubStart?.()
        update(geometry.current.startX)
      },
      onPanResponderMove: (_, gesture) => update(geometry.current.startX + gesture.dx),
      onPanResponderRelease: () => finish(false),
      onPanResponderTerminate: () => finish(true),
      onPanResponderTerminationRequest: () => false
    })
  })
  const ratio = duration > 0 ? Math.max(0, Math.min(1, (preview ?? position) / duration)) : 0

  return (
    <View
      testID="playback-seek-bar"
      style={styles.touchArea}
      onLayout={(event) => { geometry.current.width = Math.max(1, event.nativeEvent.layout.width) }}
      {...responder.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Playback position"
      accessibilityValue={{ min: 0, max: Math.round(duration / 1000), now: Math.round(position / 1000) }}
      accessibilityActions={[{ name: 'increment', label: 'Forward ten seconds' }, { name: 'decrement', label: 'Back ten seconds' }]}
      onAccessibilityAction={({ nativeEvent }) => onSeek(Math.max(0, Math.min(duration, position + (nativeEvent.actionName === 'increment' ? 10000 : -10000))))}
    >
      <View pointerEvents="none" style={[styles.track, { backgroundColor: trackColor }]}>
        <View style={[styles.fill, { backgroundColor: color, width: `${ratio * 100}%` }]} />
      </View>
      <View pointerEvents="none" style={[styles.thumb, { backgroundColor: color, left: `${ratio * 100}%` }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  touchArea: { height: 44, justifyContent: 'center', marginHorizontal: 7 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%' },
  thumb: { position: 'absolute', width: 14, height: 14, borderRadius: 7, marginLeft: -7 }
})
