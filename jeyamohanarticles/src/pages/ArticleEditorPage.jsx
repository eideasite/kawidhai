import { useDeferredValue, useRef } from 'react'
import { Alert, Button, Card, Statistic, Typography } from 'antd'
import ArticleBodyEditor from '../components/editor/ArticleBodyEditor.jsx'
import ArticleTitleInput from '../components/editor/ArticleTitleInput.jsx'
import EditorToolbar, { EditorFormatToolbar } from '../components/editor/EditorToolbar.jsx'
import { formatDate } from '../utils/formatDate.js'
import { escapeHtml, isSafeRichTextUrl, richTextToPlainText, sanitizeRichTextHtml } from '../utils/richText.js'
import { useLanguage } from '../context/LanguageContext.jsx'

const { Text } = Typography

export default function ArticleEditorPage({ article, onChange, onOpenSeo, onManage, onCreate, onDiscard, onBackHome, onPreview, onDownloadPdf }) {
  const { t, language } = useLanguage()
  const bodyRef = useRef(null)
  const savedRange = useRef(null)

  const rememberSelection = () => {
    const editor = bodyRef.current
    const selection = window.getSelection()
    if (editor && selection?.rangeCount && editor.contains(selection.anchorNode)) {
      savedRange.current = selection.getRangeAt(0).cloneRange()
    }
  }

  const restoreSelection = () => {
    const editor = bodyRef.current
    if (!editor) return null
    editor.focus()
    const selection = window.getSelection()
    selection.removeAllRanges()
    if (savedRange.current && editor.contains(savedRange.current.startContainer)) {
      selection.addRange(savedRange.current)
    } else {
      const range = document.createRange()
      range.selectNodeContents(editor)
      range.collapse(false)
      selection.addRange(range)
    }
    return selection.getRangeAt(0)
  }

  const deferredBody = useDeferredValue(article?.body || '')

  const commitEditor = () => {
    const editor = bodyRef.current
    if (!editor) return
    const safeHtml = sanitizeRichTextHtml(editor.innerHTML)
    if (editor.innerHTML !== safeHtml) editor.innerHTML = safeHtml
    onChange({ body: safeHtml })
    rememberSelection()
  }

  const applyFormat = (format, value) => {
    const editor = bodyRef.current
    if (!editor) return
    const range = restoreSelection()
    if (!range) return

    if (format === 'link' || format === 'image') {
      if (!isSafeRichTextUrl(value, format === 'image')) return
      if (format === 'link') {
        if (range.collapsed) {
          document.execCommand('insertHTML', false, `<a href="${escapeHtml(value)}" target="_blank" rel="noopener noreferrer">${escapeHtml(value)}</a>`)
        } else {
          document.execCommand('createLink', false, value)
        }
      } else {
        document.execCommand('insertHTML', false, `<img src="${escapeHtml(value)}" alt="" loading="lazy">`)
      }
    } else {
      const commands = {
        bold: ['bold'], italic: ['italic'], bullet: ['insertUnorderedList'],
        number: ['insertOrderedList'], quote: ['formatBlock', 'blockquote'],
        codeblock: ['formatBlock', 'pre'], rule: ['insertHorizontalRule'],
        heading1: ['formatBlock', 'h1'], heading2: ['formatBlock', 'h2'], paragraph: ['formatBlock', 'p'],
      }
      const command = commands[format]
      if (command) document.execCommand(command[0], false, command[1])
    }
    commitEditor()
  }

  if (!article) return <div className="page-wrap editor-page"><Card className="surface-card"><Typography.Title level={3}>{t('No article is open')}</Typography.Title><Typography.Paragraph>{t('Open a draft from Articles Management or create a new article.')}</Typography.Paragraph><div className="form-actions"><Button type="primary" onClick={onCreate}>{t('Create new article')}</Button><Button onClick={onManage}>{t('View articles')}</Button></div></Card></div>

  const plainBody = richTextToPlainText(deferredBody)
  const words = plainBody ? plainBody.split(/\s+/u).length : 0
  const readingMinutes = Math.max(1, Math.ceil(words / 200))
  return (
    <div className="page-wrap editor-page">
      <EditorToolbar article={article} onOpenSeo={onOpenSeo} onManage={onManage} onDiscard={onDiscard} onBackHome={onBackHome} onPreview={onPreview} onDownloadPdf={onDownloadPdf} />
      <Alert className="local-notice" showIcon type="info" message={t('Draft saved in this browser')} description={t('Formatting is applied to the selected text in the editor. Publishing and scheduling are local status changes only.')} />
      <Card className="surface-card editor-card">
        <div className="editor-meta"><Text type="secondary">{t('Article title')}</Text><Text type="secondary">{t(article.status === 'draft' ? 'Draft' : article.status === 'scheduled' ? 'Scheduled locally' : 'Published locally')}</Text></div>
        <ArticleTitleInput value={article.title} onChange={(title) => onChange({ title })} />
        <div className="editor-compose-row">
          <EditorFormatToolbar onFormat={applyFormat} />
          <div className="editor-compose-body">
            <ArticleBodyEditor ref={bodyRef} value={article.body} onChange={(body) => onChange({ body })} onSelectionChange={rememberSelection} />
          </div>
        </div>
        <div className="editor-footer"><Text type="secondary">{plainBody.length} {t('characters')}</Text><Text type="secondary">{words} {t('words')} | {readingMinutes} {t('min read')}</Text></div>
      </Card>
      <div className="editor-bottom-note"><Statistic title={t('Last updated')} value={formatDate(article.updatedAt, { dateStyle: 'medium', timeStyle: 'short' }, language === 'ta' ? 'ta-LK' : 'en-US')} /></div>
    </div>
  )
}
