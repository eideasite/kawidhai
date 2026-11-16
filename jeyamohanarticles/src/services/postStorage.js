import { createId } from '../utils/createId.js'

const POSTS_KEY = 'jeyamohan-local-posts-v1'
const POSTS_DATABASE = 'jeyamohan-local-posts-v1'
const POSTS_DATABASE_VERSION = 1
const POSTS_STORE = 'snapshots'
const POSTS_SNAPSHOT_ID = 'all-posts'
let databasePromise

function normalizePosts(value) {
  if (!Array.isArray(value)) return []
  const seenIds = new Set()
  return value.filter((post) => post && typeof post === 'object').map((post) => {
    let id = typeof post.id === 'string' && post.id.trim() ? post.id : createId('post')
    if (seenIds.has(id)) id = createId('post')
    seenIds.add(id)
    return {
      id,
      text: typeof post.text === 'string' ? post.text : '',
      image: post.image && typeof post.image.src === 'string'
        ? { src: post.image.src, name: typeof post.image.name === 'string' ? post.image.name : '' }
        : null,
      createdAt: typeof post.createdAt === 'string' && Number.isFinite(Date.parse(post.createdAt))
        ? post.createdAt
        : new Date().toISOString(),
      syncStatus: post.syncStatus === 'pending' ? 'pending' : 'local-only',
    }
  })
}

function openPostsDatabase() {
  if (!globalThis.indexedDB) return Promise.reject(new Error('IndexedDB is unavailable.'))
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(POSTS_DATABASE, POSTS_DATABASE_VERSION)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(POSTS_STORE)) {
          request.result.createObjectStore(POSTS_STORE, { keyPath: 'id' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error || new Error('Could not open local post storage.'))
      request.onblocked = () => reject(new Error('Local post storage is blocked by another tab.'))
    })
  }
  return databasePromise
}

function readPostsSnapshot(database) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(POSTS_STORE, 'readonly')
    const request = transaction.objectStore(POSTS_STORE).get(POSTS_SNAPSHOT_ID)
    request.onsuccess = () => resolve(request.result?.posts)
    request.onerror = () => reject(request.error || new Error('Could not read locally saved posts.'))
    transaction.onabort = () => reject(transaction.error || new Error('Could not read locally saved posts.'))
  })
}

function writePostsSnapshot(database, posts) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(POSTS_STORE, 'readwrite')
    transaction.objectStore(POSTS_STORE).put({ id: POSTS_SNAPSHOT_ID, posts })
    transaction.oncomplete = resolve
    transaction.onerror = () => reject(transaction.error || new Error('Could not save locally queued posts.'))
    transaction.onabort = () => reject(transaction.error || new Error('Could not save locally queued posts.'))
  })
}

export function loadPosts() {
  try {
    const value = JSON.parse(localStorage.getItem(POSTS_KEY) || '[]')
    return normalizePosts(value)
  } catch {
    return []
  }
}

export async function loadStoredPosts() {
  const cachedPosts = loadPosts()
  try {
    const database = await openPostsDatabase()
    const storedPosts = await readPostsSnapshot(database)
    if (Array.isArray(storedPosts)) return normalizePosts(storedPosts)
    if (cachedPosts.length) await writePostsSnapshot(database, cachedPosts)
    return cachedPosts
  } catch {
    return cachedPosts
  }
}

export async function savePosts(posts) {
  try {
    const database = await openPostsDatabase()
    await writePostsSnapshot(database, posts)
    return true
  } catch {
    try {
      localStorage.setItem(POSTS_KEY, JSON.stringify(posts))
      return true
    } catch {
      return false
    }
  }
}

export function createLocalPost({ text = '', image = null, syncStatus = 'local-only' } = {}) {
  return {
    id: createId('post'),
    text: typeof text === 'string' ? text.trim() : '',
    image: image && typeof image.src === 'string'
      ? { src: image.src, name: typeof image.name === 'string' ? image.name : '' }
      : null,
    createdAt: new Date().toISOString(),
    syncStatus: syncStatus === 'pending' ? 'pending' : 'local-only',
  }
}
