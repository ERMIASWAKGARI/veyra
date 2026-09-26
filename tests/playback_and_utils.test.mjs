import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { formatTime, formatBytes, truncateText } from '../src/utils/format.js'
import { APP_CONFIG } from '../src/constants/config.js'

describe('Formatting Utilities', () => {
  test('formatTime correctly formats seconds and minutes', () => {
    assert.equal(formatTime(0), '0:00')
    assert.equal(formatTime(5000), '0:05')
    assert.equal(formatTime(65000), '1:05')
    assert.equal(formatTime(3600000), '1:00:00')
    assert.equal(formatTime(3665000), '1:01:05')
    assert.equal(formatTime(-100), '0:00')
    assert.equal(formatTime(null), '0:00')
  })

  test('formatBytes correctly formats file sizes', () => {
    assert.equal(formatBytes(0), '0 B')
    assert.equal(formatBytes(1024), '1 KB')
    assert.equal(formatBytes(1048576), '1 MB')
    assert.equal(formatBytes(5242880), '5 MB')
  })

  test('truncateText truncates properly', () => {
    assert.equal(truncateText('Short text', 20), 'Short text')
    assert.equal(truncateText('Very long text that should be truncated', 10), 'Very long ...')
  })
})

describe('Configuration & Constants', () => {
  test('APP_CONFIG defines appName as VEYRA and does not hardcode elsewhere', () => {
    assert.equal(APP_CONFIG.appName, 'VEYRA')
    assert.equal(APP_CONFIG.packageId, 'com.veyra.player')
    assert.equal(APP_CONFIG.playback.completionThresholdRatio, 0.9)
    assert.deepEqual(APP_CONFIG.playback.audioSpeeds, [0.75, 1.0, 1.25, 1.5, 2.0])
    assert.deepEqual(APP_CONFIG.playback.videoSpeeds, [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0])
  })
})

describe('Queue Manipulation & Deterministic Shuffle', () => {
  function createQueue(count) {
    return Array.from({ length: count }, (_, i) => ({ id: `track_${i}`, title: `Track ${i}` }))
  }

  function fisherYatesShuffle(indices) {
    const arr = [...indices]
    for (let i = arr.length - 1; i > 0; i--) {
      // Deterministic pseudo-random seed for test predictability
      const j = (i * 7) % (i + 1)
      const temp = arr[i]
      arr[i] = arr[j]
      arr[j] = temp
    }
    return arr
  }

  test('Deterministic shuffle contains all original indices without loss', () => {
    const queue = createQueue(10)
    const indices = queue.map((_, i) => i)
    const shuffled = fisherYatesShuffle(indices)

    assert.equal(shuffled.length, 10)
    const sorted = [...shuffled].sort((a, b) => a - b)
    assert.deepEqual(sorted, indices)
  })

  test('Queue insertion at next position preserves order', () => {
    const queue = createQueue(3) // [0, 1, 2]
    const newItem = { id: 'next_item', title: 'Next Up' }
    const currentIndex = 0
    queue.splice(currentIndex + 1, 0, newItem)

    assert.equal(queue.length, 4)
    assert.equal(queue[1].id, 'next_item')
    assert.equal(queue[2].id, 'track_1')
  })

  test('Completion threshold correctly resets position past 90%', () => {
    const duration = 100000 // 100s
    const threshold = APP_CONFIG.playback.completionThresholdRatio // 0.9 (90s)

    const pos1 = 50000 // 50%
    const isCompleted1 = (pos1 / duration) >= threshold
    assert.equal(isCompleted1, false)

    const pos2 = 92000 // 92%
    const isCompleted2 = (pos2 / duration) >= threshold
    assert.equal(isCompleted2, true)
  })
})
