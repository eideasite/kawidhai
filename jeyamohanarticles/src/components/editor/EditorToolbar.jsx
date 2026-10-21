import { useState } from 'react'
import { Button, Dropdown, Input, Popover, Space, Tooltip, Typography } from 'antd'
import {
  AlignLeftOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  BoldOutlined,
  CodeOutlined,
  DownOutlined,
  EyeOutlined,
  FilePdfOutlined,
  ItalicOutlined,
  LinkOutlined,
  OrderedListOutlined,
  PictureOutlined,
  CommentOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { useLanguage } from '../../context/LanguageContext.jsx'

const formatItems = [
  { key: 'paragraph', label: 'Paragraph' },
  { key: 'heading1', label: 'Heading 1' },
  { key: 'heading2', label: 'Heading 2' },
]

const formatActions = [
  { key: 'bold', label: 'Bold', icon: <BoldOutlined /> },
  { key: 'italic', label: 'Italic', icon: <ItalicOutlined /> },
  { key: 'bullet', label: 'Bulleted list', icon: <UnorderedListOutlined /> },
  { key: 'number', label: 'Numbered list', icon: <OrderedListOutlined /> },
  { key: 'quote', label: 'Quote', icon: <CommentOutlined /> },
  { key: 'codeblock', label: 'Code block', icon: <CodeOutlined /> },
  { key: 'rule', label: 'Horizontal line', icon: <AlignLeftOutlined /> },
  { key: 'link', label: 'Insert link', icon: <LinkOutlined /> },
  { key: 'image', label: 'Insert image reference', icon: <PictureOutlined /> },
]

export function EditorFormatToolbar({ onFormat }) {
  const { t } = useLanguage()
  const [activePopover, setActivePopover] = useState(null)
  const [url, setUrl] = useState('')
  const insertReference = (kind) => {
    if (!url.trim()) return
    onFormat(kind, url.trim())
    setUrl('')
    setActivePopover(null)
  }

  return (
    <div className="editor-format-toolbar" aria-label="Article formatting">
      <Dropdown menu={{ items: formatItems.map((item) => ({ ...item, label: t(item.label) })), onClick: ({ key }) => onFormat(key) }} trigger={['click']}>
        <Button className="format-style-button" aria-label={t('Choose text style')} onMouseDown={(event) => event.preventDefault()}>
          {t('Style')} <DownOutlined />
        </Button>
      </Dropdown>
      {formatActions.map(({ key, label, icon }) => {
        const action = (
          <Button className="format-icon-button" aria-label={t(label)} onMouseDown={(event) => event.preventDefault()} onClick={() => {
            if (key === 'link' || key === 'image') { setUrl(''); setActivePopover(key) }
            else onFormat(key)
          }}>
            {icon}
          </Button>
        )
        if (key === 'link' || key === 'image') {
          return (
            <Popover
              key={key}
              title={t(key === 'link' ? 'Insert link' : 'Insert image')}
              open={activePopover === key}
              onOpenChange={(open) => setActivePopover(open ? key : null)}
              content={<Space direction="vertical" size="small" className="reference-popover">
                <Input autoFocus placeholder={key === 'link' ? 'https://...' : t('Image URL')} value={url} onChange={(event) => setUrl(event.target.value)} onPressEnter={() => insertReference(key)} />
                <Button type="primary" block onMouseDown={(event) => event.preventDefault()} onClick={() => insertReference(key)}>{t('Insert')}</Button>
              </Space>}
              trigger="click"
              placement="right"
            >
              <span className="format-popover-trigger"><Tooltip title={label} placement="left">{action}</Tooltip></span>
            </Popover>
          )
        }
        return <Tooltip key={key} title={t(label)} placement="left">{action}</Tooltip>
      })}
      <Typography.Text className="format-help">{t('Select text, then choose a format.')}</Typography.Text>
    </div>
  )
}

export default function EditorToolbar({ article, onOpenSeo, onManage, onDiscard, onBackHome, onPreview, onDownloadPdf }) {
  const { t } = useLanguage()
  const manageItems = [
    { key: 'articles', label: t('Articles Management') },
    ...(article?.status === 'draft' ? [{ key: 'discard', label: t('Discard Draft'), danger: true }] : []),
  ]

  return (
    <div className="editor-flow-toolbar">
      <div className="editor-flow-copy">
        <Typography.Text className="eyebrow">{t('Writing workspace')}</Typography.Text>
        <Typography.Title level={2}>{t('Article Editor')}</Typography.Title>
        <Typography.Paragraph>{t('Write and edit your article. Your draft is saved in this browser.')}</Typography.Paragraph>
      </div>
      <div className="editor-flow-actions">
        <Button type="text" className="editor-back-home-button" icon={<ArrowLeftOutlined />} onClick={onBackHome}>{t('Back to home')}</Button>
        <Button className="editor-preview-button" icon={<EyeOutlined />} onClick={onPreview}>{t('Preview')}</Button>
        <Button className="editor-pdf-button" icon={<FilePdfOutlined />} onClick={onDownloadPdf}>{t('Save as PDF')}</Button>
        <Dropdown
          menu={{
            items: manageItems,
            onClick: ({ key }) => (key === 'discard' ? onDiscard?.() : onManage?.()),
          }}
          trigger={['click']}
        >
          <Button className="editor-manage-button">{t('Manage')} <DownOutlined /></Button>
        </Dropdown>
        <Button className="editor-next-button" type="primary" onClick={onOpenSeo}>
          {t('Next')} <ArrowRightOutlined />
        </Button>
      </div>
    </div>
  )
}

