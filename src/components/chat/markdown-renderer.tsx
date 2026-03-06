'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { memo } from 'react'

export interface MarkdownRendererProps {
  /** 主要 prop：Markdown 文字內容 */
  content?: string
  /** 向後相容 alias（舊元件使用 textMarkdown） */
  textMarkdown?: string
  className?: string
  /** 是否正在串流生成（目前保留但未使用） */
  isStreaming?: boolean
}

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  textMarkdown,
  className,
}: MarkdownRendererProps) {
  const text = content ?? textMarkdown ?? ''
  return (
    <div data-testid="markdown-renderer" className={className ?? 'prose prose-sm dark:prose-invert max-w-none'}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            const isInline = !match
            if (isInline) {
              return (
                <code className="bg-muted px-1.5 py-0.5 rounded text-sm" {...props}>
                  {children}
                </code>
              )
            }
            return (
              <pre className="bg-muted rounded-lg p-4 overflow-x-auto">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            )
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-4">
                <table className="min-w-full border-collapse border border-border">
                  {children}
                </table>
              </div>
            )
          },
          th({ children }) {
            return (
              <th className="border border-border bg-muted px-3 py-2 text-left text-sm font-medium">
                {children}
              </th>
            )
          },
          td({ children }) {
            return (
              <td className="border border-border px-3 py-2 text-sm">
                {children}
              </td>
            )
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
})
