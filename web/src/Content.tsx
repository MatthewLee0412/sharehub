import { Check, Code2, Copy } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import Markdown from 'react-markdown'
import breaks from 'remark-breaks'
import gfm from 'remark-gfm'
import hljs from 'highlight.js/lib/core'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import sql from 'highlight.js/lib/languages/sql'
import python from 'highlight.js/lib/languages/python'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import css from 'highlight.js/lib/languages/css'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'
import type { Member } from './api'

for (const [name, grammar] of Object.entries({ java, javascript, typescript, sql, python, bash, json, css, xml, yaml })) {
  hljs.registerLanguage(name, grammar)
}

export function Avatar({ member, size = '' }: { member: Member; size?: string }) {
  const color = ['green', 'amber', 'lilac', 'blue'].includes(member.color) ? member.color : 'green'
  return <span className={`avatar ${color} ${size}`} aria-hidden="true">{Array.from(member.name)[0]}</span>
}

const formatter = new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
export function dateLabel(iso: string) {
  const date = new Date(iso)
  const minutes = Math.floor((Date.now() - date.valueOf()) / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} 小时前`
  return formatter.format(date)
}

export async function copyText(text: string) {
  await navigator.clipboard.writeText(text)
}

export function CodeBlock({ code, language }: { code: string; language: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle')
  const highlighted = hljs.getLanguage(language) ? hljs.highlight(code, { language }).value : null

  async function copy() {
    try {
      await copyText(code)
      setState('copied')
    } catch {
      setState('error')
    }
  }

  return <figure className="code">
    <figcaption>
      <span><Code2 size={16} /> {language || '纯文本'}</span>
      <button className="code-copy" onClick={copy} aria-label="复制代码">
        {state === 'copied' ? <Check size={15} /> : <Copy size={15} />}
        <span aria-live="polite">{state === 'copied' ? '已复制' : state === 'error' ? '复制失败' : '复制代码'}</span>
      </button>
    </figcaption>
    <pre tabIndex={0} aria-label="代码片段"><code>{highlighted
      ? <span dangerouslySetInnerHTML={{ __html: highlighted }} />
      : code}</code></pre>
  </figure>
}

export function Body({ text }: { text: string }) {
  return <div className="markdown">
    <Markdown skipHtml remarkPlugins={[gfm, breaks]} components={{
      pre({ children }: { children?: ReactNode }) {
        return <>{children}</>
      },
      code({ className, children, node }) {
        const language = className?.match(/language-([\w+-]+)/)?.[1] ?? ''
        const code = String(children ?? '')
        if (language || code.endsWith('\n') || node?.position?.start.line !== node?.position?.end.line) {
          return <CodeBlock code={code.replace(/\n$/, '')} language={language} />
        }
        return <code>{children}</code>
      },
      img() { return null },
      a({ href, children }) {
        return <a href={href} target="_blank" rel="noreferrer">{children}</a>
      },
    }}>{text}</Markdown>
  </div>
}

export function previewText(text: string, full: boolean) {
  if (full || text.length <= 520) return text
  let end = 495
  const boundaries = [...text.matchAll(/^(?:`{3,}|~{3,}).*$/gm)]
  for (let i = 0; i < boundaries.length; i += 2) {
    const start = boundaries[i].index!
    const close = boundaries[i + 1]
    if (start < end && (!close || close.index! + close[0].length > end)) {
      end = start
      break
    }
  }
  return text.slice(0, end).trimEnd()
}
