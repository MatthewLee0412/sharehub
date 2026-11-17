export type Member = { id: number; name: string; team: string; color: string; admin: boolean }
export type Post = {
  id: number; author: Member; title: string; body: string; tags: string[]; images: string[]
  publishedAt: string; likes: number; replies: number; liked: boolean; favoriteId: number | null
}
export type Reply = {
  id: number; body: string; author: Member; publishedAt: string
  parentId: number | null; replyToId: number | null; replyToName: string | null; replyCount: number
}
export type PublishedReply = { comment: Reply; commentCount: number; threadCount: number }
export type Topic = { id: number; name: string; count: number }
export type Draft = { title: string; body: string; tags: string[] }
export type Session = { user: Member | null; csrfHeader: string; csrfToken: string; demo: boolean }

let session: Session | undefined

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  const method = options.method ?? 'GET'
  if (method !== 'GET' && session) headers.set(session.csrfHeader, session.csrfToken)
  let response: Response
  try {
    response = await fetch('/api' + path, { ...options, headers, cache: 'no-store' })
  } catch {
    throw new Error('连接失败，请检查服务是否已启动')
  }
  if (!response.ok) {
    if (response.status === 401 && path !== '/login') window.dispatchEvent(new Event('sharehub:expired'))
    const error = await response.json().catch(() => null)
    const fallback = response.status === 401 ? '账号或密码不正确，或登录已过期'
      : response.status === 403 ? '操作未获授权，请刷新页面后重试'
      : response.status === 413 ? '图片太大，每张最多 5 MB' : '操作失败，请稍后重试'
    throw new Error(error?.message || fallback)
  }
  return (response.status === 204 || !response.headers.get('Content-Type')?.includes('json')
    ? undefined : await response.json()) as T
}

export async function readSession() {
  session = await request<Session>('/session')
  return session
}

export function json(method: string, value: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) }
}

export function message(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请稍后重试'
}
