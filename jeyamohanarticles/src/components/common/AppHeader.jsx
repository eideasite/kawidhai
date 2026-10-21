import { Button, Dropdown, Input, Layout, Select, Switch, Tooltip, Typography } from 'antd'
import { DownOutlined, GlobalOutlined, LockOutlined, LogoutOutlined, MenuOutlined, MoonOutlined, SettingOutlined, SunOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useLanguage } from '../../context/LanguageContext.jsx'
import AccessibilitySettings from './AccessibilitySettings.jsx'
import ProfileAvatar from './ProfileAvatar.jsx'

const { Header } = Layout

export default function AppHeader({ onOpenMenu, themeMode, onThemeChange, language, onLanguageChange, profile, onNavigate, onLock, onSignOut }) {
  const isDark = themeMode === 'dark'
  const { t } = useLanguage()
  const [searchQuery, setSearchQuery] = useState('')
  const searchGoogleAI = (value) => {
    const query = value.trim()
    if (!query) return
    window.open(`https://www.google.com/ai?q=${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer')
  }
  const accountMenu = {
    items: [
      { key: 'account-settings', icon: <SettingOutlined />, label: t('Change account settings') },
      { type: 'divider' },
      { key: 'lock', icon: <LockOutlined />, label: t('Lock') },
      { key: 'sign-out', icon: <LogoutOutlined />, label: t('Sign out'), danger: true },
    ],
    onClick: ({ key }) => {
      if (key === 'account-settings') onNavigate('profile')
      if (key === 'lock') onLock()
      if (key === 'sign-out') onSignOut()
    },
  }
  return (
    <Header className="app-header">
      <div className="mobile-brand"><Button type="text" aria-label={t('Open navigation')} icon={<MenuOutlined />} onClick={onOpenMenu} /><span className="brand-mark">{'\u0b9c\u0bc6'}</span><strong>Jeyamohan Articles</strong></div>
      <Input.Search
        className="google-ai-search"
        aria-label={t('Search Google AI')}
        placeholder={t('Search Google AI')}
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        onSearch={searchGoogleAI}
        enterButton={<Button type="primary"><span className="google-ai-mark" aria-hidden="true">G</span>Google AI</Button>}
      />
      <div className="header-tools">
        <Typography.Text className="header-note">{t('Personal writing space')}</Typography.Text>
        <AccessibilitySettings themeMode={themeMode} onThemeChange={onThemeChange} />
        <Select
          className="language-select"
          aria-label={t('Choose language')}
          value={language}
          onChange={onLanguageChange}
          options={[{ value: 'ta', label: 'தமிழ்' }, { value: 'en', label: 'English' }]}
          suffixIcon={<GlobalOutlined />}
          popupMatchSelectWidth={false}
        />
        <Tooltip title={t(isDark ? 'Switch to light mode' : 'Switch to night mode')}>
          <Switch
            className="theme-mode-switch"
            checked={isDark}
            checkedChildren={<MoonOutlined />}
            unCheckedChildren={<SunOutlined />}
            aria-label={t(isDark ? 'Switch to light mode' : 'Switch to night mode')}
            onChange={onThemeChange}
          />
        </Tooltip>
        <Dropdown menu={accountMenu} trigger={['click']} placement="bottomRight">
          <Button className="account-menu-trigger" type="text" aria-label={t('Open account menu')}>
            <ProfileAvatar profile={profile} size={32} className="account-menu-avatar" /><DownOutlined />
          </Button>
        </Dropdown>
      </div>
    </Header>
  )
}
