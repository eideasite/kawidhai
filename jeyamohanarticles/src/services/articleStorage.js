import { createArticle } from '../utils/article.js'

const WORKSPACE_KEY = 'jeyamohan-articles-workspace-v1'
const LEGACY_DRAFT_KEY = 'ezhuthu-draft-v1'

const defaultWorkspace = () => ({
  profile: { name: '\u0b9c\u0bc6\u0baf\u0bbae\u0bcb\u0b95\u0ba9\u0bcd', bio: '', avatar: '\u270d\ufe0f' },
  articles: [createArticle()],
})

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

function parseStorageValue(key) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return { found: false, valid: false, value: null }
    return { found: true, valid: true, value: JSON.parse(raw) }
  } catch {
    return { found: true, valid: false, value: null }
  }
}

function normalizeArticle(value) {
  if (!isRecord(value)) return createArticle()
  const title = typeof value.title === 'string'
    ? value.title
    : typeof value.articleTitle === 'string' ? value.articleTitle : ''
  const body = typeof value.body === 'string'
    ? value.body
    : typeof value.content === 'string' ? value.content
      : typeof value.text === 'string' ? value.text : ''
  const article = createArticle({
    ...value,
    title,
    body,
    seoTitle: typeof value.seoTitle === 'string' ? value.seoTitle : '',
    seoDescription: typeof value.seoDescription === 'string' ? value.seoDescription : '',
    slug: typeof value.slug === 'string' ? value.slug : '',
  })
  if (typeof article.id !== 'string' || !article.id.trim()) article.id = createArticle().id
  if (!['draft', 'scheduled', 'published'].includes(article.status)) article.status = 'draft'
  const dateOrDefault = (date, fallback) => typeof date === 'string' && Number.isFinite(Date.parse(date)) ? date : fallback
  article.createdAt = dateOrDefault(article.createdAt, new Date().toISOString())
  article.updatedAt = dateOrDefault(article.updatedAt, article.createdAt)
  article.scheduledAt = dateOrDefault(article.scheduledAt, null)
  article.publishedAt = dateOrDefault(article.publishedAt, null)
  return article
}

function normalizeLegacyDraft(value) {
  if (typeof value === 'string') return createArticle({ body: value })
  if (!isRecord(value)) return null
  const legacyArticle = isRecord(value.article) ? value.article : value
  const normalized = normalizeArticle(legacyArticle)
  return normalized.title || normalized.body ? normalized : null
}

function readLegacyDraft() {
  const legacy = parseStorageValue(LEGACY_DRAFT_KEY)
  return legacy.valid ? normalizeLegacyDraft(legacy.value) : null
}

export function loadWorkspace() {
  const defaults = defaultWorkspace()
  const stored = parseStorageValue(WORKSPACE_KEY)

  if (stored.found && stored.valid && isRecord(stored.value)) {
    const parsed = stored.value
    if (Array.isArray(parsed.articles)) {
      const savedProfile = isRecord(parsed.profile) ? parsed.profile : {}
      return {
        profile: {
          name: typeof savedProfile.name === 'string' ? savedProfile.name : defaults.profile.name,
          bio: typeof savedProfile.bio === 'string' ? savedProfile.bio : '',
          avatar: typeof savedProfile.avatar === 'string' && savedProfile.avatar ? savedProfile.avatar : defaults.profile.avatar,
        },
        articles: parsed.articles.map(normalizeArticle),
      }
    }

    // Older versions stored one draft at the workspace root instead of an articles array.
    const rootDraft = normalizeLegacyDraft(parsed)
    if (rootDraft) {
      const savedProfile = isRecord(parsed.profile) ? parsed.profile : {}
      return {
        profile: {
          name: typeof savedProfile.name === 'string' ? savedProfile.name : defaults.profile.name,
          bio: typeof savedProfile.bio === 'string' ? savedProfile.bio : '',
          avatar: typeof savedProfile.avatar === 'string' && savedProfile.avatar ? savedProfile.avatar : defaults.profile.avatar,
        },
        articles: [rootDraft],
      }
    }
  }

  // Keep the old key intact while migrating; malformed current storage must not hide a valid old draft.
  const legacyDraft = readLegacyDraft()
  if (legacyDraft) return { ...defaults, articles: [legacyDraft] }

  return defaults
}

export function saveWorkspace(workspace) {
  try {
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace))
    return true
  } catch {
    return false
  }
}
