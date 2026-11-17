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
const isSafeLocalImage = (source) => typeof source === 'string'
  && /^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(source)

function isValidImportedPost(post) {
  return post && typeof post.id === 'string' && post.id.trim()
    && typeof post.text === 'string'
    && (post.image == null || (
      isSafeLocalImage(post.image.src) && typeof post.image.name === 'string'
    ))
    && typeof post.createdAt === 'string' && Number.isFinite(Date.parse(post.createdAt))
}

function isValidImportedHighlight(collection) {
  return collection && typeof collection.id === 'string' && collection.id.trim()
    && typeof collection.title === 'string' && collection.title.trim()
    && Array.isArray(collection.items) && collection.items.length <= 8
    && collection.items.every((image) => image && isSafeLocalImage(image.src) && typeof image.name === 'string')
    && (collection.articleHighlights === undefined || (
      Array.isArray(collection.articleHighlights)
      && collection.articleHighlights.every((item) => item
        && typeof item.id === 'string' && typeof item.articleId === 'string'
        && typeof item.articleTitle === 'string' && typeof item.text === 'string'
        && typeof item.selectedText === 'boolean'
        && typeof item.createdAt === 'string' && Number.isFinite(Date.parse(item.createdAt)))
    ))
}

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
let workspaceSaveErrorNotified = false
const postsReady = loadStoredPosts().then((storedPosts) => {
  posts.value = storedPosts
})

watch(workspace, (value) => {
  saveStatus.value = 'saving'
  const saved = saveWorkspace(value)
  saveStatus.value = saved ? 'saved' : hasWorkspaceWriteConflict() ? 'conflict' : 'error'
  if (!saved && !workspaceSaveErrorNotified) {
    notifyAppError('Could not save this workspace in this browser.')
    workspaceSaveErrorNotified = true
  } else if (saved) {
    workspaceSaveErrorNotified = false
  }
}, { deep: true, immediate: true, flush: 'sync' })

window.addEventListener('pagehide', () => {
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

async function mergeBackupSnapshot(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.articles) || !Array.isArray(snapshot.posts)
    || !Array.isArray(snapshot.highlights)) {
    throw new Error('The selected ZIP does not contain valid writing data.')
  }
  if (snapshot.articles.some((article) => !article || typeof article.id !== 'string'
    || !article.id.trim() || typeof article.title !== 'string' || typeof article.body !== 'string')) {
    throw new Error('The selected ZIP contains an invalid article.')
  }
  if (snapshot.posts.some((post) => !isValidImportedPost(post))) {
    throw new Error('The selected ZIP contains an invalid post or unsupported image.')
  }
  if (snapshot.highlights.some((item) => !isValidImportedHighlight(item))) {
    throw new Error('The selected ZIP contains an invalid highlight collection.')
  }
  await postsReady

  const articleIds = new Set(workspace.value.articles.map((article) => article.id))
  const newArticles = snapshot.articles.filter((article) => (
    article && typeof article.id === 'string' && article.id.trim()
    && typeof article.title === 'string' && typeof article.body === 'string'
    && !articleIds.has(article.id) && articleIds.add(article.id)
  ))
  const importedProfile = snapshot.state?.profile
  const hasValidProfile = importedProfile && typeof importedProfile.name === 'string'
    && typeof importedProfile.bio === 'string' && typeof importedProfile.avatar === 'string'
  const currentProfileIsDefault = workspace.value.profile.name === 'Jeyamohan'
    && !workspace.value.profile.bio && workspace.value.profile.avatar === '✍️'
  const nextWorkspace = {
    ...workspace.value,
    profile: currentProfileIsDefault && hasValidProfile ? importedProfile : workspace.value.profile,
    articles: [...workspace.value.articles, ...newArticles],
  }
  const profileChanged = nextWorkspace.profile !== workspace.value.profile
  if ((newArticles.length || profileChanged) && !saveWorkspace(nextWorkspace)) {
    throw new Error('Could not merge articles into browser storage. Download a backup or free storage, then retry.')
  }

  const postIds = new Set(posts.value.map((post) => post.id))
  const newPosts = snapshot.posts.filter((post) => (
    isValidImportedPost(post)
    && !postIds.has(post.id) && postIds.add(post.id)
  )).map((post) => ({ ...post, syncStatus: post.syncStatus === 'pending' ? 'pending' : 'local-only' }))
  const nextPosts = [...newPosts, ...posts.value]
  if (newPosts.length && !await savePosts(nextPosts)) {
    throw new Error('Could not save imported posts in browser storage. Articles may already be merged; retrying this ZIP will skip duplicates.')
  }

  const highlightIds = new Set(highlights.value.map((item) => item.id))
  const newHighlights = snapshot.highlights.filter((item) => (
    isValidImportedHighlight(item)
    && !highlightIds.has(item.id) && highlightIds.add(item.id)
  ))
  const nextHighlights = [...newHighlights, ...highlights.value]
  if (newHighlights.length && !saveHighlights(nextHighlights)) {
    throw new Error('Could not save imported highlights. Articles or posts may already be merged; retrying this ZIP will skip duplicates.')
  }

  workspace.value = nextWorkspace
  posts.value = nextPosts
  highlights.value = nextHighlights

  const state = snapshot.state
  if (state && typeof state === 'object') {
    const bookmarkIds = Array.isArray(state.bookmarks)
      ? state.bookmarks.filter((id) => typeof id === 'string' && id.trim())
      : []
    const shortcutIds = Array.isArray(state.shortcuts)
      ? state.shortcuts.filter((id) => typeof id === 'string' && id.trim())
      : []
    const mergedBookmarks = [...new Set([...bookmarkedIds.value, ...bookmarkIds])]
    const mergedShortcuts = [...new Set([...shortcutIds.value, ...shortcutIds])]
    if (!saveBookmarkedArticleIds(mergedBookmarks) || !saveHomeShortcutArticleIds(mergedShortcuts)) {
      throw new Error('Writing data was imported, but some saved article lists could not be merged.')
    }
    bookmarkedIds.value = mergedBookmarks
    shortcutIds.value = mergedShortcuts

    if (state.localStorage && typeof state.localStorage === 'object' && !Array.isArray(state.localStorage)) {
      try {
        for (const [key, value] of Object.entries(state.localStorage)) {
          if ((key.startsWith('jeyamohan-') || key === 'ezhuthu-draft-v1')
            && key !== 'jeyamohan-local-posts-v1'
            && key !== WORKSPACE_KEY
            && typeof value === 'string'
            && (localStorage.getItem(key) === null || localStorage.getItem(key) === '')) {
            localStorage.setItem(key, value)
          }
        }
      } catch {
        throw new Error('Writing data was imported, but some saved preferences could not be merged.')
      }
    }
  }

  return {
    articles: newArticles.length,
    posts: newPosts.length,
    highlights: newHighlights.length,
  }
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
    mergeBackupSnapshot,
    toggleBookmark,
    toggleShortcut,
    saveHighlightCollections,
    setSessionStatus,
  }
}
