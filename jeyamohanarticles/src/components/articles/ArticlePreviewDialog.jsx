import { Button, Modal, Typography } from 'antd'
import { FilePdfOutlined } from '@ant-design/icons'
import { getArticleTitle } from '../../utils/article.js'
import { richTextToHtml } from '../../utils/richText.js'
import { useLanguage } from '../../context/LanguageContext.jsx'

export default function ArticlePreviewDialog({ open, article, onClose, onDownloadPdf }) {
  const { t } = useLanguage()
  if (!article) return null

  return (
    <Modal
      className="article-preview-modal"
      title={t('Article preview')}
      open={open}
      onCancel={onClose}
      width={840}
      footer={[
        <Button key="pdf" icon={<FilePdfOutlined />} onClick={onDownloadPdf}>{t('Save as PDF')}</Button>,
        <Button key="close" type="primary" onClick={onClose}>{t('Close')}</Button>,
      ]}
      destroyOnHidden
    >
      <article className="article-preview-content">
        <Typography.Paragraph type="secondary" className="article-preview-note">{t('Choose Save as PDF in the browser print dialog.')}</Typography.Paragraph>
        <Typography.Title level={1}>{getArticleTitle(article)}</Typography.Title>
        {article.seoDescription && <Typography.Paragraph className="article-preview-description">{article.seoDescription}</Typography.Paragraph>}
        <div className="article-preview-body" dangerouslySetInnerHTML={{ __html: richTextToHtml(article.body || '') }} />
      </article>
    </Modal>
  )
}
