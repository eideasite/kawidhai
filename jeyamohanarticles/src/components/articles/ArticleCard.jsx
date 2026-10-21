import { Button, Space, Typography } from 'antd'
import ArticleStatusTag from '../common/ArticleStatusTag.jsx'
import ArticleActionsMenu from './ArticleActionsMenu.jsx'
import { getArticleExcerpt, getArticleTitle } from '../../utils/article.js'
import { formatDate } from '../../utils/formatDate.js'
import { useLanguage } from '../../context/LanguageContext.jsx'

const { Title, Text, Paragraph } = Typography

export default function ArticleCard({ article, onOpen, onAction }) {
  const { t, language } = useLanguage()
  return (
    <article className="article-row">
      <Button type="text" className="article-row-main" aria-label={t('Open article')} onClick={() => onOpen(article)}>
        <div className="article-row-title"><Title level={5}>{getArticleTitle(article)}</Title><ArticleStatusTag status={article.status} /></div>
        <Paragraph ellipsis={{ rows: 2 }} type="secondary">{getArticleExcerpt(article.body) || t('Article body has not been added yet.')}</Paragraph>
        <Text className="article-row-date" type="secondary">{t('Updated:')} {formatDate(article.updatedAt, undefined, language === 'ta' ? 'ta-LK' : 'en-US')}</Text>
      </Button>
      <Space className="article-row-actions"><Button onClick={() => onOpen(article)}>{t(article.status === 'published' ? 'View article' : 'Open article')}</Button><ArticleActionsMenu article={article} onAction={onAction} /></Space>
    </article>
  )
}
