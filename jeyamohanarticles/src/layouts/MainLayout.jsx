import { useState } from 'react'
import { Drawer, Layout, Menu, Typography } from 'antd'
import { FileTextOutlined, SettingOutlined, UserOutlined } from '@ant-design/icons'
import AppHeader from '../components/common/AppHeader.jsx'
import LoadingState from '../components/common/LoadingState.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'

const { Content, Sider } = Layout
const navItems = [
  { key: 'compose', icon: <FileTextOutlined />, label: 'Write a Post' },
  { key: 'write-article', icon: <FileTextOutlined />, label: 'Write an Article' },
  { key: 'profile', icon: <UserOutlined />, label: 'Profile' },
  { key: 'editor', icon: <FileTextOutlined />, label: 'Article Editor' },
  { key: 'seo', icon: <SettingOutlined />, label: 'SEO Settings' },
  { key: 'published', icon: <FileTextOutlined />, label: 'Published Post' },
  { key: 'articles', icon: <FileTextOutlined />, label: 'Articles Management' },
]

export default function MainLayout({ page, onNavigate, saveStatus, themeMode, onThemeChange, language, onLanguageChange, profile, onLock, onSignOut, children }) {
  const { t } = useLanguage()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const selectPage = (key) => { onNavigate(key); setMobileNavOpen(false) }
  const menu = <Menu mode="inline" selectedKeys={[page === 'published' ? 'articles' : page]} items={navItems.map((item) => ({ ...item, label: t(item.label) }))} onClick={({ key }) => selectPage(key)} />
  const saveMessage = saveStatus === 'error' ? t('Could not save') : saveStatus === 'saving' ? <LoadingState /> : t('Saved in this browser')

  return (
    <Layout className="app-layout">
      <Sider className="app-sider" width={232} breakpoint="lg" collapsedWidth={0}>
        <div className="sider-brand"><span className="brand-mark">ஜெ</span><div><strong>Jeyamohan</strong><Typography.Text type="secondary">{t('Articles')}</Typography.Text></div></div>
        {menu}
        <div className="sider-note"><span className={`storage-indicator ${saveStatus}`} />{saveMessage}</div>
      </Sider>
      <Layout className="app-main-layout">
        <AppHeader onOpenMenu={() => setMobileNavOpen(true)} themeMode={themeMode} onThemeChange={onThemeChange} language={language} onLanguageChange={onLanguageChange} profile={profile} onNavigate={onNavigate} onLock={onLock} onSignOut={onSignOut} />
        <Content className="app-content">{children}</Content>
      </Layout>
      <Drawer title="Jeyamohan Articles" open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} placement="left" width={280}>{menu}</Drawer>
    </Layout>
  )
}
