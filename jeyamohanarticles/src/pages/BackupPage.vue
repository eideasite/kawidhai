<script setup>
import { computed, onMounted, ref } from 'vue'
import { Download, FolderUp, RefreshCw, ShieldAlert } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useWorkspace } from '../stores/workspace.js'
import { estimateBrowserStorage } from '../services/browserStorage.js'
import {
  collectBackupSnapshot,
  downloadFullBackup,
  downloadPostsArchive,
  MAX_IMPORTED_FILE_BYTES,
  readBackupArchive,
  readImageFile,
  readTextFile,
} from '../services/backupService.js'
import { formatDate } from '../utils/formatDate.js'
import { translate } from '../i18n.js'

const router = useRouter()
const { posts, createPost, mergeBackupSnapshot, language } = useWorkspace()
const t = (text) => translate(text, language.value)
const fileInput = ref(null)
const selectedPostIds = ref([])
const busy = ref(false)
const statusMessage = ref('')
const errorMessage = ref('')
const storage = ref({ status: 'loading', usage: 0, quota: 0 })
const sortedPosts = computed(() => [...posts.value].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)))
const selectedPosts = computed(() => sortedPosts.value.filter((post) => selectedPostIds.value.includes(post.id)))
const storageRatio = computed(() => storage.value.quota
  ? Math.min(1, storage.value.usage / storage.value.quota)
  : 0)
const storageIsNearlyFull = computed(() => storageRatio.value >= 0.85)

function formatBytes(bytes) {
  const megabytes = bytes / (1024 * 1024)
  return megabytes >= 1024 ? `${(megabytes / 1024).toFixed(2)} GB` : `${megabytes.toFixed(0)} MB`
}

async function refreshStorage() {
  storage.value = { ...storage.value, status: 'loading' }
  try {
    const estimate = await estimateBrowserStorage()
    storage.value = { status: 'ready', ...estimate }
  } catch {
    storage.value = { status: 'unavailable', usage: 0, quota: 0 }
  }
}

onMounted(refreshStorage)

function setError(error) {
  errorMessage.value = error instanceof Error ? error.message : String(error)
  statusMessage.value = ''
}

async function downloadBackup() {
  if (busy.value) return
  busy.value = true
  statusMessage.value = ''
  errorMessage.value = ''
  try {
    const snapshot = await collectBackupSnapshot()
    let total = 0
    await downloadFullBackup(snapshot, (part, parts) => {
      total = parts
      statusMessage.value = t('Preparing backup ZIP {part} of {total}...')
        .replace('{part}', String(part))
        .replace('{total}', String(parts))
    })
    statusMessage.value = t('Backup download started: {count} ZIP file(s).').replace('{count}', String(total))
  } catch (error) {
    setError(error)
  } finally {
    busy.value = false
  }
}

async function downloadSelected() {
  if (busy.value || !selectedPosts.value.length) return
  busy.value = true
  statusMessage.value = ''
  errorMessage.value = ''
  try {
    let total = 0
    await downloadPostsArchive(selectedPosts.value, (_part, parts) => {
      total = parts
    })
    statusMessage.value = t('Selected posts download started: {count} ZIP file(s).').replace('{count}', String(total))
  } catch (error) {
    setError(error)
  } finally {
    busy.value = false
  }
}

function togglePost(id) {
  selectedPostIds.value = selectedPostIds.value.includes(id)
    ? selectedPostIds.value.filter((selectedId) => selectedId !== id)
    : [...selectedPostIds.value, id]
}

function toggleAllPosts() {
  selectedPostIds.value = selectedPostIds.value.length === sortedPosts.value.length
    ? []
    : sortedPosts.value.map((post) => post.id)
}

async function importFiles(event) {
  const files = Array.from(event.target.files || [])
  event.target.value = ''
  if (!files.length || busy.value) return
  busy.value = true
  statusMessage.value = ''
  errorMessage.value = ''
  let importedArticles = 0
  let importedPosts = 0
  let importedHighlights = 0
  let processed = 0
  try {
    for (const file of files) {
      const lowerName = file.name.toLowerCase()
      if (lowerName.endsWith('.zip')) {
        const snapshot = await readBackupArchive(file)
        const result = await mergeBackupSnapshot(snapshot)
        importedArticles += result.articles
        importedPosts += result.posts
        importedHighlights += result.highlights
      } else if (lowerName.endsWith('.txt')) {
        if (file.size > MAX_IMPORTED_FILE_BYTES) {
          throw new Error(t('Text and image files must be 4 MB or smaller: {name}.').replace('{name}', file.name))
        }
        const text = await readTextFile(file)
        if (!text.trim()) throw new Error(t('The selected text file is empty: {name}.').replace('{name}', file.name))
        const saved = await createPost({ text })
        if (!saved) throw new Error(t('Could not save imported file: {name}.').replace('{name}', file.name))
        importedPosts += 1
      } else if (['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type)) {
        if (file.size > MAX_IMPORTED_FILE_BYTES) {
          throw new Error(t('Text and image files must be 4 MB or smaller: {name}.').replace('{name}', file.name))
        }
        const image = await readImageFile(file)
        const saved = await createPost({ text: '', image: { src: image, name: file.name } })
        if (!saved) throw new Error(t('Could not save imported file: {name}.').replace('{name}', file.name))
        importedPosts += 1
      } else {
        throw new Error(t('Unsupported file type: {name}. Choose an Omaara ZIP, TXT, or PNG/JPEG/GIF/WebP image.')
          .replace('{name}', file.name))
      }
      processed += 1
    }
    statusMessage.value = t('Import complete: {articles} articles, {posts} posts, {highlights} highlights from {files} file(s).')
      .replace('{articles}', String(importedArticles))
      .replace('{posts}', String(importedPosts))
      .replace('{highlights}', String(importedHighlights))
      .replace('{files}', String(processed))
    await refreshStorage()
  } catch (error) {
    setError(error)
    if (processed) {
      errorMessage.value += ` ${t('Earlier files were already imported; retrying a ZIP skips duplicate IDs.')}`
    }
  } finally {
    busy.value = false
  }
}

function goHome() {
  router.push({ name: 'compose' })
}
</script>

<template>
  <div class="page-wrap backup-page">
    <header class="backup-page-header">
      <div>
        <p class="eyebrow">
          {{ t('Local-only storage') }}
        </p>
        <h1>{{ t('Backup and restore') }}</h1>
        <p>{{ t('Download writing from this browser, then upload the ZIP to Google Drive yourself. No server or Drive account is connected.') }}</p>
      </div>
    </header>

    <section class="surface-card backup-storage-card">
      <div class="backup-storage-heading">
        <div>
          <h2>{{ t('Browser storage') }}</h2>
          <p>{{ t('The browser controls storage capacity. Keep a ZIP backup before it gets close to full.') }}</p>
        </div>
        <button
          class="button button-secondary"
          type="button"
          :disabled="busy"
          @click="refreshStorage"
        >
          <RefreshCw :size="16" />{{ t('Refresh estimate') }}
        </button>
      </div>
      <div
        v-if="storage.status === 'ready'"
        class="backup-storage-meter"
      >
        <div class="backup-storage-meter-labels">
          <span>{{ t('Used') }}: {{ formatBytes(storage.usage) }}</span>
          <span>{{ t('Estimated quota') }}: {{ formatBytes(storage.quota) }}</span>
        </div>
        <progress
          :value="storage.usage"
          :max="storage.quota"
          :aria-label="t('Browser storage used')"
        />
        <p
          v-if="storageIsNearlyFull"
          class="backup-warning"
          role="status"
        >
          <ShieldAlert :size="17" />{{ t('Storage is nearly full. Download a backup ZIP and save it outside this device.') }}
        </p>
      </div>
      <p
        v-else
        class="backup-storage-note"
      >
        {{ t(storage.status === 'loading' ? 'Checking...' : 'This browser does not provide a storage estimate.') }}
      </p>
    </section>

    <section class="surface-card backup-actions-card">
      <div>
        <h2>{{ t('Full app backup') }}</h2>
        <p>{{ t('Includes articles, posts and images, highlights, bookmarks, drafts, and saved preferences. ZIP files are organized into date folders and kept under 387 MB each.') }}</p>
        <p class="backup-storage-note">
          {{ t('Restore merges new IDs and keeps existing content; duplicate items and existing preferences are not overwritten.') }}
        </p>
      </div>
      <div class="backup-action-buttons">
        <button
          class="button button-secondary"
          type="button"
          :disabled="busy"
          @click="fileInput?.click()"
        >
          <FolderUp :size="17" />{{ t('Import ZIP, TXT, or images') }}
        </button>
        <button
          class="button button-primary"
          type="button"
          :disabled="busy"
          @click="downloadBackup"
        >
          <Download :size="17" />{{ t('Download full backup') }}
        </button>
      </div>
      <input
        ref="fileInput"
        class="visually-hidden"
        type="file"
        accept=".zip,.txt,image/png,image/jpeg,image/gif,image/webp"
        multiple
        @change="importFiles"
      >
    </section>

    <section class="backup-rack-section">
      <div class="backup-rack-heading">
        <div>
          <h2>{{ t('Post backup rack') }} <span class="count-badge">{{ sortedPosts.length }}</span></h2>
          <p>{{ t('Select multiple posts to download as a date-organized ZIP. Imported TXT and image files appear on Home as posts.') }}</p>
        </div>
        <div class="backup-action-buttons">
          <button
            class="text-button"
            type="button"
            :disabled="busy || !sortedPosts.length"
            @click="toggleAllPosts"
          >
            {{ t(selectedPostIds.length === sortedPosts.length ? 'Clear selection' : 'Select all') }}
          </button>
          <button
            class="button button-primary"
            type="button"
            :disabled="busy || !selectedPosts.length"
            @click="downloadSelected"
          >
            <Download :size="17" />{{ t('Download selected ({count})').replace('{count}', String(selectedPosts.length)) }}
          </button>
        </div>
      </div>
      <p
        v-if="!sortedPosts.length"
        class="empty-state surface-card"
      >
        {{ t('No local posts yet. Imported files and new posts will appear here.') }}
      </p>
      <div
        v-else
        class="backup-post-rack"
      >
        <label
          v-for="post in sortedPosts"
          :key="post.id"
          class="surface-card backup-post-item"
        >
          <input
            type="checkbox"
            :checked="selectedPostIds.includes(post.id)"
            @change="togglePost(post.id)"
          >
          <span class="backup-post-item-body">
            <strong>{{ post.image?.name || post.text.slice(0, 100) || t('Image post') }}</strong>
            <small>{{ formatDate(post.createdAt, { dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' }, language === 'ta' ? 'ta-IN' : 'en-GB') }}</small>
            <span
              v-if="post.image?.src"
              class="backup-post-image-label"
            >{{ t('Includes image') }}</span>
          </span>
        </label>
      </div>
    </section>

    <p
      v-if="errorMessage"
      class="backup-status backup-error"
      role="alert"
    >
      {{ errorMessage }}
    </p>
    <p
      v-else-if="statusMessage"
      class="backup-status"
      role="status"
    >
      {{ statusMessage }}
    </p>
    <button
      class="text-button backup-home-button"
      type="button"
      @click="goHome"
    >
      {{ t('Open Home') }}
    </button>
  </div>
</template>
