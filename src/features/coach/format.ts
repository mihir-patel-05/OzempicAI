/**
 * The coach replies in light Markdown: paragraphs, line breaks, bullet and
 * numbered lists, and **bold**. This turns that subset into blocks the UI
 * renders as plain elements, so no HTML from the model is ever injected and
 * no Markdown library is needed. Anything else shows as plain text.
 */

export interface Inline {
  text: string
  bold: boolean
}

export type Block =
  | { type: 'p'; lines: Inline[][] }
  | { type: 'ul'; items: Inline[][] }
  | { type: 'ol'; items: Inline[][]; start: number }

const BULLET = /^\s*[-*•]\s+(.*)$/
const NUMBERED = /^\s*(\d+)[.)]\s+(.*)$/
const HEADING = /^\s*#{1,6}\s+(.*)$/

/** Split `**bold**` runs. An unclosed `**` (mid-stream) is dropped, not shown. */
export function parseInline(text: string): Inline[] {
  const parts = text.split('**')
  const closed = parts.length % 2 === 1
  const out: Inline[] = []
  parts.forEach((part, i) => {
    if (!part) return
    const bold = i % 2 === 1 && (closed || i < parts.length - 1)
    out.push({ text: part, bold })
  })
  return out
}

export function parseCoachText(text: string): Block[] {
  const blocks: Block[] = []
  let paragraph: Inline[][] | null = null
  let list: Extract<Block, { type: 'ul' | 'ol' }> | null = null

  const close = () => {
    paragraph = null
    list = null
  }

  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd()
    if (!line.trim()) {
      close()
      continue
    }

    const bullet = BULLET.exec(line)
    const numbered = bullet ? null : NUMBERED.exec(line)
    if (bullet || numbered) {
      const type = bullet ? 'ul' : 'ol'
      const content = parseInline(bullet ? bullet[1]! : numbered![2]!)
      if (!list || list.type !== type) {
        paragraph = null
        list = type === 'ul' ? { type, items: [] } : { type, items: [], start: Number(numbered![1]) }
        blocks.push(list)
      }
      list.items.push(content)
      continue
    }

    const heading = HEADING.exec(line)
    const content = heading ? [{ text: heading[1]!.replaceAll('**', ''), bold: true }] : parseInline(line.trim())
    if (list) {
      // A plain line right after a list item continues that item.
      if (!heading && /^\s+/.test(raw)) {
        const items = list.items
        items[items.length - 1] = [...items[items.length - 1]!, { text: ' ', bold: false }, ...content]
        continue
      }
      list = null
    }
    if (!paragraph || heading) {
      paragraph = []
      blocks.push({ type: 'p', lines: paragraph })
    }
    paragraph.push(content)
    if (heading) paragraph = null
  }
  return blocks
}
