const HIGHLIGHTS_KEY = 'jeyamohan-highlights-v1'

function createId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return `highlight-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

export function createHighlightCollection() {
  return { id: createId(), title: '', items: [], updatedAt: new Date().toISOString() }
}

export function loadHighlights() {
  try {
    const stored = JSON.parse(localStorage.getItem(HIGHLIGHTS_KEY) || '[]')
    if (!Array.isArray(stored)) return []
    return stored.filter((item) => item && typeof item === 'object').map((item) => ({
      id: typeof item.id === 'string' ? item.id : createId(),
      title: typeof item.title === 'string' ? item.title : '',
      items: Array.isArray(item.items) ? item.items.filter((image) => image && typeof image.src === 'string').map((image) => ({
        id: typeof image.id === 'string' ? image.id : createId(),
        src: image.src,
        name: typeof image.name === 'string' ? image.name : '',
      })) : [],
      updatedAt: typeof item.updatedAt === 'string' && Number.isFinite(Date.parse(item.updatedAt)) ? item.updatedAt : new Date().toISOString(),
    })).filter((item) => item.title || item.items.length)
  } catch {
    return []
  }
}

export function saveHighlights(highlights) {
  try {
    localStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify(highlights))
    return true
  } catch {
    return false
  }
}
