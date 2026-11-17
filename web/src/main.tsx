import {
  ArrowLeft, ArrowRight, BookOpen, Bookmark, Check, Code2, Hash, Heart, House, Link2, LogOut,
  MessageCircle, MoreHorizontal, Plus, Search, Users, X,
} from 'lucide-react'
import { useEffect, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import 'highlight.js/styles/github-dark.css'
import { json, message, readSession, request, type Member, type Post, type Session, type Topic } from './api'
import { Composer } from './Composer'
import { Comments } from './Comments'
import { Avatar, Body, copyText, dateLabel, previewText } from './Content'
import './style.css'

type Navigate = (path: string) => void

function NavLink({ path, go, className, children, current }: {
  path: string; go: Navigate; className?: string; children: ReactNode; current?: boolean
}) {
  function follow(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    go(path)
  }
  return <a className={className} href={path} onClick={follow} aria-current={current ? 'page' : undefined}>{children}</a>
}

function Brand() {
  return <span className="brand"><span className="brand-mark"><Code2 size={24} strokeWidth={2.4}/></span>Share<span className="brand-accent">Hub</span></span>
}

function Login({ demo, accepted }: { demo: boolean; accepted: (value: Session) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function signIn(name: string, secret: string) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await request('/login', { method: 'POST', body: new URLSearchParams({ username: name, password: secret }) })
      accepted(await readSession())
    } catch (caught) {
      setError(message(caught))
    } finally {
      setBusy(false)
    }
  }

  return <main className="login-layout">
    <section className="login-card surface">
      <Brand />
      <h1>登录研发工作区</h1>
      <form onSubmit={event => { event.preventDefault(); void signIn(username, password) }}>
        <label>账号 <input required autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} /></label>
        <label>密码 <input required type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} /></label>
        {error && <p role="alert" className="error">{error}</p>}
        <button className="primary" disabled={busy}>登录 <ArrowRight size={17}/></button>
        {demo && <button type="button" className="secondary" disabled={busy} onClick={() => void signIn('demo', 'ShareHub123!')}>使用演示账号</button>}
      </form>
    </section>
  </main>
}

function Entry({ post, viewer, go, onUpdate, onRemove, full = false, filter }: {
  post: Post; viewer: Member; go: Navigate; onUpdate: (post: Post, edited?: boolean) => void
  onRemove: () => void; full?: boolean; filter: (name: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const path = '/posts/' + post.id
  const text = previewText(post.body, full)
  const own = post.author.id === viewer.id
  const saved = post.favoriteId != null

  async function like() {
    setBusy(true)
    setError('')
    try { onUpdate(await request<Post>(path + '/like', json('PUT', { liked: !post.liked }))) }
    catch (caught) { setError(message(caught)) }
    finally { setBusy(false) }
  }

  async function favorite() {
    setBusy(true)
    setError('')
    try { onUpdate(await request<Post>(path + '/favorite', json('PUT', { saved: !saved }))) }
    catch (caught) { setError(message(caught)) }
    finally { setBusy(false) }
  }

  async function remove() {
    setBusy(true)
    setError('')
    try { await request(path, { method: 'DELETE' }); onRemove() }
    catch (caught) { setError(message(caught)) }
    finally { setBusy(false) }
  }

  async function copyLink() {
    setError('')
    try {
      await copyText(new URL(path, window.location.origin).href)
      setCopied(true)
    } catch {
      setError('复制失败，请从详情页地址栏复制链接')
    }
  }

  if (editing) return <Composer viewer={viewer} post={post} onSave={saved => { onUpdate(saved, true); setEditing(false) }} onCancel={() => setEditing(false)} />

  return <article className="surface entry">
    <header className="entry-header">
      <Avatar member={post.author} />
      <div className="author">
        <strong>{post.author.name}</strong>
        <span>{post.author.team}<span className="dot">·</span><time dateTime={post.publishedAt} title={new Date(post.publishedAt).toLocaleString('zh-CN')}>{dateLabel(post.publishedAt)}</time></span>
      </div>
      {(own || viewer.admin) && <details className="entry-menu">
        <summary className="icon-button" aria-label="动态操作"><MoreHorizontal size={22}/></summary>
        <div className="menu">
          {own && <button onClick={() => setEditing(true)}>编辑动态</button>}
          <button className="danger-text" onClick={event => {
            event.currentTarget.closest('details')?.removeAttribute('open')
            setConfirmDelete(true)
          }}>删除动态</button>
        </div>
      </details>}
    </header>
    {post.title && (full ? <h1>{post.title}</h1> : <h2><NavLink path={path} go={go}>{post.title}</NavLink></h2>)}
    {text && <Body text={text} />}
    {text !== post.body && <NavLink path={path} go={go} className="read-more">阅读全文 <ArrowRight size={15}/></NavLink>}
    {post.images.length > 0 && <div className={`entry-images ${post.images.length === 1 ? 'single' : ''}`}>
      {post.images.map((image, index) => <a key={image} href={`/api/media/${image}`} target="_blank" rel="noreferrer">
        <img src={`/api/media/${image}`} loading="lazy" alt={`分享图片 ${index + 1}`} />
      </a>)}
    </div>}
    {post.tags.length > 0 && <div className="chips">{post.tags.map(tag => <button className="chip" key={tag} onClick={() => filter(tag)}># {tag}</button>)}</div>}
    {error && <p className="error" role="alert">{error}</p>}
    {confirmDelete && <div className="delete-confirm">
      <span>确认删除这条动态？</span><div className="actions">
        <button className="plain" disabled={busy} onClick={() => setConfirmDelete(false)}>取消</button>
        <button className="danger" disabled={busy} onClick={() => void remove()}>删除</button>
      </div>
    </div>}
    <footer className="entry-footer">
      <button className={`entry-action ${post.liked ? 'liked' : ''}`} disabled={busy} aria-pressed={post.liked}
        aria-label={`点赞 ${post.likes}`} onClick={() => void like()}><Heart size={17}/> {post.likes}</button>
      <NavLink path={full ? path + '#comments' : path} go={go} className="entry-action"><MessageCircle size={17}/> <span>{post.replies} 条评论</span></NavLink>
      <button className={`entry-action favorite-action ${saved ? 'saved' : ''}`} disabled={busy} aria-pressed={saved}
        onClick={() => void favorite()}><Bookmark size={17} /> <span>{saved ? '已收藏' : '收藏'}</span></button>
      <button className="entry-action share-link" onClick={() => void copyLink()}>
        {copied ? <Check size={17}/> : <Link2 size={17}/>} <span aria-live="polite">{copied ? '链接已复制' : '分享链接'}</span>
      </button>
    </footer>
  </article>
}

function Members() {
  const [members, setMembers] = useState<Member[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState('')
  useEffect(() => {
    request<Member[]>('/members').then(setMembers).catch(caught => setError(message(caught)))
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setError('')
    setCreated('')
    setBusy(true)
    try {
      const member = await request<Member>('/members', json('POST', Object.fromEntries(new FormData(form))))
      setMembers(previous => [...previous, member])
      setCreated(`已为 ${member.name} 开通账号`)
      form.reset()
    } catch (caught) {
      setError(message(caught))
    } finally {
      setBusy(false)
    }
  }

  return <>
    <div className="feed-heading"><h1>成员管理</h1></div>
    <section className="surface members">
      <h2>开通研发账号</h2>
      <form onSubmit={submit}>
        <label>姓名<input name="name" required maxLength={60} /></label>
        <label>团队<input name="team" placeholder="研发部" maxLength={60} /></label>
        <label>账号<input name="username" required autoComplete="off" pattern="[a-z0-9._\-]{3,40}" title="3 到 40 个小写字母、数字或 ._-" /></label>
        <label>初始密码<input type="password" name="password" required minLength={12} autoComplete="new-password" /></label>
        <button className="primary" disabled={busy}>创建账号</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      {created && <p role="status">{created}</p>}
    </section>
    <section className="surface members">
      <h2>已开通的成员</h2>
      {members.map(member => <div key={member.id} className="member-row"><Avatar member={member} size="small"/>
        <strong>{member.name}</strong><span className="muted">{member.team}{member.admin ? ' · 管理员' : ''}</span></div>)}
    </section>
  </>
}

function Workspace({ viewer, signOut }: { viewer: Member; signOut: () => void }) {
  const [route, setRoute] = useState(window.location.pathname + window.location.search)
  const [items, setItems] = useState<Post[] | null>(null)
  const [detail, setDetail] = useState<Post | null>(null)
  const [topics, setTopics] = useState<Topic[]>([])
  const [error, setError] = useState('')
  const [topicError, setTopicError] = useState('')
  const [topicRefresh, setTopicRefresh] = useState(0)
  const [search, setSearch] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [cursor, setCursor] = useState<number | null>(null)
  const index = new URL(route, window.location.origin)
  const mine = index.pathname === '/mine'
  const favorites = index.pathname === '/favorites'
  const members = index.pathname === '/members' && viewer.admin
  const postId = index.pathname.match(/^\/posts\/(\d+)$/)?.[1]
  const tag = index.searchParams.get('tag') ?? ''
  const q = index.searchParams.get('q') ?? ''
  const feedPath = '/posts?' + new URLSearchParams({ tag, q, mine: String(mine), favorites: String(favorites) })

  function go(path: string) {
    const next = new URL(path, window.location.origin)
    const nextRoute = next.pathname + next.search
    if (window.location.pathname + window.location.search + window.location.hash !== path) window.history.pushState(null, '', path)
    if (nextRoute !== route) {
      setItems(null)
      setCursor(null)
      setDetail(null)
      setError('')
      setRoute(nextRoute)
      window.scrollTo(0, 0)
    }
    if (nextRoute === route && !next.hash) window.scrollTo(0, 0)
    if (next.hash) requestAnimationFrame(() => document.getElementById(next.hash.slice(1))?.scrollIntoView({ behavior: 'instant' }))
  }

  useEffect(() => {
    function back() {
      setDetail(null)
      setItems(null)
      setCursor(null)
      setError('')
      setRoute(window.location.pathname + window.location.search)
      setRefresh(value => value + 1)
    }
    window.addEventListener('popstate', back)
    return () => window.removeEventListener('popstate', back)
  }, [])

  useEffect(() => { setSearch(q) }, [q])

  function nextCursor(list: Post[]) {
    if (list.length < 15) return null
    const last = list.at(-1)!
    return favorites ? last.favoriteId : last.id
  }
  useEffect(() => {
    const controller = new AbortController()
    if (members) return
    if (postId) {
      request<Post>('/posts/' + postId, { signal: controller.signal }).then(setDetail)
        .catch(caught => { if (!controller.signal.aborted) setError(message(caught)) })
    } else {
      request<Post[]>(feedPath, { signal: controller.signal }).then(list => { setItems(list); setCursor(nextCursor(list)) })
        .catch(caught => { if (!controller.signal.aborted) setError(message(caught)) })
    }
    return () => controller.abort()
  }, [feedPath, postId, members, refresh, favorites])

  useEffect(() => {
    request<Topic[]>('/topics').then(value => { setTopics(value); setTopicError('') })
      .catch(caught => setTopicError(message(caught)))
  }, [refresh, topicRefresh])

  useEffect(() => {
    if (detail && window.location.hash === '#comments') document.getElementById('comments')?.scrollIntoView()
  }, [detail?.id])

  function filter(name: string) { go('/?' + new URLSearchParams({ tag: name })) }
  function update(post: Post, edited = false) {
    setItems(previous => previous?.flatMap(item => {
      if (item.id !== post.id) return [item]
      const matchesTag = !tag || post.tags.some(value => value.toLowerCase() === tag.toLowerCase())
      if (!matchesTag || (favorites && post.favoriteId == null)) return []
      return [post]
    }) ?? null)
    if (postId) setDetail(post)
    if (edited) setTopicRefresh(value => value + 1)
  }

  function focusComposer() {
    if (postId || members || mine || favorites || q || tag) go('/')
    requestAnimationFrame(() => document.getElementById('share-body')?.focus())
  }

  async function loadMore() {
    if (!cursor) return
    setLoadingMore(true)
    setError('')
    try {
      const list = await request<Post[]>(feedPath + '&before=' + cursor)
      if (window.location.pathname + window.location.search !== route) return
      setItems(previous => [...previous ?? [], ...list])
      setCursor(nextCursor(list))
    } catch (caught) {
      setError(message(caught))
    } finally {
      setLoadingMore(false)
    }
  }

  return <>
    <header className="topbar">
      <a className="skip-link" href="#main">跳到主要内容</a>
      <div className="topbar-inner">
        <NavLink path="/" go={go} className="brand-link"><Brand /></NavLink>
        <form className="search" role="search" onSubmit={event => {
          event.preventDefault()
          go(search.trim() ? '/?' + new URLSearchParams({ q: search.trim() }) : '/')
        }}>
          <Search size={18} />
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索关键词…" aria-label="搜索动态" maxLength={120}/>
          {search && <button type="button" className="icon-button" aria-label="清空搜索" onClick={() => { setSearch(''); if (q) go('/') }}><X size={15}/></button>}
        </form>
        <button className="top-account" onClick={signOut} aria-label="退出登录" title="退出登录">
          <Avatar member={viewer} size="small"/><span>{viewer.name}</span><LogOut size={16}/>
        </button>
      </div>
    </header>
    <div className="layout">
      <aside className="left-rail">
        <nav aria-label="工作区导航" className="navigation">
          <div className="nav-caption">工作区</div>
          <NavLink path="/" go={go} className={`nav-item ${!mine && !favorites && !postId && !members ? 'active' : ''}`} current={index.pathname === '/' && !q && !tag}><House size={19}/> <span>最新动态</span></NavLink>
          <NavLink path="/mine" go={go} className={`nav-item ${mine ? 'active' : ''}`} current={mine}><BookOpen size={18}/> <span>我的分享</span></NavLink>
          <NavLink path="/favorites" go={go} className={`nav-item ${favorites ? 'active' : ''}`} current={favorites}><Bookmark size={18}/> <span>我的收藏</span></NavLink>
          {viewer.admin && <NavLink path="/members" go={go} className={`nav-item ${members ? 'active' : ''}`} current={members}><Users size={19}/> <span>成员管理</span></NavLink>}
        </nav>
        <button className="primary rail-compose" onClick={focusComposer}><Plus size={20}/> 写分享</button>
      </aside>

      <main className="main-pane" id="main" tabIndex={-1}>
        {members ? <Members /> : postId ? <>
          <NavLink path="/" go={go} className="back"><ArrowLeft size={17}/> 返回动态</NavLink>
          {detail && <><Entry key={detail.id} post={detail} viewer={viewer} go={go} full filter={filter}
            onUpdate={update} onRemove={() => { go('/'); setRefresh(value => value + 1) }} />
            <Comments key={detail.id} post={detail} viewer={viewer} onReply={total => {
              setDetail(previous => previous ? { ...previous, replies: total } : previous)
            }} /></>}
        </> : <>
          <div className="feed-heading">
            <div className="workspace-name"><span></span> 研发工作区</div>
            <h1>{q ? '搜索结果' : tag ? '# ' + tag : mine ? '我的分享' : favorites ? '我的收藏' : '最新动态'}</h1>
            {q && <p>包含「{q}」的动态</p>}
          </div>
          {!mine && !favorites && !q && !tag && <Composer viewer={viewer} onSave={post => {
            setItems(previous => [post, ...previous ?? []])
            setRefresh(value => value + 1)
          }} />}
          {(q || tag) && <NavLink path="/" go={go} className="back"><ArrowLeft size={17}/> 返回最新动态</NavLink>}
          {items?.length === 0 && !cursor && !error && <section className="surface empty">
            <BookOpen size={26}/><p>{q || tag ? '没有找到匹配的分享' : favorites ? '还没有收藏' : '还没有分享'}</p>
          </section>}
          {items?.map(post => <Entry key={post.id} post={post} viewer={viewer} go={go} filter={filter} onUpdate={update}
            onRemove={() => { setItems(previous => previous?.filter(item => item.id !== post.id) ?? null); setRefresh(value => value + 1) }} />)}
          {cursor && <button className="secondary load-more" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? '加载中' : '加载更多'}</button>}
        </>}
        {error && <div className="surface async-state"><p className="error" role="alert">{error}</p><button className="secondary" onClick={() => { setError(''); setRefresh(value => value + 1) }}>重试</button></div>}
        {!error && !members && !(postId ? detail : items) && <p role="status" className="async-state muted">正在加载动态…</p>}
      </main>

      <aside className="right-rail">
        <section className="surface topics">
          <h2><span className="topic-icon"><Hash size={17}/></span> 话题</h2>
          {topics.length > 0 ? <ul>{topics.map(topic => <li key={topic.id}>
            <button className={tag.toLowerCase() === topic.name.toLowerCase() ? 'selected' : ''} onClick={() => filter(topic.name)}>
              <span><span className="hash">#</span> {topic.name}</span><span className="topic-count" title={`${topic.count} 条分享`}>{topic.count}</span>
            </button>
          </li>)}</ul> : <p className="muted">{topicError || '还没有话题'}</p>}
        </section>
        <div className="internal"><span></span> 仅研发工作区成员可见</div>
      </aside>
    </div>
  </>
}

function App() {
  const [session, setSession] = useState<Session>()
  const [error, setError] = useState('')

  async function load() {
    setError('')
    try { setSession(await readSession()) }
    catch (caught) { setError(message(caught)) }
  }

  useEffect(() => {
    void load()
    const expired = () => void load()
    window.addEventListener('sharehub:expired', expired)
    return () => window.removeEventListener('sharehub:expired', expired)
  }, [])

  async function signOut() {
    try {
      await request('/logout', { method: 'POST' })
      setSession(await readSession())
    } catch (caught) {
      setError(message(caught))
    }
  }

  if (error) return <main className="login-layout"><section className="surface login-card"><Brand/><p className="error" role="alert">{error}</p><button className="primary" onClick={() => void load()}>重试</button></section></main>
  if (!session) return <main className="login-layout"><p role="status" className="muted">正在连接工作区…</p></main>
  if (!session.user) return <Login demo={session.demo} accepted={setSession} />
  return <Workspace viewer={session.user} signOut={() => void signOut()} />
}

createRoot(document.getElementById('root')!).render(<App />)
