import { ChevronDown, ChevronUp, CornerUpLeft, Send, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { json, message, request, type Member, type Post, type PublishedReply, type Reply } from './api'
import { Avatar, dateLabel } from './Content'

type Page = { items: Reply[]; cursor: number | null }
type Thread = { open: boolean; page?: Page; loading?: boolean; error?: string }
const pageFrom = (items: Reply[]): Page => ({ items, cursor: items.length === 30 ? items.at(-1)!.id : null })

function mergeComments(first: Reply[], second: Reply[]) {
  return Array.from(new Map([...first, ...second].map(item => [item.id, item])).values())
    .sort((a, b) => b.id - a.id)
}

export function Comments({ post, viewer, onReply }: { post: Post; viewer: Member; onReply: (total: number) => void }) {
  const [roots, setRoots] = useState<Page>()
  const [threads, setThreads] = useState<Record<number, Thread>>({})
  const [target, setTarget] = useState<Reply>()
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadingRoots, setLoadingRoots] = useState(false)
  const [listError, setListError] = useState('')
  const [writeError, setWriteError] = useState('')
  const input = useRef<HTMLTextAreaElement>(null)
  const path = `/posts/${post.id}/comments`

  useEffect(() => {
    const controller = new AbortController()
    request<Reply[]>(path, { signal: controller.signal }).then(list => {
      if (!controller.signal.aborted) setRoots(pageFrom(list))
    }).catch(error => { if (!controller.signal.aborted) setListError(message(error)) })
    return () => controller.abort()
  }, [path])

  async function loadRoots(before?: number) {
    setLoadingRoots(true)
    setListError('')
    try {
      const page = pageFrom(await request<Reply[]>(path + (before ? '?before=' + before : '')))
      setRoots(previous => ({ ...page, items: before ? mergeComments(previous?.items ?? [], page.items) : page.items }))
    } catch (error) {
      setListError(message(error))
    } finally {
      setLoadingRoots(false)
    }
  }

  async function openThread(id: number, before?: number) {
    setThreads(previous => ({
      ...previous,
      [id]: { ...previous[id], open: true, loading: true, error: '' },
    }))
    try {
      const page = pageFrom(await request<Reply[]>(`${path}/${id}/replies${before ? '?before=' + before : ''}`))
      setThreads(previous => {
        const existing = previous[id].page?.items ?? []
        return { ...previous, [id]: { ...previous[id], loading: false, page: {
          ...page, items: mergeComments(existing, page.items),
        } } }
      })
    } catch (error) {
      setThreads(previous => ({
        ...previous, [id]: { ...previous[id], loading: false, error: message(error) },
      }))
    }
  }

  function selectReply(item: Reply) {
    setTarget(item)
    setWriteError('')
    input.current?.focus()
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!roots || busy || !body.trim()) return
    setBusy(true)
    setWriteError('')
    try {
      const result = await request<PublishedReply>(path, json('POST', { body, replyToId: target?.id }))
      const item = result.comment
      setBody('')
      setTarget(undefined)
      onReply(result.commentCount)
      if (item.parentId === null) {
        setRoots(previous => previous && { ...previous, items: mergeComments([item], previous.items) })
      } else {
        const id = item.parentId
        setRoots(previous => previous && { ...previous, items: previous.items.map(root => root.id === id
          ? { ...root, replyCount: result.threadCount } : root) })
        // Show the saved reply immediately, even when loading the rest of the discussion fails.
        setThreads(previous => ({
          ...previous, [id]: { ...previous[id], open: true, page: {
            items: mergeComments([item], previous[id]?.page?.items ?? []),
            cursor: previous[id]?.page?.cursor ?? null,
          } },
        }))
        if (!threads[id]?.page) void openThread(id)
      }
      requestAnimationFrame(() => document.getElementById('comment-' + item.id)?.scrollIntoView({ block: 'nearest' }))
    } catch (error) {
      setWriteError(message(error))
    } finally {
      setBusy(false)
    }
  }

  function comment(item: Reply, children?: ReactNode) {
    return <div id={'comment-' + item.id} className="reply" key={item.id}>
      <Avatar member={item.author} size="small" />
      <div className="reply-body">
        <div className="reply-byline"><strong>{item.author.name}</strong><time dateTime={item.publishedAt}>{dateLabel(item.publishedAt)}</time></div>
        <p>{item.replyToName && <span className="reply-recipient">回复 {item.replyToName}　</span>}{item.body}</p>
        <div className="reply-actions">
          <button className="entry-action" type="button" disabled={busy} onClick={() => selectReply(item)}
            aria-label={`回复 ${item.author.name}`}><CornerUpLeft size={14} /> 回复</button>
          {children}
        </div>
      </div>
    </div>
  }

  return <section id="comments" className="surface comments">
    <h2>评论 <span>{post.replies}</span></h2>
    {target && <div className="reply-target"><span>回复 <strong>{target.author.name}</strong></span>
      <button className="icon-button" type="button" aria-label="取消回复" disabled={busy} onClick={() => { setTarget(undefined); input.current?.focus() }}><X size={16} /></button>
    </div>}
    <form className="comment-compose" onSubmit={submit}>
      <Avatar member={viewer} size="small" />
      <textarea ref={input} rows={2} aria-label={target ? '回复内容' : '评论内容'} placeholder={target ? `回复 ${target.author.name}…` : '聊聊你怎么看…'}
        maxLength={1000} value={body} readOnly={busy} onChange={event => setBody(event.target.value)} />
      <button className="primary" disabled={!roots || busy || !body.trim()}><Send size={15} /> {busy ? '发送中' : '发送'}</button>
    </form>
    {writeError && <p className="error" role="alert">{writeError}</p>}
    {listError && <div className="comment-feedback"><p className="error" role="alert">{listError}</p>
      <button className="plain" disabled={loadingRoots} onClick={() => void loadRoots(roots?.cursor ?? undefined)}>重试</button>
    </div>}
    {!roots && !listError && <p className="muted" role="status">正在加载评论…</p>}
    {roots?.items.length === 0 && <p className="muted">还没有评论</p>}
    {roots?.items.map(item => {
      const thread = threads[item.id]
      return <div key={item.id}>
        {comment(item, item.replyCount > 0 && <button className="entry-action thread-toggle" type="button" aria-expanded={Boolean(thread?.open)}
          onClick={() => {
            if (thread?.open || thread?.page || thread?.loading) {
              setThreads(previous => ({ ...previous, [item.id]: { ...previous[item.id], open: !thread.open } }))
            } else {
              void openThread(item.id)
            }
          }}>
          {thread?.open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          {thread?.open ? '收起回复' : `${item.replyCount} 条回复`}
        </button>)}
        {thread?.open && <div className="thread" aria-label={`${item.author.name} 的评论回复`}>
          {thread.page?.items.map(reply => comment(reply))}
          {thread.loading && <p className="muted" role="status">正在加载回复…</p>}
          {thread.error && <div className="comment-feedback"><p className="error" role="alert">{thread.error}</p>
            <button className="plain" onClick={() => void openThread(item.id, thread.page?.cursor ?? undefined)}>重试</button>
          </div>}
          {thread.page?.cursor && !thread.error && !thread.loading && <button className="plain" type="button"
            onClick={() => void openThread(item.id, thread.page?.cursor ?? undefined)}>加载更多回复</button>}
        </div>}
      </div>
    })}
    {roots?.cursor && !listError && <button className="secondary" disabled={loadingRoots} onClick={() => void loadRoots(roots.cursor ?? undefined)}>
      {loadingRoots ? '加载中' : '加载更多评论'}
    </button>}
  </section>
}
