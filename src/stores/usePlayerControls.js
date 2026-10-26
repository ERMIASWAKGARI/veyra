import { useCallback, useEffect, useState } from 'react'

export function usePlayerControls(playing, blocked) {
  const [visible, setVisible] = useState(true)
  const [interaction, setInteraction] = useState(0)
  const reveal = useCallback(() => {
    setVisible(true)
    setInteraction((value) => value + 1)
  }, [])
  const toggle = useCallback(() => {
    setVisible((value) => !value)
    setInteraction((value) => value + 1)
  }, [])

  useEffect(() => {
    if (!visible || !playing || blocked) return
    const timeout = setTimeout(() => setVisible(false), 4000)
    return () => clearTimeout(timeout)
  }, [visible, playing, blocked, interaction])

  // Paused, buffering and failed videos always keep transport controls reachable.
  return { visible: visible || !playing || blocked, reveal, toggle }
}
