import { Empty } from 'antd'
import ArticleCard from './ArticleCard.jsx'
import { useLanguage } from '../../context/LanguageContext.jsx'

export default function ArticleList({ articles, filter, onOpen, onAction }) {
  const { t } = useLanguage()
  const visible = articles.filter((article) => filter === 'all' || article.status === filter)
  if (!visible.length) return <Empty className="list-empty" description={t(filter === 'all' ? 'No articles yet' : 'No articles in this category')} />
  return <div className="article-list">{visible.map((article) => <ArticleCard key={article.id} article={article} onOpen={onOpen} onAction={onAction} />)}</div>
}
