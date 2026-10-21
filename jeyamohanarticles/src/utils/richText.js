const ALLOWED_TAGS = new Set(['P', 'DIV', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'H1', 'H2', 'H3', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE', 'HR', 'A', 'IMG'])
const DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH'])

export function isRichTextHtml(value = '') {
  return /<(?:p|div|br|strong|b|em|i|u|s|h[1-3]|ul|ol|li|blockquote|pre|code|hr|a|img)(?:\s|\/?>)/i.test(value)
}

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character])
}

function isSafeUrl(value, image = false) {
  if (image && /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/i.test(value) && value.length <= 1500000) return true
  try {
    const url = new URL(value, window.location.origin)
    return image ? ['http:', 'https:'].includes(url.protocol) : ['http:', 'https:', 'mailto:'].includes(url.protocol)
  } catch {
    return false
  }
}

function cleanNode(node) {
  for (const child of [...node.childNodes]) {
    if (child.nodeType !== Node.ELEMENT_NODE) continue
    if (DROP_TAGS.has(child.tagName)) { child.remove(); continue }
    cleanNode(child)
    if (!ALLOWED_TAGS.has(child.tagName)) {
      child.replaceWith(...child.childNodes)
      continue
    }
    const tag = child.tagName
    const href = child.getAttribute('href')
    const src = child.getAttribute('src')
    const alt = child.getAttribute('alt') || ''
    for (const attr of [...child.attributes]) child.removeAttribute(attr.name)
    if (tag === 'A' && href && isSafeUrl(href)) {
      child.setAttribute('href', href)
      child.setAttribute('target', '_blank')
      child.setAttribute('rel', 'noopener noreferrer')
    }
    if (tag === 'IMG') {
      if (src && isSafeUrl(src, true)) child.setAttribute('src', src)
      child.setAttribute('alt', alt)
      child.setAttribute('loading', 'lazy')
    }
  }
}

export function sanitizeRichTextHtml(value = '') {
  if (typeof DOMParser === 'undefined') return escapeHtml(value)
  const template = document.createElement('template')
  template.innerHTML = String(value)
  cleanNode(template.content)
  return template.innerHTML
}

function formatMarkdownInline(value) {
  let text = escapeHtml(value)
  text = text.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, (_, alt, src) => `<img src="${escapeHtml(src)}" alt="${alt}">`)
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, (_, label, href) => `<a href="${escapeHtml(href)}">${label}</a>`)
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>')
  return text
}

export function plainTextToHtml(value = '') {
  const lines = String(value).split('\n')
  const output = []
  let listType = null
  const closeList = () => { if (listType) { output.push(`</${listType}>`); listType = null } }
  for (const line of lines) {
    const heading = line.match(/^(#{1,2})\s+(.+)$/)
    const bullet = line.match(/^\s*[-*]\s+(.+)$/)
    const numbered = line.match(/^\s*\d+\.\s+(.+)$/)
    if (heading) { closeList(); const level = heading[1].length; output.push(`<h${level}>${formatMarkdownInline(heading[2])}</h${level}>`); continue }
    if (/^\s*---+\s*$/.test(line)) { closeList(); output.push('<hr>'); continue }
    if (/^>\s?/.test(line)) { closeList(); output.push(`<blockquote><p>${formatMarkdownInline(line.replace(/^>\s?/, ''))}</p></blockquote>`); continue }
    const nextListType = bullet ? 'ul' : numbered ? 'ol' : null
    if (nextListType) {
      if (listType !== nextListType) { closeList(); output.push(`<${nextListType}>`); listType = nextListType }
      output.push(`<li>${formatMarkdownInline((bullet || numbered)[1])}</li>`); continue
    }
    closeList()
    if (!line.trim()) continue
    output.push(`<p>${formatMarkdownInline(line)}</p>`)
  }
  closeList()
  return output.join('')
}

export function richTextToHtml(value = '') {
  if (!String(value).trim()) return ''
  return sanitizeRichTextHtml(isRichTextHtml(value) ? value : plainTextToHtml(value))
}

export function richTextToPlainText(value = '') {
  if (typeof DOMParser === 'undefined') return String(value).replace(/<[^>]*>/g, ' ')
  const doc = new DOMParser().parseFromString(richTextToHtml(value), 'text/html')
  doc.querySelectorAll('img').forEach((node) => node.replaceWith(node.alt || '[Image]'))
  doc.querySelectorAll('br,hr').forEach((node) => node.replaceWith('\n'))
  doc.querySelectorAll('p,h1,h2,h3,li,blockquote,pre').forEach((node) => node.append('\n'))
  return (doc.body.textContent || '').replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function isSafeRichTextUrl(value, image = false) {
  return isSafeUrl(value, image)
}
