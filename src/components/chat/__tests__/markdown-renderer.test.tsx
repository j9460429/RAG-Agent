import { render, screen } from '@testing-library/react'
import { MarkdownRenderer } from '../markdown-renderer'

describe('MarkdownRenderer', () => {
  it('renders plain text', () => {
    render(<MarkdownRenderer content="Hello world" />)
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('renders markdown content with wrapper', () => {
    const { container } = render(<MarkdownRenderer content="This is **bold** text" />)
    const wrapper = container.querySelector('[data-testid="markdown-renderer"]')
    expect(wrapper).toBeInTheDocument()
    expect(wrapper?.textContent).toContain('bold')
  })

  it('renders code blocks', () => {
    const { container } = render(
      <MarkdownRenderer content={'```typescript\nconst x = 1\n```'} />
    )
    const wrapper = container.querySelector('[data-testid="markdown-renderer"]')
    expect(wrapper).toBeInTheDocument()
    expect(wrapper?.textContent).toContain('const x = 1')
  })

  it('renders GFM table content', () => {
    const md = '| A | B |\n|---|---|\n| 1 | 2 |'
    const { container } = render(<MarkdownRenderer content={md} />)
    const wrapper = container.querySelector('[data-testid="markdown-renderer"]')
    expect(wrapper).toBeInTheDocument()
    // GFM tables may render as text or table in JSDOM
    expect(wrapper?.textContent).toContain('A')
    expect(wrapper?.textContent).toContain('1')
  })

  it('applies custom className', () => {
    const customClass = 'custom-markdown'
    const { container } = render(
      <MarkdownRenderer content="Test" className={customClass} />
    )
    const element = container.querySelector(`.${customClass}`)
    expect(element).toBeInTheDocument()
  })

  it('renders with default className when not provided', () => {
    const { container } = render(<MarkdownRenderer content="Test" />)
    const element = container.querySelector('[data-testid="markdown-renderer"]')
    expect(element).toHaveClass('prose')
  })
})
