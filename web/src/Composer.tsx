import { ChevronDown, Code2, Hash, ImagePlus, Send, Type, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Avatar } from './Content'
import { json, message, request, type Draft, type Member, type Post, type Topic } from './api'

const languages = ['纯文本', 'Java', 'JavaScript', 'TypeScript', 'Python', 'SQL', 'Bash', 'JSON', 'YAML', 'CSS', 'HTML']

export function Composer({ viewer, post, onSave, onCancel }: {
  viewer: Member; post?: Post; onSave: (entry: Post) => void; onCancel?: () => void
}) {
  const [title, setTitle] = useState(post?.title ?? '')
  const [body, setBody] = useState(post?.body ?? '')
  const [tags, setTags] = useState(post?.tags ?? [])
  const [tagText, setTagText] = useState('')
  const [showTitle, setShowTitle] = useState(Boolean(post?.title))
  const [showTags, setShowTags] = useState(false)
  const [suggestions, setSuggestions] = useState<{ query: string; items: Topic[] }>({ query: '', items: [] })
  const [suggestionError, setSuggestionError] = useState('')
  const tagInput = useRef<HTMLInputElement>(null)
  const tagQuery = tagText.trim().replace(/^#/, '')
  const suggested = suggestions.query === tagQuery
    ? suggestions.items.filter(topic => !tags.some(tag => tag.toLowerCase() === topic.name.toLowerCase()))
    : []
  const [showCode, setShowCode] = useState(false)
  const [language, setLanguage] = useState('纯文本')
  const [code, setCode] = useState('')
  const [files, setFiles] = useState<{ file: File; url: string }[]>([])
  const urls = useRef(new Set<string>())
  const input = useRef<HTMLTextAreaElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const codeInput = useRef<HTMLTextAreaElement>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const current = urls.current
    return () => current.forEach(url => URL.revokeObjectURL(url))
  }, [])
  useEffect(() => { if (showCode) codeInput.current?.focus() }, [showCode])

  useEffect(() => { if (showTags) tagInput.current?.focus() }, [showTags])
  useEffect(() => {
    if (!showTags) return
    const controller = new AbortController()
    setSuggestionError('')
    const timer = window.setTimeout(() => {
      request<Topic[]>('/topics?' + new URLSearchParams({ q: tagQuery }), { signal: controller.signal })
        .then(items => { if (!controller.signal.aborted) setSuggestions({ query: tagQuery, items }) })
        .catch(() => { if (!controller.signal.aborted) setSuggestionError('暂时无法加载已有标签') })
    }, tagQuery ? 150 : 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [showTags, tagQuery])

  function selectFiles(list: FileList | null) {
    if (!list) return
    setError('')
    const chosen = Array.from(list)
    if (chosen.length + files.length > 4) return setError('最多添加 4 张图片')
    if (chosen.some(file => !['image/png', 'image/jpeg', 'image/webp'].includes(file.type))) {
      return setError('请选择 PNG、JPEG 或 WebP 图片')
    }
    if (chosen.some(file => file.size > 5 * 1024 * 1024)) return setError('每张图片不能超过 5 MB')
    setFiles([...files, ...chosen.map(file => {
      const url = URL.createObjectURL(file)
      urls.current.add(url)
      return { file, url }
    })])
  }

  function draftTags(selected?: string) {
    const label = selected ?? suggested.find(topic => topic.name.toLowerCase() === tagQuery.toLowerCase())?.name ?? tagQuery
    if (!label) return tags
    if (!/^[\p{L}\p{N}_+.#-]{1,24}$/u.test(label)) throw new Error('请输入 1 到 24 个字符的标签')
    if (tags.some(tag => tag.toLowerCase() === label.toLowerCase())) return tags
    if (tags.length === 6) throw new Error('每条动态最多添加 6 个标签')
    return [...tags, label]
  }

  function addTag(selected?: string) {
    try {
      setTags(draftTags(selected))
      tagInput.current?.focus()
      setTagText('')
      setError('')
    } catch (caught) {
      setError(message(caught))
    }
  }

  function addCode() {
    const delimiter = '`'.repeat(Math.max(3, ...(code.match(/`+/g) ?? []).map(match => match.length + 1)))
    const text = `${body.trimEnd() ? body.trimEnd() + '\n\n' : ''}${delimiter}${language === '纯文本' ? '' : language.toLowerCase()}\n${code.replace(/\n$/, '')}\n${delimiter}\n`
    if (text.length > 12000) return setError('正文最多 12000 字')
    setBody(text)
    setCode('')
    setShowCode(false)
    setError('')
    input.current?.focus()
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || showCode) return
    setError('')
    setBusy(true)
    try {
      const draft: Draft = { title, body, tags: draftTags() }
      let saved: Post
      if (post) {
        saved = await request<Post>(`/posts/${post.id}`, json('PUT', draft))
      } else {
        const data = new FormData()
        data.append('draft', new Blob([JSON.stringify(draft)], { type: 'application/json' }))
        files.forEach(({ file }) => data.append('images', file))
        saved = await request<Post>('/posts', { method: 'POST', body: data })
      }
      setTitle('')
      setBody('')
      setTags([])
      setTagText('')
      urls.current.forEach(url => URL.revokeObjectURL(url))
      urls.current.clear()
      setFiles([])
      setShowTitle(false)
      setShowTags(false)
      onSave(saved)
    } catch (caught) {
      setError(message(caught))
    } finally {
      setBusy(false)
    }
  }

  return <form className="surface composer" id={post ? undefined : 'composer'} onSubmit={submit}>
    <div className="compose-main">
      <Avatar member={viewer} />
      <div className="compose-fields">
        {showTitle && <input className="compose-title" maxLength={120} value={title} onChange={event => setTitle(event.target.value)} placeholder="给这条分享加个标题（选填）" aria-label="标题" />}
        <textarea id={post ? undefined : 'share-body'} className="compose-message" ref={input} value={body}
          onChange={event => setBody(event.target.value)} rows={body.split('\n').length > 3 ? 6 : 2}
          placeholder="今天想分享点什么？" maxLength={12000} aria-label="分享正文" />
        {files.length > 0 && <div className="thumbnails">{files.map(({ file, url }) => <div key={url}>
          <img src={url} alt={file.name} />
          <button type="button" className="remove-image" aria-label={`移除图片 ${file.name}`} onClick={() => {
            URL.revokeObjectURL(url)
            urls.current.delete(url)
            setFiles(files.filter(image => image.url !== url))
          }}><X size={15} /></button>
        </div>)}</div>}
        {tags.length > 0 && <div className="chips">{tags.map(tag => <button key={tag} type="button" className="chip" onClick={() => setTags(tags.filter(value => value !== tag))} aria-label={`移除标签 ${tag}`}># {tag} <X size={12} /></button>)}</div>}
        {showTags && <div className="tag-picker">
          <div className="inline-input">
            <input ref={tagInput} aria-label="查找或添加标签" placeholder="搜索标签或输入新标签" maxLength={25}
              value={tagText} onChange={event => setTagText(event.target.value)} onKeyDown={event => {
                if (event.nativeEvent.isComposing) return
                if (event.key === 'Enter') { event.preventDefault(); addTag() }
                if (event.key === 'Escape') { event.preventDefault(); setShowTags(false) }
              }} />
            <button type="button" className="plain" onClick={() => addTag()} disabled={!tagQuery}>添加</button>
          </div>
          {suggested.length > 0 && <div className="tag-suggestions" aria-label="已有标签">
            {suggested.map(topic => <button key={topic.id} type="button" className="chip" onClick={() => addTag(topic.name)}>
              # {topic.name}
            </button>)}
          </div>}
          {suggestionError && <p className="muted" role="status">{suggestionError}</p>}
        </div>}
        {showCode && <div className="code-editor">
          <div className="between"><label>语言 <select value={language} onChange={event => setLanguage(event.target.value)}>
            {languages.map(value => <option key={value}>{value}</option>)}</select><ChevronDown size={14} /></label>
            <button type="button" className="icon-button" aria-label="关闭代码编辑" onClick={() => setShowCode(false)}><X size={17} /></button></div>
          <textarea ref={codeInput} rows={5} aria-label="代码内容" value={code} maxLength={12000} onChange={event => setCode(event.target.value)} placeholder="粘贴代码" />
          <button type="button" className="primary" disabled={!code.trim()} onClick={addCode}>插入代码</button>
        </div>}
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </div>
    <div className="composer-footer">
      <div className="tools">
        {!post && <><input ref={fileInput} hidden type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={event => {
          selectFiles(event.target.files)
          event.currentTarget.value = ''
        }} />
        <button className="tool" type="button" onClick={() => fileInput.current?.click()} aria-label="添加图片"><ImagePlus size={17} /> <span>图片</span></button></>}
        <button className="tool" type="button" onClick={() => setShowCode(!showCode)} aria-expanded={showCode} aria-label="添加代码块"><Code2 size={18} /> <span>代码</span></button>
        <button className="tool" type="button" onClick={() => setShowTags(!showTags)} aria-expanded={showTags} aria-label="添加标签"><Hash size={16} /> <span>标签</span></button>
        <button className="tool" type="button" onClick={() => setShowTitle(!showTitle)} aria-expanded={showTitle} aria-label="添加标题"><Type size={17} /> <span>标题</span></button>
      </div>
      <div className="actions">
        {onCancel && <button className="plain" type="button" onClick={onCancel}>取消</button>}
        <button className="primary" disabled={busy || showCode || !(title.trim() || body.trim() || files.length || post?.images.length)}>
          <Send size={15} /> {busy ? '提交中' : post ? '保存' : '发布'}
        </button>
      </div>
    </div>
  </form>
}
