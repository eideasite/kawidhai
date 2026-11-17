import { ref, watch } from 'vue'
import { notifyAppError } from './errorNotifications.js'

const AI_SEARCH_DELAY_MS = 3000
const AI_SEARCH_QUERY_KEY = 'jeyamohan-ai-search-query-v1'

function loadSavedAiSearchQuery() {
  try {
    return localStorage.getItem(AI_SEARCH_QUERY_KEY) || ''
  } catch {
    return ''
  }
}

export const aiSearchQuery = ref(loadSavedAiSearchQuery())
let aiSearchDraftSaveErrorNotified = false

watch(aiSearchQuery, (query) => {
  try {
    if (query) localStorage.setItem(AI_SEARCH_QUERY_KEY, query)
    else localStorage.removeItem(AI_SEARCH_QUERY_KEY)
    aiSearchDraftSaveErrorNotified = false
  } catch {
    if (!aiSearchDraftSaveErrorNotified) {
      notifyAppError('Could not save your AI search draft in this browser.')
      aiSearchDraftSaveErrorNotified = true
    }
  }
}, { flush: 'sync' })

export const AI_PROVIDERS = [
  { name: 'Google Gemini', url: 'https://gemini.google.com/' },
  { name: 'ChatGPT', url: 'https://chatgpt.com/' },
  { name: 'Meta AI', url: 'https://www.meta.ai/' },
]

function closeTabs(tabs) {
  for (const { tab } of tabs) {
    if (!tab.closed) tab.close()
  }
}

export async function openAiProviderTabs(text, providers = AI_PROVIDERS) {
  if (!text.trim() || !providers.length) return

  const tabs = []
  for (const provider of providers) {
    const tab = window.open('about:blank', '_blank')
    if (!tab) {
      closeTabs(tabs)
      throw new Error('An AI tab was blocked.')
    }

    tab.opener = null
    tabs.push({ tab, provider })
  }

  const delay = new Promise((resolve) => window.setTimeout(resolve, AI_SEARCH_DELAY_MS))
  let clipboardWrite
  try {
    clipboardWrite = navigator.clipboard.writeText(text).then(
      () => ({ success: true }),
      (error) => ({ success: false, error }),
    )
  } catch (error) {
    await delay
    closeTabs(tabs)
    throw error
  }

  await delay

  const clipboardResult = await clipboardWrite
  if (!clipboardResult.success) {
    closeTabs(tabs)
    throw clipboardResult.error
  }

  if (tabs.some(({ tab }) => tab.closed)) {
    closeTabs(tabs)
    throw new Error('An AI tab was closed before it opened.')
  }

  for (const { tab, provider } of tabs) {
    tab.location.replace(provider.url)
  }
}
