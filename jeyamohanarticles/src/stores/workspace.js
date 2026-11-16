import { computed, ref, watch } from 'vue'
import {
  getWorkspaceRecoveryState,
  hasWorkspaceWriteConflict,
  loadWorkspace,
  saveWorkspace,
  WORKSPACE_KEY,
} from '../services/articleStorage.js'
import { loadPosts, loadStoredPosts, savePosts, createLocalPost } from '../services/postStorage.js'
import {
  loadBookmarkedArticleIds,
  loadHomeShortcutArticleIds,
  saveBookmarkedArticleIds,
  saveHomeShortcutArticleIds,
} from '../services/articleReferenceStorage.js'
import { loadHighlights, saveHighlights } from '../services/highlightStorage.js'
import { createArticle } from '../utils/article.js'
import { notifyAppError } from '../services/errorNotifications.js'

const THEME_STORAGE_KEY = 'jeyamohan-articles-theme-v1'
const LANGUAGE_STORAGE_KEY = 'jeyamohan-articles-language-v1'
const SESSION_KEY = 'jeyamohan-articles-local-session-v1'

function readPreference(key, allowed, fallback) {
  try {
    const value = localStorage.getItem(key)
    return allowed.includes(value) ? value : fallback
  } catch {
    return fallback
  }
}

function loadSessionStatus() {
  try {
    const status = sessionStorage.getItem(SESSION_KEY)
    return status === 'locked' || status === 'signed-out' ? status : 'active'
  } catch {
    return 'active'
  }
}

const workspace = ref(loadWorkspace())
const posts = ref(loadPosts())
const highlights = ref(loadHighlights())
const bookmarkedIds = ref(loadBookmarkedArticleIds())
const shortcutIds = ref(loadHomeShortcutArticleIds())
const saveStatus = ref('saving')
const theme = ref(readPreference(THEME_STORAGE_KEY, ['light', 'dark'], 'light'))
const language = ref(readPreference(LANGUAGE_STORAGE_KEY, ['en', 'ta'], 'en'))
const sessionStatus = ref(loadSessionStatus())
const recoveryState = getWorkspaceRecoveryState()
let saveTimer
const postsReady = loadStoredPosts().then((storedPosts) => {
  posts.value = storedPosts
})

watch(workspace, (value) => {
  saveStatus.value = 'saving'
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    const saved = saveWorkspace(value)
    saveStatus.value = saved ? 'saved' : hasWorkspaceWriteConflict() ? 'conflict' : 'error'
    if (!saved) notifyAppError('Could not save this workspace in this browser.')
  }, 350)
}, { deep: true, immediate: true })

window.addEventListener('pagehide', () => {
  window.clearTimeout(saveTimer)
  saveWorkspace(workspace.value)
})
window.addEventListener('storage', (event) => {
  if (event.key === WORKSPACE_KEY && event.newValue !== event.oldValue) saveStatus.value = 'conflict'
})

watch(theme, (value) => {
  document.documentElement.dataset.theme = value
  try {
    localStorage.setItem(THEME_STORAGE_KEY, value)
  } catch {
    notifyAppError('The theme could not be saved in this browser.')
  }
}, { immediate: true })

watch(language, (value) => {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, value)
  } catch {
    notifyAppError('The language preference could not be saved in this browser.')
  }
})

function replaceWorkspace(next) {
  workspace.value = next
}

function updateArticle(id, patch) {
  if (!id || !workspace.value.articles.some((item) => item.id === id)) return false
  const updatedAt = new Date().toISOString()
  replaceWorkspace({
    ...workspace.value,
    articles: workspace.value.articles.map((item) => item.id === id ? { ...item, ...patch, updatedAt } : item),
  })
  return true
}

function createNewArticle() {
  const article = createArticle()
  replaceWorkspace({ ...workspace.value, articles: [article, ...workspace.value.articles] })
  return article
}

function discardArticle(id) {
  if (!workspace.value.articles.some((item) => item.id === id)) return false
  replaceWorkspace({ ...workspace.value, articles: workspace.value.articles.filter((item) => item.id !== id) })
  return true
}

async function createPost(post) {
  await postsReady
  const next = [createLocalPost(post), ...posts.value]
  if (!await savePosts(next)) return false
  posts.value = next
  return true
}

function updateArticleIds(current, saver, nextIds) {
  if (!saver(nextIds)) {
    notifyAppError('Could not save this article list in this browser.')
    return false
  }
  current.value = nextIds
  return true
}

function toggleBookmark(articleId) {
  if (!workspace.value.articles.some((item) => item.id === articleId)) return false
  const next = bookmarkedIds.value.includes(articleId)
    ? bookmarkedIds.value.filter((id) => id !== articleId)
    : [articleId, ...bookmarkedIds.value]
  return updateArticleIds(bookmarkedIds, saveBookmarkedArticleIds, next)
}

function toggleShortcut(articleId) {
  if (!workspace.value.articles.some((item) => item.id === articleId)) return false
  const next = shortcutIds.value.includes(articleId)
    ? shortcutIds.value.filter((id) => id !== articleId)
    : [articleId, ...shortcutIds.value]
  return updateArticleIds(shortcutIds, saveHomeShortcutArticleIds, next)
}

function saveHighlightCollections(next) {
  if (!saveHighlights(next)) {
    notifyAppError('Could not save highlights in this browser.')
    return false
  }
  highlights.value = next
  return true
}

function setSessionStatus(nextStatus) {
  try {
    if (nextStatus === 'active') sessionStorage.removeItem(SESSION_KEY)
    else sessionStorage.setItem(SESSION_KEY, nextStatus)
  } catch {
    if (nextStatus !== 'active') notifyAppError('The browser could not remember this session state.')
  }
  sessionStatus.value = nextStatus
}

const activeArticles = computed(() => workspace.value.articles.filter((article) => !article.archived))

export function useWorkspace() {
  return {
    workspace,
    posts,
    highlights,
    bookmarkedIds,
    shortcutIds,
    saveStatus,
    theme,
    language,
    sessionStatus,
    recoveryState,
    activeArticles,
    updateArticle,
    createNewArticle,
    discardArticle,
    createPost,
    toggleBookmark,
    toggleShortcut,
    saveHighlightCollections,
    setSessionStatus,
  }
}
