<script setup>
/* eslint-disable vue/no-v-html -- Rich article content is sanitized before rendering. */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Archive,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  ExternalLink,
  FilePlus2,
  House,
  ImagePlus,
  Mic,
  Pin,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-vue-next'
import { useWorkspace } from '../stores/workspace.js'
import { articleCanPublish } from '../utils/validation.js'
import { createArticleHighlight, createHighlightCollection } from '../services/highlightStorage.js'
import { formatDate } from '../utils/formatDate.js'
import { getArticleExcerpt, getArticleTitle, getWordCount } from '../utils/article.js'
import { richTextToHtml, richTextToPlainText, sanitizeRichTextHtml } from '../utils/richText.js'
import { publishLocally, scheduleLocally } from '../services/publishingService.js'
import { makeSafeFilename } from '../utils/article.js'
import { translate } from '../i18n.js'
import HomeHighlightsSection from '../components/home/HomeHighlightsSection.vue'
import ProfileAvatar from '../components/common/ProfileAvatar.vue'

const route = useRoute()
const router = useRouter()
const {
  workspace,
  posts,
  highlights,
  bookmarkedIds,
  shortcutIds,
  language,
  theme,
  updateArticle,
  createNewArticle,
  discardArticle,
  createPost,
  toggleBookmark,
  toggleShortcut,
  saveHighlightCollections,
  setSessionStatus,
} = useWorkspace()

const postText = ref('')
const postImage = ref(null)
const postSaving = ref(false)
const imageInput = ref(null)
const recognition = ref(null)
const dictating = ref(false)
const editorElement = ref(null)
const articleFilter = ref('all')
const dialog = ref(null)
const scheduledAt = ref('')
const showAllPosts = ref(false)
const highlightText = ref('')
const selectedCollectionId = ref('')
const profileForm = ref({ ...workspace.value.profile })
const externalAiPrompt = ref('')
const externalAiPromptStorageError = ref(false)
const avatarOptions = ['✍️', '🙂', '😊', '🌿', '📚', '✨', '🖋️']
const accessibility = ref({ fontScale: 1, boldText: false, outlineText: false })
const message = ref('')
const messageTimer = ref()
const externalAiPromptStorageKey = 'jeyamohan-external-ai-prompt-v1'
const externalAiProviders = [
  { name: 'Google Gemini', url: 'https://gemini.google.com/' },
  { name: 'ChatGPT', url: 'https://chatgpt.com/' },
  { name: 'Meta AI', url: 'https://www.meta.ai/' },
]

try {
  const savedAccessibility = JSON.parse(localStorage.getItem('jeyamohan-accessibility-settings-v1') || 'null')
  if (savedAccessibility && typeof savedAccessibility === 'object') {
    accessibility.value = {
      fontScale: Number.isFinite(savedAccessibility.fontScale) ? Math.min(1.3, Math.max(0.9, savedAccessibility.fontScale)) : 1,
      boldText: savedAccessibility.boldText === true,
      outlineText: savedAccessibility.outlineText === true,
    }
  }
} catch {
  accessibility.value = { fontScale: 1, boldText: false, outlineText: false }
}

const page = computed(() => String(route.name || 'not-found'))
const currentArticle = computed(() => {
  const requestedId = typeof route.query.article === 'string' ? route.query.article : ''
  return workspace.value.articles.find((article) => article.id === requestedId)
    || workspace.value.articles[0]
    || null
})
const activeArticles = computed(() => workspace.value.articles.filter((article) => !article.archived))
const archivedArticles = computed(() => workspace.value.articles.filter((article) => article.archived))
const sortedPosts = computed(() => [...posts.value].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)))
const numberedPosts = computed(() => {
  const counts = new Map()
  return [...sortedPosts.value].reverse().map((post) => {
    const date = new Date(post.createdAt)
    const day = Number.isNaN(date.getTime()) ? `invalid-${post.id}` : `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    const postNumber = (counts.get(day) || 0) + 1
    counts.set(day, postNumber)
    return { post, postNumber }
  }).reverse()
})
const visiblePosts = computed(() => showAllPosts.value ? numberedPosts.value : numberedPosts.value.slice(0, 3))
const shortcutArticles = computed(() => shortcutIds.value
  .map((id) => workspace.value.articles.find((article) => article.id === id))
  .filter((article) => article && !article.archived))
const visibleArticles = computed(() => {
  const source = page.value === 'archive' ? archivedArticles.value : activeArticles.value
  const saved = page.value === 'bookmarks' ? source.filter((article) => bookmarkedIds.value.includes(article.id)) : source
  if (page.value !== 'articles' || articleFilter.value === 'all') return saved
  return saved.filter((article) => article.status === articleFilter.value)
})
const articleBodyText = computed(() => getArticleExcerpt(currentArticle.value?.body || '', 240))
const wordCount = computed(() => getWordCount(currentArticle.value?.body || ''))
const dateLocale = computed(() => language.value === 'ta' ? 'ta-IN' : 'en-GB')
const t = (text) => translate(text, language.value)
const profileName = computed(() => workspace.value.profile.name || 'Jeyamohan')
const composerPlaceholder = computed(() => t("What's on your mind, {name}?").replace('{name}', profileName.value))
const formattedBody = computed(() => richTextToHtml(currentArticle.value?.body || ''))
const selectedArticle = computed(() => workspace.value.articles.find((article) => article.id === dialog.value?.articleId) || currentArticle.value)
const highlightedCollection = computed(() => highlights.value.find((item) => item.id === selectedCollectionId.value))

watch(accessibility, (settings) => {
  document.documentElement.style.setProperty('--app-font-scale', String(settings.fontScale))
  document.documentElement.classList.toggle('accessibility-bold', settings.boldText)
  document.documentElement.classList.toggle('accessibility-outline', settings.outlineText)
  try {
    localStorage.setItem('jeyamohan-accessibility-settings-v1', JSON.stringify(settings))
  } catch {
    showMessage('Accessibility settings could not be saved in this browser.')
  }
}, { deep: true, immediate: true })

function showMessage(text) {
  message.value = text
  window.clearTimeout(messageTimer.value)
  messageTimer.value = window.setTimeout(() => { message.value = '' }, 3500)
}

try {
  externalAiPrompt.value = localStorage.getItem(externalAiPromptStorageKey) || ''
} catch {
  externalAiPromptStorageError.value = true
}

watch(externalAiPrompt, (prompt) => {
  try {
    localStorage.setItem(externalAiPromptStorageKey, prompt)
    externalAiPromptStorageError.value = false
  } catch {
    externalAiPromptStorageError.value = true
  }
})

function handleExternalAiPromptKeydown(event) {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing || !externalAiPrompt.value.trim()) return
  event.preventDefault()
  openExternalAiTools(externalAiProviders)
}

function copyTextToClipboard(text) {
  try {
    if (!navigator.clipboard?.writeText) return Promise.reject(new Error('Clipboard access is unavailable.'))
    return navigator.clipboard.writeText(text)
  } catch (error) {
    return Promise.reject(error)
  }
}

async function copyPost(post) {
  if (!post.text) {
    showMessage(t('This post has no text to copy.'))
    return
  }
  try {
    await copyTextToClipboard(post.text)
    showMessage(t('Post copied. Paste it wherever you need.'))
  } catch {
    showMessage(t('Could not copy the post. Select and copy the text instead.'))
  }
}

function copyExternalAiPrompt() {
  const prompt = externalAiPrompt.value.trim()
  if (!prompt) {
    showMessage('Enter a prompt to continue.')
    return
  }
  copyTextToClipboard(prompt)
    .then(() => showMessage('Prompt copied. Paste it into an AI service when you are ready.'))
    .catch(() => showMessage('Could not copy the prompt. It remains saved here; select it and copy it manually.'))
}

function openExternalAiTools(providers) {
  const prompt = externalAiPrompt.value.trim()
  if (!prompt) {
    showMessage('Enter a prompt to continue.')
    return
  }

  let openFailed = false
  for (const provider of providers) {
    try {
      window.open(provider.url, '_blank', 'noopener,noreferrer')
    } catch {
      openFailed = true
    }
  }

  const copiedMessage = providers.length === 1
    ? 'Prompt copied. Paste it into the AI tab, then send it there.'
    : 'Prompt copied. Paste it into each AI tab, then send it there.'
  copyTextToClipboard(prompt)
    .then(() => showMessage(openFailed ? 'Could not open an AI tab. Allow pop-ups and try again.' : copiedMessage))
    .catch(() => showMessage('Could not copy the prompt. It remains saved here; select it and copy it manually.'))
}

function go(name, articleId) {
  router.push({ name, ...(articleId ? { query: { article: articleId } } : {}) })
}

function openArticle(article) {
  if (article?.id) go('editor', article.id)
}

function addArticle() {
  const article = createNewArticle()
  go('editor', article.id)
}

function openDialog(type, article = currentArticle.value) {
  dialog.value = { type, articleId: article?.id || null }
  if (type === 'schedule') {
    const tomorrow = new Date(Date.now() + 60 * 60 * 1000)
    tomorrow.setMinutes(tomorrow.getMinutes() - tomorrow.getTimezoneOffset())
    scheduledAt.value = tomorrow.toISOString().slice(0, 16)
  }
}

function closeDialog() {
  dialog.value = null
}

function updateProfile() {
  const name = profileForm.value.name.trim()
  if (!name) {
    showMessage('Enter a profile name before saving.')
    return
  }
  workspace.value.profile = { ...profileForm.value, name }
  showMessage('Profile saved in this browser.')
  go('editor')
}

function handlePostImage(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
    showMessage('Choose a PNG, JPEG, GIF, or WebP image up to 4 MB.')
    return
  }
  const reader = new FileReader()
  reader.onload = () => { postImage.value = { src: String(reader.result), name: file.name } }
  reader.onerror = () => showMessage('Could not read that image.')
  reader.readAsDataURL(file)
}

async function submitPost() {
  if (postSaving.value || (!postText.value.trim() && !postImage.value)) return
  const submittedText = postText.value
  const submittedImage = postImage.value
  const savedOffline = !navigator.onLine
  postSaving.value = true
  try {
    if (!await createPost({
      text: submittedText,
      image: submittedImage,
      syncStatus: savedOffline ? 'pending' : 'local-only',
    })) {
      showMessage('Could not save this post in this browser.')
      return
    }
    if (postText.value === submittedText) postText.value = ''
    if (postImage.value === submittedImage) postImage.value = null
    showMessage(savedOffline ? 'Post saved offline. Sync is pending until an upload service is connected.' : 'Post saved in this browser.')
  } finally {
    postSaving.value = false
  }
}

function toggleDictation() {
  if (dictating.value) {
    recognition.value?.stop()
    return
  }
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SpeechRecognition) {
    showMessage('Voice dictation is not supported by this browser.')
    return
  }
  try {
    const activeRecognition = new SpeechRecognition()
    activeRecognition.lang = language.value === 'ta' ? 'ta-IN' : (navigator.language || 'en-US')
    activeRecognition.continuous = true
    activeRecognition.interimResults = false
    activeRecognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .slice(event.resultIndex)
        .filter((result) => result.isFinal)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim()
      if (transcript) postText.value = `${postText.value}${postText.value && !/\s$/.test(postText.value) ? ' ' : ''}${transcript}`
    }
    activeRecognition.onerror = (event) => {
      dictating.value = false
      if (event.error !== 'aborted') showMessage(event.error === 'not-allowed' ? 'Allow microphone access in your browser to dictate.' : `Voice dictation stopped: ${event.error || 'unknown error'}`)
    }
    activeRecognition.onend = () => { dictating.value = false }
    recognition.value = activeRecognition
    dictating.value = true
    activeRecognition.start()
  } catch (error) {
    dictating.value = false
    showMessage(error?.message || 'Could not start voice dictation.')
  }
}

function changePost(articleId, action) {
  const article = workspace.value.articles.find((item) => item.id === articleId)
  if (!article) return
  if (action === 'archive' || action === 'restore') {
    updateArticle(articleId, { archived: action === 'archive', archivedAt: action === 'archive' ? new Date().toISOString() : null })
    showMessage(action === 'archive' ? 'Article moved to Archive.' : 'Article restored.')
    return
  }
  if (action === 'discard') openDialog('discard', article)
  if (action === 'publish') openDialog('publish', article)
  if (action === 'schedule') openDialog('schedule', article)
}

function togglePin(article) {
  const pinned = workspace.value.articles.filter((item) => item.pinned === true)
  if (article.pinned) {
    updateArticle(article.id, { pinned: false })
    return
  }
  if (pinned.length >= 3) {
    showMessage('Unpin an article before pinning another. You can pin up to three.')
    return
  }
  updateArticle(article.id, { pinned: true })
}

function commitBody(event) {
  if (currentArticle.value) updateArticle(currentArticle.value.id, { body: sanitizeRichTextHtml(event.currentTarget.innerHTML) })
}

function applyFormat(command, value = null) {
  editorElement.value?.focus()
  document.execCommand(command, false, value)
  if (editorElement.value && currentArticle.value) {
    updateArticle(currentArticle.value.id, { body: sanitizeRichTextHtml(editorElement.value.innerHTML) })
  }
}

function saveHighlight() {
  const text = highlightText.value.trim()
  if (!text || !currentArticle.value) return
  const collection = highlightedCollection.value
  if (!collection) {
    showMessage('Choose a Highlight Collection.')
    return
  }
  if ((collection.articleHighlights || []).some((item) => item.articleId === currentArticle.value.id && item.text === text)) {
    showMessage('This text is already saved in that collection.')
    return
  }
  const entry = createArticleHighlight({
    articleId: currentArticle.value.id,
    articleTitle: getArticleTitle(currentArticle.value),
    text,
    selectedText: false,
  })
  const next = highlights.value.map((item) => item.id === collection.id
    ? { ...item, articleHighlights: [...(item.articleHighlights || []), entry], updatedAt: new Date().toISOString() }
    : item)
  if (saveHighlightCollections(next)) {
    highlightText.value = ''
    showMessage('Highlight saved.')
  }
}

function addHighlightCollection() {
  const collection = createHighlightCollection()
  collection.title = `Highlights ${highlights.value.length + 1}`
  if (saveHighlightCollections([...highlights.value, collection])) selectedCollectionId.value = collection.id
}

function updateHighlightTitle(collectionId, title) {
  const normalizedTitle = title.trim()
  if (!normalizedTitle) return false
  const next = highlights.value.map((item) => item.id === collectionId ? { ...item, title: normalizedTitle, updatedAt: new Date().toISOString() } : item)
  saveHighlightCollections(next)
}

function resolveDialog() {
  const target = selectedArticle.value
  if (!target || !dialog.value) return
  if (dialog.value.type === 'discard') {
    discardArticle(target.id)
    closeDialog()
    go('articles')
    showMessage('Draft discarded.')
    return
  }
  if (dialog.value.type === 'publish') {
    if (!articleCanPublish(target)) {
      showMessage('A title and body are required to publish.')
      return
    }
    updateArticle(target.id, publishLocally())
    closeDialog()
    go('published', target.id)
    showMessage('Post saved as published in this browser.')
    return
  }
  if (dialog.value.type === 'schedule') {
    const selectedTime = new Date(scheduledAt.value)
    if (!articleCanPublish(target) || !Number.isFinite(selectedTime.getTime()) || selectedTime <= new Date()) {
      showMessage('Choose a title, body, and a future date and time.')
      return
    }
    updateArticle(target.id, scheduleLocally(selectedTime.toISOString()))
    closeDialog()
    showMessage('The schedule was saved in this browser only.')
  }
}

async function copyArticle(article) {
  const text = `${getArticleTitle(article)}\n\n${richTextToPlainText(article.body || '')}`
  try {
    await navigator.clipboard.writeText(text)
    showMessage('Article text copied.')
  } catch {
    showMessage('Could not copy the article. Select and copy the text instead.')
  }
}

function downloadArticle(article) {
  const blob = new Blob([`${getArticleTitle(article)}\n\n${richTextToPlainText(article.body || '')}`], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${makeSafeFilename(article.title)}.txt`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function printArticle(article) {
  const originalTitle = document.title
  document.title = makeSafeFilename(article.title || getArticleTitle(article))
  const restoreTitle = () => {
    document.title = originalTitle
    window.clearTimeout(restoreTimer)
  }
  const restoreTimer = window.setTimeout(restoreTitle, 120000)
  window.addEventListener('afterprint', restoreTitle, { once: true })
  window.print()
}

function speakSample() {
  if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
    showMessage('Text-to-speech is not supported by this browser.')
    return
  }
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance('This is a sample of text to speech.')
  utterance.lang = language.value === 'ta' ? 'ta-IN' : 'en-US'
  window.speechSynthesis.speak(utterance)
}

function articleDate(article) {
  return formatDate(article.updatedAt, { dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' }, dateLocale.value)
}

watch(() => currentArticle.value?.id, async () => {
  await nextTick()
  if (editorElement.value) editorElement.value.innerHTML = richTextToHtml(currentArticle.value?.body || '')
}, { immediate: true })

watch(() => workspace.value.profile, (value) => {
  profileForm.value = { ...value }
}, { deep: true })

onMounted(() => {
  if (!selectedCollectionId.value && highlights.value.length) selectedCollectionId.value = highlights.value[0].id
})

onBeforeUnmount(() => {
  window.clearTimeout(messageTimer.value)
  recognition.value?.stop()
})
</script>

<template>
  <div
    v-if="page === 'compose'"
    class="page-wrap home-page"
  >
    <section class="home-profile-card surface-card">
      <button
        class="home-profile-trigger"
        type="button"
        @click="go('profile')"
      >
        <ProfileAvatar :profile="workspace.profile" />
        <span class="home-profile-copy"><strong>{{ profileName }}</strong><small>Profile account</small></span>
        <ChevronRight :size="18" />
      </button>
    </section>

    <section
      class="composer-card surface-card"
      aria-labelledby="create-post-title"
    >
      <div class="section-title-row">
        <h1 id="create-post-title">
          {{ t('Create post') }}
        </h1><span class="local-badge">{{ t('Saved in this browser') }}</span>
      </div>
      <textarea
        v-model="postText"
        rows="3"
        :placeholder="composerPlaceholder"
        :aria-label="t('Write your post')"
      />
      <div
        v-if="postImage"
        class="selected-image"
      >
        <img
          :src="postImage.src"
          :alt="postImage.name || 'Post image'"
        >
        <button
          class="icon-button"
          type="button"
          aria-label="Remove image"
          @click="postImage = null"
        >
          <X :size="16" />
        </button>
      </div>
      <div class="composer-actions">
        <button
          class="text-button"
          type="button"
          @click="imageInput?.click()"
        >
          <ImagePlus :size="17" /> {{ t('Photo') }}
        </button>
        <button
          class="text-button"
          type="button"
          @click="addArticle"
        >
          <FilePlus2 :size="17" /> {{ t('Write article') }}
        </button>
        <button
          class="text-button"
          type="button"
          :aria-pressed="dictating"
          @click="toggleDictation"
        >
          <Mic :size="17" /> {{ dictating ? 'Stop dictation' : 'Voice dictation' }}
        </button>
        <button
          class="button button-primary"
          type="button"
          :disabled="postSaving || (!postText.trim() && !postImage)"
          @click="submitPost"
        >
          <Send :size="16" /> {{ t(postSaving ? 'Saving post...' : 'Post') }}
        </button>
        <input
          ref="imageInput"
          class="visually-hidden"
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          @change="handlePostImage"
        >
      </div>
    </section>

    <section class="content-section home-posts-section">
      <div class="section-title-row">
        <h2>{{ t('Recent Posts') }} <span class="count-badge">{{ sortedPosts.length }}</span></h2>
        <button
          v-if="numberedPosts.length > 3"
          class="text-button"
          type="button"
          @click="showAllPosts = !showAllPosts"
        >
          {{ t(showAllPosts ? 'Show Less' : 'See More') }}
        </button>
      </div>
      <p
        v-if="!sortedPosts.length"
        class="empty-state"
      >
        No posts yet. Write something to get started.
      </p>
      <article
        v-for="{ post, postNumber } in visiblePosts"
        :key="post.id"
        class="post-card surface-card"
      >
        <div class="post-card-header">
          <div class="post-author">
            <ProfileAvatar
              :profile="workspace.profile"
              size="small"
            />
            <div><strong>{{ profileName }}</strong><small>{{ formatDate(post.createdAt, { dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' }, dateLocale) }} · {{ t(post.syncStatus === 'pending' ? 'Sync pending' : 'Local post') }} <span class="home-post-number-chip">{{ postNumber }}</span></small></div>
          </div>
          <button
            class="icon-button post-copy-button"
            type="button"
            :aria-label="t('Copy post')"
            :title="t('Copy post')"
            @click="copyPost(post)"
          >
            <Copy :size="17" />
          </button>
        </div>
        <p
          v-if="post.text"
          class="post-copy"
        >
          {{ post.text }}
        </p>
        <img
          v-if="post.image?.src"
          class="post-image"
          :src="post.image.src"
          :alt="post.image.name || 'Post image'"
        >
      </article>
    </section>

    <HomeHighlightsSection
      class="mobile-priority-highlights"
      :collections="highlights"
      :articles="workspace.articles"
      :language="language"
      @add-collection="addHighlightCollection"
      @update-title="updateHighlightTitle"
      @open-article="openArticle"
    />

    <section class="content-section home-articles-section">
      <div class="section-title-row">
        <h2>{{ t('Articles') }}</h2><button
          class="text-button"
          type="button"
          @click="go('articles')"
        >
          {{ t('See More') }} <ChevronRight :size="16" />
        </button>
      </div>
      <article
        v-for="article in activeArticles.slice(0, 4)"
        :key="article.id"
        class="article-row surface-card"
      >
        <button
          class="article-row-main"
          type="button"
          @click="openArticle(article)"
        >
          <strong>{{ getArticleTitle(article) }}</strong>
          <small>{{ article.status }} · {{ getArticleExcerpt(article.body) || 'No article text yet.' }}</small>
        </button>
        <div class="article-row-actions">
          <button
            class="icon-button"
            type="button"
            :aria-label="bookmarkedIds.includes(article.id) ? 'Remove bookmark' : 'Bookmark article'"
            @click="toggleBookmark(article.id)"
          >
            <Bookmark
              :size="17"
              :fill="bookmarkedIds.includes(article.id) ? 'currentColor' : 'none'"
            />
          </button>
          <button
            class="icon-button"
            type="button"
            :aria-label="shortcutIds.includes(article.id) ? 'Remove from Home Shortcuts' : 'Add to Home Shortcuts'"
            @click="toggleShortcut(article.id)"
          >
            <House
              :size="17"
              :fill="shortcutIds.includes(article.id) ? 'currentColor' : 'none'"
            />
          </button>
          <button
            class="icon-button"
            type="button"
            :aria-label="article.pinned ? 'Unpin article' : 'Pin article'"
            @click="togglePin(article)"
          >
            <Pin
              :size="17"
              :fill="article.pinned ? 'currentColor' : 'none'"
            />
          </button>
          <button
            class="icon-button"
            type="button"
            aria-label="Archive article"
            @click="changePost(article.id, 'archive')"
          >
            <Archive :size="17" />
          </button>
        </div>
      </article>
      <p
        v-if="!activeArticles.length"
        class="empty-state"
      >
        No articles yet.
      </p>
    </section>

    <section class="content-section home-shortcuts-section">
      <div class="section-title-row">
        <h2>Home Shortcuts</h2>
      </div>
      <article
        v-for="article in shortcutArticles"
        :key="article.id"
        class="article-row surface-card"
      >
        <button
          class="article-row-main"
          type="button"
          @click="openArticle(article)"
        >
          <strong>{{ getArticleTitle(article) }}</strong><small>{{ getArticleExcerpt(article.body) || 'No article text yet.' }}</small>
        </button>
        <button
          class="icon-button"
          type="button"
          aria-label="Remove from Home Shortcuts"
          @click="toggleShortcut(article.id)"
        >
          <X :size="17" />
        </button>
      </article>
      <p
        v-if="!shortcutArticles.length"
        class="empty-state"
      >
        Add an article to Home Shortcuts from the Articles page.
      </p>
    </section>

    <HomeHighlightsSection
      class="desktop-priority-highlights"
      :collections="highlights"
      :articles="workspace.articles"
      :language="language"
      @add-collection="addHighlightCollection"
      @update-title="updateHighlightTitle"
      @open-article="openArticle"
    />
  </div>

  <div
    v-else-if="page === 'profile'"
    class="page-wrap narrow-page"
  >
    <div class="page-heading">
      <span class="eyebrow">{{ t('Writer profile') }}</span><h1>{{ t('Profile') }} &amp; Settings</h1><p>{{ t('Manage the name and introduction shown on your writing profile.') }}</p>
    </div>
    <section class="surface-card settings-card">
      <div class="settings-section-head">
        <ProfileAvatar
          :profile="profileForm"
          size="large"
        /><div><h2>{{ profileForm.name || 'Writer' }}</h2><p>Profile account</p></div>
      </div>
      <label class="field-label">{{ t('Your name') }}<input
        v-model="profileForm.name"
        autocomplete="name"
        maxlength="80"
      ></label>
      <label class="field-label">Profile avatar<select v-model="profileForm.avatar"><option
        v-for="avatar in avatarOptions"
        :key="avatar"
        :value="avatar"
      >{{ avatar }}</option></select></label>
      <label class="field-label">{{ t('Short introduction') }}<textarea
        v-model="profileForm.bio"
        rows="3"
        maxlength="500"
        :placeholder="t('A few lines about you')"
      /></label>
      <button
        class="button button-primary"
        type="button"
        @click="updateProfile"
      >
        {{ t('Save profile and continue to editor') }}
      </button>
    </section>
    <section class="surface-card settings-card">
      <h2>{{ t('Display') }} Settings</h2>
      <div class="setting-row">
        <div><strong>{{ t('Visibility') }}</strong><small>Private — articles stay in this browser.</small></div><span class="local-badge">Private</span>
      </div>
      <label class="setting-row"><span><strong>{{ t('Language') }}</strong><small>Choose the language for app labels.</small></span><select
        v-model="language"
        :aria-label="t('Choose language')"
      ><option value="en">English</option><option value="ta">தமிழ்</option></select></label>
      <div class="setting-row">
        <div><strong>Appearance</strong><small>Choose a light or dark workspace.</small></div><button
          class="button button-secondary"
          type="button"
          @click="theme = theme === 'dark' ? 'light' : 'dark'"
        >
          {{ theme === 'dark' ? 'Dark' : 'Light' }}
        </button>
      </div>
      <details class="additional-settings">
        <summary>Additional Settings</summary>
        <label class="setting-row"><span><strong>Font size</strong><small>Make text easier to read.</small></span><input
          v-model.number="accessibility.fontScale"
          type="range"
          min="0.9"
          max="1.3"
          step="0.1"
          aria-label="Font size"
        ></label>
        <label class="setting-checkbox"><input
          v-model="accessibility.boldText"
          type="checkbox"
        > Bold text</label>
        <label class="setting-checkbox"><input
          v-model="accessibility.outlineText"
          type="checkbox"
        > Outline text for contrast</label>
        <div class="setting-row">
          <span><strong>Text-to-speech</strong><small>Use a voice available in this browser.</small></span><button
            class="button button-secondary"
            type="button"
            @click="speakSample"
          >
            {{ t('Test text-to-speech') }}
          </button>
        </div>
        <p>Article drafts, posts, bookmarks, and profile settings are saved locally in this browser. Publishing and scheduling only update local status.</p>
      </details>
      <div class="session-actions">
        <button
          class="button button-secondary"
          type="button"
          @click="setSessionStatus('locked')"
        >
          Lock writing space
        </button>
        <button
          class="button button-secondary"
          type="button"
          @click="setSessionStatus('signed-out')"
        >
          Sign out locally
        </button>
      </div>
    </section>
  </div>

  <div
    v-else-if="page === 'editor'"
    class="page-wrap editor-page"
  >
    <div class="page-heading page-heading-row">
      <div><span class="eyebrow">{{ t('Writing workspace') }}</span><h1>{{ t('Article Editor') }}</h1><p>{{ t('Write and edit your article. Your draft is saved in this browser.') }}</p></div><button
        class="button button-secondary"
        type="button"
        @click="go('articles')"
      >
        {{ t('Manage') }} {{ t('Articles') }}
      </button>
    </div>
    <template v-if="currentArticle">
      <section class="surface-card editor-card">
        <div class="editor-status">
          <span class="local-badge">{{ t(currentArticle.status) }}</span><span>{{ wordCount }} {{ t('words') }} · {{ t('Updated:') }} {{ articleDate(currentArticle) }}</span>
        </div>
        <label
          class="visually-hidden"
          for="article-title"
        >{{ t('Article title') }}</label>
        <input
          id="article-title"
          class="article-title-input"
          :value="currentArticle.title"
          :placeholder="t('Write an article title...')"
          maxlength="200"
          @input="updateArticle(currentArticle.id, { title: $event.target.value })"
        >
        <div
          class="format-toolbar"
          :aria-label="t('Text formatting options')"
        >
          <button
            type="button"
            aria-label="Bold"
            @click="applyFormat('bold')"
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            aria-label="Italic"
            @click="applyFormat('italic')"
          >
            <em>I</em>
          </button>
          <button
            type="button"
            aria-label="Bulleted list"
            @click="applyFormat('insertUnorderedList')"
          >
            • List
          </button>
          <button
            type="button"
            aria-label="Numbered list"
            @click="applyFormat('insertOrderedList')"
          >
            1. List
          </button>
          <button
            type="button"
            aria-label="Quote"
            @click="applyFormat('formatBlock', 'blockquote')"
          >
            Quote
          </button>
        </div>
        <div
          ref="editorElement"
          class="article-body-editor"
          contenteditable="true"
          role="textbox"
          :aria-label="t('Article body')"
          aria-multiline="true"
          :data-placeholder="t('Start writing your article here...')"
          @input="commitBody"
        />
        <div class="editor-actions">
          <button
            class="button button-secondary"
            type="button"
            @click="openDialog('preview')"
          >
            Preview
          </button>
          <button
            class="button button-secondary"
            type="button"
            @click="go('seo', currentArticle.id)"
          >
            SEO settings
          </button>
          <button
            class="button button-secondary"
            type="button"
            @click="copyArticle(currentArticle)"
          >
            <Copy :size="16" /> Copy
          </button>
          <button
            class="button button-secondary"
            type="button"
            @click="downloadArticle(currentArticle)"
          >
            Download .txt
          </button>
          <button
            class="button button-secondary"
            type="button"
            @click="changePost(currentArticle.id, 'schedule')"
          >
            <Clock3 :size="16" /> Schedule
          </button>
          <button
            class="button button-primary"
            type="button"
            @click="changePost(currentArticle.id, 'publish')"
          >
            <Send :size="16" /> Publish locally
          </button>
        </div>
        <div class="highlight-tools">
          <h2>Save a highlight</h2>
          <div
            v-if="!highlights.length"
            class="highlight-new-row"
          >
            <button
              class="text-button"
              type="button"
              @click="addHighlightCollection"
            >
              <Plus :size="16" /> Create a collection
            </button>
          </div>
          <div
            v-else
            class="highlight-new-row"
          >
            <select
              v-model="selectedCollectionId"
              aria-label="Highlight collection"
            >
              <option
                v-for="collection in highlights"
                :key="collection.id"
                :value="collection.id"
              >
                {{ collection.title }}
              </option>
            </select>
            <input
              v-model="highlightText"
              placeholder="Paste text to save"
            >
            <button
              class="button button-secondary"
              type="button"
              :disabled="!highlightText.trim()"
              @click="saveHighlight"
            >
              Save
            </button>
            <button
              class="text-button"
              type="button"
              @click="addHighlightCollection"
            >
              <Plus :size="16" /> New collection
            </button>
          </div>
        </div>
      </section>
    </template>
    <section
      v-else
      class="surface-card empty-state"
    >
      <h2>No article is open</h2><button
        class="button button-primary"
        type="button"
        @click="addArticle"
      >
        Create new article
      </button>
    </section>
  </div>

  <div
    v-else-if="page === 'articles' || page === 'bookmarks' || page === 'archive'"
    class="page-wrap"
  >
    <div class="page-heading page-heading-row">
      <div><span class="eyebrow">Your writing</span><h1>{{ page === 'archive' ? 'Archive' : page === 'bookmarks' ? 'Bookmarks' : 'Articles' }}</h1><p>{{ page === 'archive' ? 'Restore articles or permanently discard a draft.' : page === 'bookmarks' ? 'Your saved articles.' : 'Manage drafts and locally published articles.' }}</p></div>
      <button
        v-if="page === 'articles'"
        class="button button-primary"
        type="button"
        @click="addArticle"
      >
        <FilePlus2 :size="16" /> New article
      </button>
    </div>
    <div
      v-if="page === 'articles'"
      class="filter-tabs"
      role="group"
      aria-label="Filter articles"
    >
      <button
        v-for="filter in ['all', 'draft', 'scheduled', 'published']"
        :key="filter"
        type="button"
        :class="{ selected: articleFilter === filter }"
        @click="articleFilter = filter"
      >
        {{ filter === 'all' ? 'All' : filter }}
      </button>
    </div>
    <div class="article-list">
      <article
        v-for="article in visibleArticles"
        :key="article.id"
        class="article-list-card surface-card"
      >
        <button
          class="article-list-main"
          type="button"
          @click="openArticle(article)"
        >
          <span class="article-list-title">{{ getArticleTitle(article) }}</span>
          <span class="article-list-excerpt">{{ getArticleExcerpt(article.body) || 'Article body has not been added yet.' }}</span>
          <span class="article-list-meta">{{ article.status }} · {{ articleDate(article) }}</span>
        </button>
        <div class="article-list-actions">
          <button
            class="icon-button"
            type="button"
            :aria-label="bookmarkedIds.includes(article.id) ? 'Remove bookmark' : 'Bookmark article'"
            @click="toggleBookmark(article.id)"
          >
            <Bookmark
              :size="17"
              :fill="bookmarkedIds.includes(article.id) ? 'currentColor' : 'none'"
            />
          </button>
          <button
            class="icon-button"
            type="button"
            :aria-label="shortcutIds.includes(article.id) ? 'Remove from Home Shortcuts' : 'Add to Home Shortcuts'"
            @click="toggleShortcut(article.id)"
          >
            <House
              :size="17"
              :fill="shortcutIds.includes(article.id) ? 'currentColor' : 'none'"
            />
          </button>
          <button
            v-if="page !== 'archive'"
            class="icon-button"
            type="button"
            :aria-label="article.pinned ? 'Unpin article' : 'Pin article'"
            @click="togglePin(article)"
          >
            <Pin
              :size="17"
              :fill="article.pinned ? 'currentColor' : 'none'"
            />
          </button>
          <button
            v-if="page === 'archive'"
            class="icon-button"
            type="button"
            aria-label="Restore article"
            @click="changePost(article.id, 'restore')"
          >
            <RotateCcw :size="17" />
          </button>
          <button
            v-else
            class="icon-button"
            type="button"
            aria-label="Archive article"
            @click="changePost(article.id, 'archive')"
          >
            <Archive :size="17" />
          </button>
          <button
            v-if="article.status === 'draft'"
            class="icon-button danger-icon"
            type="button"
            aria-label="Discard draft"
            @click="changePost(article.id, 'discard')"
          >
            <Trash2 :size="17" />
          </button>
        </div>
      </article>
      <p
        v-if="!visibleArticles.length"
        class="empty-state"
      >
        No articles in this category.
      </p>
    </div>
  </div>

  <div
    v-else-if="page === 'seo'"
    class="page-wrap narrow-page"
  >
    <div class="page-heading">
      <span class="eyebrow">Article settings</span><h1>SEO Settings</h1><p>This local preview is not sent to search engines.</p>
    </div>
    <section
      v-if="currentArticle"
      class="surface-card settings-card"
    >
      <label class="field-label">SEO title<input
        :value="currentArticle.seoTitle"
        maxlength="70"
        placeholder="Search title for this article"
        @input="updateArticle(currentArticle.id, { seoTitle: $event.target.value })"
      ></label>
      <label class="field-label">SEO description<textarea
        :value="currentArticle.seoDescription"
        maxlength="180"
        rows="3"
        placeholder="Short search description"
        @input="updateArticle(currentArticle.id, { seoDescription: $event.target.value })"
      /></label>
      <label class="field-label">URL slug<input
        :value="currentArticle.slug"
        maxlength="100"
        placeholder="article-url"
        @input="updateArticle(currentArticle.id, { slug: $event.target.value })"
      ></label>
      <div class="seo-preview">
        <small>Local search preview</small><strong>{{ currentArticle.seoTitle || getArticleTitle(currentArticle) }}</strong><span>{{ currentArticle.seoDescription || articleBodyText }}</span>
      </div>
      <button
        class="button button-primary"
        type="button"
        @click="go('editor', currentArticle.id)"
      >
        Back to editor
      </button>
    </section>
    <p
      v-else
      class="empty-state"
    >
      Create an article before editing SEO settings.
    </p>
  </div>

  <div
    v-else-if="page === 'published'"
    class="page-wrap narrow-page"
  >
    <div class="page-heading">
      <span class="eyebrow">Local status</span><h1>Published Post</h1><p>Publishing in this app only updates the status stored in this browser.</p>
    </div>
    <article
      v-if="currentArticle"
      class="surface-card published-card"
    >
      <span class="local-badge">{{ currentArticle.status }}</span>
      <h2>{{ getArticleTitle(currentArticle) }}</h2>
      <div
        class="rich-content"
        v-html="formattedBody"
      />
      <div class="editor-actions">
        <button
          class="button button-secondary"
          type="button"
          @click="openArticle(currentArticle)"
        >
          Edit
        </button><button
          class="button button-secondary"
          type="button"
          @click="copyArticle(currentArticle)"
        >
          Copy text
        </button><button
          class="button button-primary"
          type="button"
          @click="printArticle(currentArticle)"
        >
          Save as PDF
        </button>
      </div>
    </article>
    <p
      v-else
      class="empty-state"
    >
      No article is available.
    </p>
  </div>

  <div
    v-else-if="page === 'external-ai-tools'"
    class="page-wrap narrow-page external-ai-page"
  >
    <div class="page-heading">
      <span class="eyebrow">{{ t('External tools') }}</span>
      <h1>{{ t('External AI tools') }}</h1>
      <p>{{ t('Write one prompt, then open a provider or all three. Your prompt is saved in this browser and copied only when you choose an AI action.') }}</p>
    </div>
    <section
      class="surface-card external-ai-prompt-card"
      aria-labelledby="external-ai-prompt-heading"
    >
      <div class="external-ai-prompt-heading">
        <div>
          <h2 id="external-ai-prompt-heading">
            {{ t('Prompt canvas') }}
          </h2>
          <p>{{ t('Your posts and article drafts are never included. Paste the copied prompt into an AI service and send it there yourself.') }}</p>
        </div>
        <span
          class="external-ai-saved-state"
          :class="{ 'has-error': externalAiPromptStorageError }"
          aria-live="polite"
        >
          {{ externalAiPromptStorageError ? t('Prompt draft could not be saved in this browser.') : t('Prompt draft is saved locally in this browser.') }}
        </span>
      </div>
      <label
        class="visually-hidden"
        for="external-ai-prompt"
      >
        {{ t('Write your prompt') }}
      </label>
      <textarea
        id="external-ai-prompt"
        v-model="externalAiPrompt"
        class="external-ai-prompt-input"
        :placeholder="t('What would you like to ask?')"
        rows="8"
        @keydown="handleExternalAiPromptKeydown"
      />
      <div class="external-ai-prompt-footer">
        <span class="external-ai-prompt-hint">{{ t('Press Enter to open all three. Use Shift+Enter for a new line.') }}</span>
        <span class="external-ai-character-count">{{ externalAiPrompt.length.toLocaleString() }}</span>
      </div>
      <div class="external-ai-main-actions">
        <div class="external-ai-secondary-actions">
          <button
            class="button button-secondary"
            type="button"
            @click="copyExternalAiPrompt"
          >
            <Copy :size="16" />
            {{ t('Copy prompt') }}
          </button>
          <button
            class="text-button"
            type="button"
            :disabled="!externalAiPrompt"
            @click="externalAiPrompt = ''"
          >
            {{ t('Clear prompt') }}
          </button>
        </div>
        <button
          class="button button-primary external-ai-open-all"
          type="button"
          @click="openExternalAiTools(externalAiProviders)"
        >
          <ArrowUpRight :size="17" />
          {{ t('Open in all 3 AIs') }}
        </button>
      </div>
    </section>
    <p class="external-ai-popup-note">
      {{ t('If your browser blocks tabs, allow pop-ups or open each AI separately below.') }}
    </p>
    <section
      class="external-ai-provider-grid"
      :aria-label="t('Choose an AI service')"
    >
      <article
        v-for="provider in externalAiProviders"
        :key="provider.name"
        class="surface-card external-ai-provider-card"
      >
        <span
          class="external-ai-provider-icon"
          aria-hidden="true"
        >
          <Sparkles :size="19" />
        </span>
        <h2>{{ provider.name }}</h2>
        <p>
          {{ t('Open this service in a new tab. Your prompt is copied for you to paste.') }}
        </p>
        <button
          class="button button-secondary"
          type="button"
          @click="openExternalAiTools([provider])"
        >
          <ExternalLink :size="16" />
          {{ t('Open') }}
        </button>
      </article>
    </section>
  </div>

  <div
    v-else
    class="page-wrap narrow-page"
  >
    <section class="surface-card empty-state">
      <h1>Page not found</h1><button
        class="button button-primary"
        type="button"
        @click="go('compose')"
      >
        Back to home
      </button>
    </section>
  </div>

  <div
    v-if="dialog"
    class="dialog-backdrop"
    @click.self="closeDialog"
  >
    <section
      class="app-dialog surface-card"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="`dialog-${dialog.type}-title`"
    >
      <div class="dialog-title-row">
        <h2 :id="`dialog-${dialog.type}-title`">
          {{ dialog.type === 'preview' ? 'Article preview' : dialog.type === 'discard' ? 'Discard draft?' : dialog.type === 'schedule' ? 'Schedule article' : 'Publish locally?' }}
        </h2><button
          class="icon-button"
          type="button"
          aria-label="Close dialog"
          @click="closeDialog"
        >
          <X :size="18" />
        </button>
      </div>
      <template v-if="selectedArticle">
        <template v-if="dialog.type === 'preview'">
          <h3>{{ getArticleTitle(selectedArticle) }}</h3><div
            class="rich-content"
            v-html="richTextToHtml(selectedArticle.body)"
          /><p class="dialog-note">
            Preview only. Your article remains saved in this browser.
          </p>
          <div class="dialog-actions">
            <button
              class="button button-secondary"
              type="button"
              @click="closeDialog"
            >
              Close
            </button><button
              class="button button-primary"
              type="button"
              @click="closeDialog(); openArticle(selectedArticle)"
            >
              Edit article
            </button>
          </div>
        </template>
        <template v-else-if="dialog.type === 'discard'">
          <p>Discard “{{ getArticleTitle(selectedArticle) }}”? This removes the draft from this browser.</p>
          <div class="dialog-actions">
            <button
              class="button button-secondary"
              type="button"
              @click="closeDialog"
            >
              Cancel
            </button><button
              class="button button-danger"
              type="button"
              @click="resolveDialog"
            >
              Discard draft
            </button>
          </div>
        </template>
        <template v-else-if="dialog.type === 'schedule'">
          <p>Choose a future time. Scheduling is stored locally and will not publish automatically.</p>
          <label class="field-label">Date and time<input
            v-model="scheduledAt"
            type="datetime-local"
          ></label>
          <div class="dialog-actions">
            <button
              class="button button-secondary"
              type="button"
              @click="closeDialog"
            >
              Cancel
            </button><button
              class="button button-primary"
              type="button"
              @click="resolveDialog"
            >
              Save schedule
            </button>
          </div>
        </template>
        <template v-else>
          <p>Save “{{ getArticleTitle(selectedArticle) }}” as published in this browser? This does not publish to a website or social network.</p>
          <div class="dialog-actions">
            <button
              class="button button-secondary"
              type="button"
              @click="closeDialog"
            >
              Cancel
            </button><button
              class="button button-primary"
              type="button"
              @click="resolveDialog"
            >
              <Check :size="16" /> Publish locally
            </button>
          </div>
        </template>
      </template>
    </section>
  </div>

  <div
    v-if="message"
    class="inline-toast"
    role="status"
  >
    {{ message }}
  </div>
</template>
