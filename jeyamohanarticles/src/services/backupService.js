import JSZip from 'jszip'
import { loadWorkspace, WORKSPACE_KEY } from './articleStorage.js'
import { loadBookmarkedArticleIds, loadHomeShortcutArticleIds } from './articleReferenceStorage.js'
import { loadHighlights } from './highlightStorage.js'
import { loadStoredPosts } from './postStorage.js'

export const MAX_BACKUP_BYTES = 387_000_000
export const MAX_IMPORTED_FILE_BYTES = 4 * 1024 * 1024

const BACKUP_FORMAT = 'omaara-local-backup'
const POSTS_FORMAT = 'omaara-posts-export'
const BACKUP_VERSION = 1
const TARGET_ARCHIVE_BYTES = 380_000_000
const POSTS_STORAGE_KEY = 'jeyamohan-local-posts-v1'
const STATE_FILENAME = 'app-state.json'
const textEncoder = new TextEncoder()

function byteLength(text) {
  return textEncoder.encode(text).byteLength
}

function datePath(dateValue, id) {
  const parsed = new Date(dateValue)
  const date = Number.isNaN(parsed.getTime()) ? new Date(0) : parsed
  const timestamp = date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '_')
  return `${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${String(date.getUTCDate()).padStart(2, '0')}/${timestamp}-${safeId}.json`
}

function readLocalPreferences() {
  const preferences = {}
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (!key || key === WORKSPACE_KEY || key === POSTS_STORAGE_KEY) continue
      if (key.startsWith('jeyamohan-') || key === 'ezhuthu-draft-v1') {
        preferences[key] = localStorage.getItem(key)
      }
    }
  } catch (error) {
    throw new Error(`Could not read local app settings: ${error.message}`, { cause: error })
  }
  return preferences
}

export async function collectBackupSnapshot() {
  const workspace = loadWorkspace()
  const [posts, highlights] = await Promise.all([loadStoredPosts(), Promise.resolve(loadHighlights())])
  return {
    workspace,
    posts,
    highlights,
    state: {
      profile: workspace.profile,
      bookmarks: loadBookmarkedArticleIds(),
      shortcuts: loadHomeShortcutArticleIds(),
      localStorage: readLocalPreferences(),
    },
  }
}

function recordsFromSnapshot(snapshot) {
  if (!snapshot?.workspace || !Array.isArray(snapshot.workspace.articles)
    || !Array.isArray(snapshot.posts) || !Array.isArray(snapshot.highlights)) {
    throw new Error('The local data could not be prepared for backup.')
  }
  const records = []
  for (const article of snapshot.workspace.articles) {
    const data = JSON.stringify(article)
    records.push({ path: `articles/${datePath(article.updatedAt || article.createdAt, article.id)}`, data })
  }
  for (const post of snapshot.posts) {
    const data = JSON.stringify(post)
    records.push({ path: `posts/${datePath(post.createdAt, post.id)}`, data })
  }
  for (const collection of snapshot.highlights) {
    const data = JSON.stringify(collection)
    records.push({ path: `highlights/${datePath(collection.updatedAt, collection.id)}`, data })
  }
  return records
}

function partitionRecords(records, sharedBytes = 0) {
  const groups = []
  let group = []
  let groupBytes = sharedBytes
  for (const record of records) {
    const size = byteLength(record.data) + byteLength(record.path) + 128
    if (size + sharedBytes > TARGET_ARCHIVE_BYTES) {
      throw new Error(`A single backup item is too large to fit in the ${MAX_BACKUP_BYTES / 1_000_000} MB ZIP limit.`)
    }
    if (group.length && groupBytes + size > TARGET_ARCHIVE_BYTES) {
      groups.push(group)
      group = []
      groupBytes = sharedBytes
    }
    group.push(record)
    groupBytes += size
  }
  if (group.length || groups.length === 0) groups.push(group)
  return groups
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

async function downloadRecordArchives({ records, state, format, filenamePrefix, onProgress }) {
  const stateText = state ? JSON.stringify(state) : ''
  const groups = partitionRecords(records, stateText ? byteLength(stateText) + 1024 : 0)
  const createdAt = new Date().toISOString()
  const stamp = createdAt.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  for (let index = 0; index < groups.length; index += 1) {
    const zip = new JSZip()
    zip.file('manifest.json', JSON.stringify({
      format,
      version: BACKUP_VERSION,
      createdAt,
      part: index + 1,
      totalParts: groups.length,
    }))
    if (stateText) zip.file(STATE_FILENAME, stateText)
    for (const record of groups[index]) zip.file(record.path, record.data)

    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' })
    if (blob.size > MAX_BACKUP_BYTES) {
      throw new Error(`A ZIP part exceeded the ${MAX_BACKUP_BYTES / 1_000_000} MB limit and was not downloaded.`)
    }
    downloadBlob(blob, `${filenamePrefix}_${stamp}_part-${String(index + 1).padStart(3, '0')}.zip`)
    onProgress?.(index + 1, groups.length)
    if (index < groups.length - 1) await new Promise((resolve) => window.setTimeout(resolve, 500))
  }
}

export async function downloadFullBackup(snapshot, onProgress) {
  const records = recordsFromSnapshot(snapshot)
  await downloadRecordArchives({
    records,
    state: snapshot.state,
    format: BACKUP_FORMAT,
    filenamePrefix: 'omaara-backup',
    onProgress,
  })
}

export async function downloadPostsArchive(posts, onProgress) {
  const records = posts.map((post) => ({
    path: `posts/${datePath(post.createdAt, post.id)}`,
    data: JSON.stringify(post),
  }))
  await downloadRecordArchives({
    records,
    format: POSTS_FORMAT,
    filenamePrefix: 'omaara-posts',
    onProgress,
  })
}

function validIdRecord(record) {
  return record && typeof record === 'object' && typeof record.id === 'string' && record.id.trim()
}

export async function readBackupArchive(file) {
  if (file.size > MAX_BACKUP_BYTES) {
    throw new Error(`ZIP files must be ${MAX_BACKUP_BYTES / 1_000_000} MB or smaller.`)
  }
  const zip = await JSZip.loadAsync(file, { checkCRC32: true })
  let uncompressedBytes = 0
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue
    const size = entry._data?.uncompressedSize
    if (!Number.isFinite(size) || size < 0) throw new Error('The ZIP contains an unreadable file entry.')
    uncompressedBytes += size
    if (uncompressedBytes > MAX_BACKUP_BYTES) {
      throw new Error(`The ZIP expands beyond the ${MAX_BACKUP_BYTES / 1_000_000} MB import limit.`)
    }
  }

  const manifestFile = zip.file('manifest.json')
  if (!manifestFile) throw new Error('This ZIP is missing its backup manifest.')
  let manifest
  try {
    manifest = JSON.parse(await manifestFile.async('string'))
  } catch {
    throw new Error('The ZIP backup manifest is invalid.')
  }
  if (manifest?.version !== BACKUP_VERSION || ![BACKUP_FORMAT, POSTS_FORMAT].includes(manifest.format)) {
    throw new Error('This ZIP is not a supported Omaara backup.')
  }

  const snapshot = { articles: [], posts: [], highlights: [], state: null }
  const itemFiles = Object.values(zip.files).filter((entry) => !entry.dir
    && /^(articles|posts|highlights)\/.*\.json$/i.test(entry.name))
  for (const entry of itemFiles) {
    let record
    try {
      record = JSON.parse(await entry.async('string'))
    } catch {
      throw new Error(`The ZIP contains invalid JSON: ${entry.name}`)
    }
    if (!validIdRecord(record)) throw new Error(`The ZIP contains an item without a valid ID: ${entry.name}`)
    if (entry.name.startsWith('articles/')) snapshot.articles.push(record)
    else if (entry.name.startsWith('posts/')) snapshot.posts.push(record)
    else snapshot.highlights.push(record)
  }

  const stateFile = zip.file(STATE_FILENAME)
  if (stateFile) {
    try {
      snapshot.state = JSON.parse(await stateFile.async('string'))
    } catch {
      throw new Error('The ZIP app settings file is invalid.')
    }
    if (!snapshot.state || typeof snapshot.state !== 'object') {
      throw new Error('The ZIP app settings file is invalid.')
    }
  }
  if (manifest.format === BACKUP_FORMAT && !snapshot.state) {
    throw new Error('This backup ZIP is missing its app settings file.')
  }
  return snapshot
}

export function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error(`Could not read ${file.name}.`))
        return
      }
      resolve(reader.result.replace(/^\uFEFF/, ''))
    }
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`))
    reader.readAsText(file)
  })
}

export function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error(`Could not read ${file.name}.`))
        return
      }
      resolve(reader.result)
    }
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`))
    reader.readAsDataURL(file)
  })
}
