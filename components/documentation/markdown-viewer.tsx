import Link from 'next/link'
import type React from 'react'

function parseInline(text: string) {
  const nodes: React.ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const token = match[0]

    if (token.startsWith('**')) {
      nodes.push(<strong key={`${match.index}-bold`}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('`')) {
      nodes.push(<code key={`${match.index}-code`}>{token.slice(1, -1)}</code>)
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      const label = linkMatch?.[1] ?? token
      const href = linkMatch?.[2] ?? '#'
      if (href.startsWith('/') || href.startsWith('#')) {
        nodes.push(<Link key={`${match.index}-link`} href={href}>{label}</Link>)
      } else {
        nodes.push(label)
      }
    }
    lastIndex = pattern.lastIndex
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

export function MarkdownViewer({ content, compact = false }: { content: string; compact?: boolean }) {
  const lines = String(content || '').split(/\r?\n/)
  const nodes: React.ReactNode[] = []
  let listItems: string[] = []

  const flushList = () => {
    if (listItems.length === 0) return
    nodes.push(
      <ul key={`ul-${nodes.length}`} className="list-disc space-y-1 pl-5">
        {listItems.map((item, index) => <li key={index}>{parseInline(item)}</li>)}
      </ul>
    )
    listItems = []
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      flushList()
      continue
    }

    if (line.startsWith('- ')) {
      listItems.push(line.slice(2).trim())
      continue
    }

    flushList()

    if (line.startsWith('## ')) {
      nodes.push(<h2 key={`h2-${nodes.length}`}>{parseInline(line.slice(3))}</h2>)
    } else if (line.startsWith('# ')) {
      nodes.push(<h1 key={`h1-${nodes.length}`}>{parseInline(line.slice(2))}</h1>)
    } else {
      nodes.push(<p key={`p-${nodes.length}`}>{parseInline(line)}</p>)
    }
  }

  flushList()

  return (
    <article className={[
      'documentation-content max-w-none text-slate-700 dark:text-slate-300',
      compact ? 'space-y-3 text-sm leading-6' : 'space-y-4 text-sm leading-7',
      '[&_h1]:text-xl [&_h1]:font-semibold [&_h1]:text-slate-900 dark:[&_h1]:text-slate-50',
      '[&_h2]:pt-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-slate-900 dark:[&_h2]:text-slate-100',
      '[&_strong]:font-semibold [&_strong]:text-slate-900 dark:[&_strong]:text-slate-100',
      '[&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[12px] dark:[&_code]:bg-slate-800',
      '[&_a]:font-semibold [&_a]:text-teal-700 hover:[&_a]:underline dark:[&_a]:text-teal-300',
    ].join(' ')}>
      {nodes}
    </article>
  )
}
