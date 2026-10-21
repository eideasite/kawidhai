import { notifyAppError } from './services/errorNotifications.js'
import { lazy, Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { App as AntApp, ConfigProvider, message, theme as antdTheme } from 'antd'
import enUS from 'antd/locale/en_US'
import taIN from 'antd/locale/ta_IN'
import QuickComposerPage from './pages/QuickComposerPage.jsx'
const ArticleEditorPage = lazy(() => import('./pages/ArticleEditorPage.jsx'))
const ArticlesManagementPage = lazy(() => import('./pages/ArticlesManagementPage.jsx'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'))
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'))
const PublishedPostPage = lazy(() => import('./pages/PublishedPostPage.jsx'))
const PublishSuccessPage = lazy(() => import('./pages/PublishSuccessPage.jsx'))
const SchedulePostPage = lazy(() => import('./pages/SchedulePostPage.jsx'))
const SEOSettingsPage = lazy(() => import('./pages/SEOSettingsPage.jsx'))
const ShareArticlePage = lazy(() => import('./pages/ShareArticlePage.jsx'))
const DiscardDraftDialog = lazy(() => import('./components/articles/DiscardDraftDialog.jsx'))
const ArticlePreviewDialog = lazy(() => import('./components/articles/ArticlePreviewDialog.jsx'))
import MainLayout from './layouts/MainLayout.jsx'
import ErrorNotificationHost from './components/common/ErrorNotificationHost.jsx'
import SystemErrorBoundary from './components/common/SystemErrorBoundary.jsx'
import ProfileAvatar from './components/common/ProfileAvatar.jsx'
import { LanguageProvider, useLanguage } from './context/LanguageContext.jsx'
import { useArticles } from './hooks/useArticles.js'
import { useDraft } from './hooks/useDraft.js'
import { loadWorkspace, saveWorkspace } from './services/articleStorage.js'
import { createLocalPost, loadPosts, savePosts } from './services/postStorage.js'
import { loadHighlights, saveHighlights } from './services/highlightStorage.js'
import { publishLocally as getPublishedStatus, scheduleLocally as getScheduledStatus, waitForPostingMinimum } from './services/publishingService.js'
import { articleCanPublish } from './utils/validation.js'
import { getArticleTitle, makeSafeFilename } from './utils/article.js'
import { richTextToHtml } from './utils/richText.js'
import './styles/global.css'
import './styles/components.css'

const APP_PAGES = new Set(['compose', 'profile', 'editor', 'seo', 'published', 'articles'])

function getInitialPage() {
  const statePage = window.history.state?.jeyamohanPage
  const hashPage = window.location.hash.startsWith('#/') ? window.location.hash.slice(2) : ''
  return APP_PAGES.has(statePage) ? statePage : APP_PAGES.has(hashPage) ? hashPage : 'compose'
}

const SESSION_KEY = 'jeyamohan-articles-local-session-v1'

function loadSessionStatus() {
  try {
    const status = sessionStorage.getItem(SESSION_KEY)
    return status === 'locked' || status === 'signed-out' ? status : 'active'
  } catch {
    return 'active'
  }
}

function LocalSessionScreen({ status, profile, onContinue }) {
  const { t } = useLanguage()
  const signedOut = status === 'signed-out'
  return <main className="local-session-screen">
    <section className="local-session-card">
      <ProfileAvatar profile={profile} size={68} className="profile-avatar" />
      <p className="local-session-eyebrow">Jeyamohan Articles</p>
      <h1>{t(signedOut ? 'You are signed out' : 'Writing space locked')}</h1>
      <p>{signedOut ? t('Your articles and posts remain saved in this browser.') : t('This local lock hides the page only; it does not protect browser data.')}</p>
      <button type="button" className="system-error-retry local-session-continue" onClick={onContinue}>{t(signedOut ? 'Continue as {name}' : 'Unlock writing space').replace('{name}', profile.name || t('Writer'))}</button>
      <small>{t('This profile works locally in this browser and is not connected to an online account.')}</small>
    </section>
  </main>
}

function AppContent({ themeMode, onThemeChange, language, onLanguageChange }) {
  const { t } = useLanguage()
  const [sessionStatus, setSessionStatus] = useState(loadSessionStatus)
  const [workspace, setWorkspace] = useState(loadWorkspace)
  const [posts, setPosts] = useState(loadPosts)
  const [highlights, setHighlights] = useState(loadHighlights)
  const { saveStatus, setSaveStatus } = useDraft(workspace)
  const { updateWorkspace, updateArticle: updateArticleById, createNewArticle: addArticle, discardArticle } = useArticles(setWorkspace, () => setSaveStatus('saving'))
  const [page, setPage] = useState(getInitialPage)
  const [activeArticleId, setActiveArticleId] = useState(workspace.articles[0]?.id || null)
  const [seoReturnPage, setSeoReturnPage] = useState('editor')
  const [shareOpen, setShareOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [successOpen, setSuccessOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [printingArticle, setPrintingArticle] = useState(null)
  const [posting, setPosting] = useState(false)
  const postingRef = useRef(false)
  const activeArticle = useMemo(() => workspace.articles.find((article) => article.id === activeArticleId) || null, [workspace.articles, activeArticleId])

  useLayoutEffect(() => {
    if (!printingArticle) return undefined
    const originalTitle = document.title
    const clearPrintState = () => setPrintingArticle(null)
    document.title = makeSafeFilename(printingArticle.title || getArticleTitle(printingArticle))
    window.addEventListener('afterprint', clearPrintState)
    const printTimer = window.setTimeout(() => window.print(), 120)
    const fallbackTimer = window.setTimeout(clearPrintState, 120000)
    return () => {
      window.clearTimeout(printTimer)
      window.clearTimeout(fallbackTimer)
      window.removeEventListener('afterprint', clearPrintState)
      document.title = originalTitle
    }
  }, [printingArticle])

  useLayoutEffect(() => {
    const currentState = window.history.state || {}
    if (!APP_PAGES.has(currentState.jeyamohanPage) || !Number.isInteger(currentState.jeyamohanDepth) || window.location.hash !== `#/${page}`) {
      const url = `${window.location.pathname}${window.location.search}#/${page}`
      window.history.replaceState({ ...currentState, jeyamohanPage: page, jeyamohanDepth: currentState.jeyamohanDepth || 0 }, '', url)
    }
    const handlePopState = (event) => {
      const nextPage = event.state?.jeyamohanPage
      setPage(APP_PAGES.has(nextPage) ? nextPage : 'compose')
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [page])

  const navigateTo = (destination, { replace = false } = {}) => {
    if (!APP_PAGES.has(destination)) return
    const currentDepth = Number.isInteger(window.history.state?.jeyamohanDepth) ? window.history.state.jeyamohanDepth : 0
    const nextState = { ...window.history.state, jeyamohanPage: destination, jeyamohanDepth: replace ? currentDepth : currentDepth + 1 }
    const url = `${window.location.pathname}${window.location.search}#/${destination}`
    if (replace) window.history.replaceState(nextState, '', url)
    else if (destination !== page) window.history.pushState(nextState, '', url)
    setPage(destination)
  }

  const goBack = (fallback) => {
    if ((window.history.state?.jeyamohanDepth || 0) > 0) window.history.back()
    else navigateTo(fallback, { replace: true })
  }

  const updateArticle = (patch, id = activeArticleId) => updateArticleById(id, patch)
  const persistArticleStatus = (status) => {
    const updatedAt = new Date().toISOString()
    const nextWorkspace = {
      ...workspace,
      articles: workspace.articles.map((article) => article.id === activeArticleId
        ? { ...article, ...status, updatedAt }
        : article),
    }
    setSaveStatus('saving')
    if (!saveWorkspace(nextWorkspace)) throw new Error('Browser storage could not save the article status')
    setWorkspace(nextWorkspace)
    setSaveStatus('saved')
  }
  const createArticle = (body = '') => {
    const article = addArticle(body ? { body } : undefined)
    setActiveArticleId(article.id)
    navigateTo('editor')
  }
  const createPost = (content) => {
    const nextPosts = [createLocalPost(content), ...posts]
    if (!savePosts(nextPosts)) {
      notifyAppError(t('Could not save this post in this browser.'))
      return false
    }
    setPosts(nextPosts)
    return true
  }
  const saveHighlightList = (nextHighlights) => {
    if (!saveHighlights(nextHighlights)) {
      notifyAppError(t('Could not save highlights in this browser.'))
      return false
    }
    setHighlights(nextHighlights)
    return true
  }
  const navigate = (destination) => {
    if (destination === 'write-article') {
      createArticle()
      return
    }
    navigateTo(destination)
  }
  const openArticle = (article) => {
    setActiveArticleId(article.id)
    navigateTo(article.status === 'published' ? 'published' : 'editor')
  }
  const openSeo = (returnPage = page) => {
    setSeoReturnPage(returnPage)
    navigateTo('seo')
  }
  const openShare = (article = activeArticle) => {
    if (!article) return
    if (!articleCanPublish(article)) {
      message.warning(t('A title and body are required to share or publish.'))
      return
    }
    setActiveArticleId(article.id)
    setShareOpen(true)
  }
  const openSchedule = (article = activeArticle) => {
    if (!article) return
    if (!articleCanPublish(article)) {
      message.warning(t('A title and body are required to schedule.'))
      return
    }
    setActiveArticleId(article.id)
    setScheduleOpen(true)
  }
  const handleArticleAction = (article, action) => {
    setActiveArticleId(article.id)
    if (action === 'edit') navigateTo('editor')
    if (action === 'seo') openSeo('articles')
    if (action === 'share' || action === 'publish') openShare(article)
    if (action === 'schedule') openSchedule(article)
    if (action === 'discard') setDiscardOpen(true)
  }
  const publishArticleLocally = async () => {
    if (postingRef.current) return
    if (!activeArticle || !articleCanPublish(activeArticle)) {
      message.warning(t('A title and body are required to publish.'))
      return
    }
    const startedAt = Date.now()
    postingRef.current = true
    setPosting(true)
    try {
      await waitForPostingMinimum(startedAt)
      persistArticleStatus(getPublishedStatus())
      setShareOpen(false)
      navigateTo('published')
      setSuccessOpen(true)
      message.success(t('Post saved as published in this browser.'))
    } catch {
      notifyAppError(t('Could not publish this article. Your draft is still saved.'))
    } finally {
      postingRef.current = false
      setPosting(false)
    }
  }
  const scheduleArticleLocally = async (scheduledAt) => {
    if (postingRef.current) return false
    if (!activeArticle || !articleCanPublish(activeArticle)) {
      message.warning(t('A title and body are required to schedule.'))
      return false
    }
    const selectedTime = new Date(scheduledAt)
    if (!Number.isFinite(selectedTime.getTime()) || selectedTime <= new Date()) {
      message.warning(t('Choose a future date and time'))
      return false
    }
    const startedAt = Date.now()
    postingRef.current = true
    setPosting(true)
    try {
      await waitForPostingMinimum(startedAt)
      persistArticleStatus(getScheduledStatus(selectedTime.toISOString()))
      setScheduleOpen(false)
      message.success(t('The schedule was saved in this browser only.'))
      return true
    } catch {
      notifyAppError(t('Could not save this schedule. Your draft is still saved.'))
      return false
    } finally {
      postingRef.current = false
      setPosting(false)
    }
  }
  const confirmDiscard = () => {
    const discardedId = activeArticleId
    discardArticle(discardedId)
    setDiscardOpen(false)
    setActiveArticleId((current) => current === discardedId ? (workspace.articles.find((article) => article.id !== discardedId)?.id || null) : current)
    navigateTo('articles')
    message.success(t('Draft discarded.'))
  }


  const continueFromProfile = () => navigateTo('editor')
  const scheduleFromShare = () => { setShareOpen(false); openSchedule() }
  const changeSessionStatus = (nextStatus) => {
    try {
      if (nextStatus === 'active') sessionStorage.removeItem(SESSION_KEY)
      else sessionStorage.setItem(SESSION_KEY, nextStatus)
    } catch {
      if (nextStatus !== 'active') notifyAppError(t('The browser could not remember this session state.'))
    }
    setSessionStatus(nextStatus)
  }

  if (sessionStatus !== 'active') {
    return <LocalSessionScreen status={sessionStatus} profile={workspace.profile} onContinue={() => changeSessionStatus('active')} />
  }

  let pageContent
  if (page === 'compose') {
    pageContent = <QuickComposerPage profile={workspace.profile} posts={posts} highlights={highlights} onSaveHighlights={saveHighlightList} onCreatePost={createPost} onWriteArticle={() => createArticle()} />
  } else if (page === 'profile') {
    pageContent = <ProfilePage profile={workspace.profile} onChange={(profile) => updateWorkspace((current) => ({ ...current, profile }))} onContinue={continueFromProfile} />
  } else if (page === 'editor') {
    pageContent = <ArticleEditorPage article={activeArticle} onChange={(patch) => updateArticle(patch)} onOpenSeo={() => openSeo('editor')} onManage={() => navigateTo('articles')} onCreate={() => createArticle()} onBackHome={() => navigateTo('compose')} onDiscard={() => setDiscardOpen(true)} onPreview={() => setPreviewOpen(true)} onDownloadPdf={() => setPrintingArticle(activeArticle)} />
  } else if (page === 'seo') {
    pageContent = <SEOSettingsPage article={activeArticle} onChange={(patch) => updateArticle(patch)} onBack={() => goBack(seoReturnPage)} onContinue={() => openShare()} />
  } else if (page === 'published') {
    pageContent = <PublishedPostPage article={activeArticle} onBack={() => goBack('articles')} onEdit={() => navigateTo('editor')} onShare={() => openShare()} onDownloadPdf={() => setPrintingArticle(activeArticle)} />
  } else if (page === 'articles') {
    pageContent = <ArticlesManagementPage articles={workspace.articles} onCreate={createArticle} onOpen={openArticle} onAction={handleArticleAction} />
  } else {
    pageContent = <NotFoundPage onHome={() => navigateTo('compose')} />
  }

  return (
    <>
      <MainLayout page={page} onNavigate={navigate} saveStatus={saveStatus} themeMode={themeMode} onThemeChange={onThemeChange} language={language} onLanguageChange={onLanguageChange} profile={workspace.profile} onLock={() => changeSessionStatus('locked')} onSignOut={() => changeSessionStatus('signed-out')}>
        <Suspense fallback={<div className="screen-loading" role="status">{t('Loading…')}</div>}>
          {pageContent}
        </Suspense>
      </MainLayout>
      {printingArticle && <div id="article-print-root" aria-hidden="true"><article className="article-print-content"><header><p>{workspace.profile.name}</p><h1>{getArticleTitle(printingArticle)}</h1></header><div dangerouslySetInnerHTML={{ __html: richTextToHtml(printingArticle.body || '') }} /></article></div>}
      {previewOpen && <Suspense fallback={null}><ArticlePreviewDialog open article={activeArticle} onClose={() => setPreviewOpen(false)} onDownloadPdf={() => setPrintingArticle(activeArticle)} /></Suspense>}
      {shareOpen && <Suspense fallback={null}><ShareArticlePage open article={activeArticle} loading={posting} onClose={() => !posting && setShareOpen(false)} onPublishLocal={publishArticleLocally} onSchedule={scheduleFromShare} onDownloadPdf={() => setPrintingArticle(activeArticle)} /></Suspense>}
      {scheduleOpen && <Suspense fallback={null}><SchedulePostPage open article={activeArticle} loading={posting} onClose={() => !posting && setScheduleOpen(false)} onSchedule={scheduleArticleLocally} /></Suspense>}
      {successOpen && <Suspense fallback={null}><PublishSuccessPage open article={activeArticle} onClose={() => setSuccessOpen(false)} onView={() => { setSuccessOpen(false); navigateTo('published') }} /></Suspense>}
      {discardOpen && <Suspense fallback={null}><DiscardDraftDialog open article={activeArticle} onCancel={() => setDiscardOpen(false)} onConfirm={confirmDiscard} /></Suspense>}
    </>
  )
}

const THEME_STORAGE_KEY = 'jeyamohan-articles-theme-v1'
const LANGUAGE_STORAGE_KEY = 'jeyamohan-articles-language-v1'

function loadThemeMode() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function loadLanguage() {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'ta' ? 'ta' : 'en'
  } catch {
    return 'en'
  }
}

export default function App() {
  const [themeMode, setThemeMode] = useState(loadThemeMode)
  const [language, setLanguage] = useState(loadLanguage)
  const isDark = themeMode === 'dark'

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = themeMode
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeMode)
    } catch {
      // Theme still applies for the current session if browser storage is unavailable.
    }
  }, [themeMode])

  useLayoutEffect(() => {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    } catch {
      // Language still applies for the current session if storage is unavailable.
    }
  }, [language])

  const themeConfig = {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: isDark ? '#f5f5f5' : '#111111',
      colorText: isDark ? '#eeeeee' : '#171717',
      colorTextSecondary: isDark ? '#b4b4b4' : '#777777',
      colorBgBase: isDark ? '#151515' : '#ffffff',
      colorBgLayout: isDark ? '#101010' : '#f7f7f7',
      colorBgContainer: isDark ? '#1c1c1c' : '#ffffff',
      colorBorder: isDark ? '#ffffff' : '#e5e5e5',
      colorBorderSecondary: isDark ? '#ffffff' : '#e5e5e5',
      colorInfo: isDark ? '#eeeeee' : '#111111',
      colorWarning: isDark ? '#dddddd' : '#444444',
      colorError: isDark ? '#eeeeee' : '#111111',
      colorSuccess: isDark ? '#eeeeee' : '#111111',
      borderRadius: 10,
      controlHeight: 40,
      fontFamily: "'Noto Sans Tamil', 'Latha', 'Nirmala UI', sans-serif",
    },
  }

  return (
    <LanguageProvider language={language}>
      <ConfigProvider theme={themeConfig} locale={language === 'ta' ? taIN : enUS}>
        <AntApp>
          <ErrorNotificationHost />
          <SystemErrorBoundary>
            <AppContent themeMode={themeMode} onThemeChange={(checked) => setThemeMode(checked ? 'dark' : 'light')} language={language} onLanguageChange={setLanguage} />
          </SystemErrorBoundary>
        </AntApp>
      </ConfigProvider>
    </LanguageProvider>
  )
}
