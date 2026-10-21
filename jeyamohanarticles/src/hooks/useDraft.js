import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { saveWorkspace } from '../services/articleStorage.js'

export function useDraft(workspace) {
  const [saveStatus, setSaveStatus] = useState('saved')
  const latestWorkspace = useRef(workspace)

  useLayoutEffect(() => {
    latestWorkspace.current = workspace
  }, [workspace])

  useEffect(() => {
    const timer = window.setTimeout(() => setSaveStatus(saveWorkspace(workspace) ? 'saved' : 'error'), 350)
    return () => window.clearTimeout(timer)
  }, [workspace])

  useEffect(() => {
    const flushPendingSave = () => {
      saveWorkspace(latestWorkspace.current)
    }
    window.addEventListener('pagehide', flushPendingSave)
    return () => window.removeEventListener('pagehide', flushPendingSave)
  }, [])

  const saveNow = () => {
    const saved = saveWorkspace(latestWorkspace.current)
    setSaveStatus(saved ? 'saved' : 'error')
    return saved
  }
  return { saveStatus, setSaveStatus, saveNow }
}

