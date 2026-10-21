import { notifyAppError } from '../../services/errorNotifications.js'
import { forwardRef, useEffect, useRef } from 'react'
import { App } from 'antd'
import { richTextToHtml, sanitizeRichTextHtml } from '../../utils/richText.js'
import { useLanguage } from '../../context/LanguageContext.jsx'

const ArticleBodyEditor = forwardRef(function ArticleBodyEditor({ value, onChange, onSelectionChange }, forwardedRef) {
  const { message } = App.useApp()
  const { t } = useLanguage()
  const localRef = useRef(null)

  useEffect(() => {
    const editor = localRef.current
    if (!editor || document.activeElement === editor) return
    const safeHtml = richTextToHtml(value || '')
    if (editor.innerHTML !== safeHtml) editor.innerHTML = safeHtml
  }, [value])

  const handleInput = (event) => {
    // Keep typing responsive; sanitize on blur, paste boundaries, formatting, and before display.
    onChange(event.currentTarget.innerHTML)
  }

  const handleBlur = (event) => {
    const editor = event.currentTarget
    const safeHtml = sanitizeRichTextHtml(editor.innerHTML)
    if (editor.innerHTML !== safeHtml) editor.innerHTML = safeHtml
    if (safeHtml !== (value || '')) onChange(safeHtml)
  }

  const handlePaste = (event) => {
    const editor = event.currentTarget
    const imageItem = Array.from(event.clipboardData.items || []).find((item) => item.kind === 'file' && item.type.startsWith('image/'))
    if (imageItem) {
      event.preventDefault()
      const imageFile = imageItem.getAsFile()
      const acceptedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
      if (!imageFile || !acceptedTypes.includes(imageFile.type)) {
        message.warning(t('Paste a PNG, JPEG, GIF, or WebP image.'))
        return
      }
      if (imageFile.size > 4 * 1024 * 1024) {
        message.warning(t('Pasted images must be 4 MB or smaller for local draft storage.'))
        return
      }
      const selection = window.getSelection()
      let range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null
      if (!range || !editor.contains(range.commonAncestorContainer)) {
        range = document.createRange()
        range.selectNodeContents(editor)
        range.collapse(false)
      }
      const reader = new FileReader()
      reader.onload = () => {
        const image = document.createElement('img')
        image.src = String(reader.result)
        image.alt = imageFile.name || 'Pasted image'
        range.deleteContents()
        range.insertNode(image)
        range.setStartAfter(image)
        range.collapse(true)
        selection?.removeAllRanges()
        selection?.addRange(range)
        editor.focus()
        editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }))
      }
      reader.onerror = () => notifyAppError(t('Could not read the pasted image.'))
      reader.readAsDataURL(imageFile)
      return
    }

    event.preventDefault()
    document.execCommand('insertText', false, event.clipboardData.getData('text/plain'))
  }

  return (
    <div
      ref={(node) => { localRef.current = node; if (typeof forwardedRef === 'function') forwardedRef(node); else if (forwardedRef) forwardedRef.current = node }}
      className="article-body-input article-rich-editor"
      role="textbox"
      aria-label="Article body"
      aria-multiline="true"
      contentEditable
      suppressContentEditableWarning
      data-placeholder={t('Start writing your article here...')}
      onInput={handleInput}
      onBlur={handleBlur}
      onKeyUp={onSelectionChange}
      onMouseUp={onSelectionChange}
      onPaste={handlePaste}
    />
  )
})

export default ArticleBodyEditor
