import { clipboard } from 'electron'
import { countWords, inferTitle } from '@shared/slug'
import type { ClipboardCapture, Source } from '@shared/types'

/** Read the clipboard and guess what it is. Pure heuristics, no network. */
export async function readClipboard(): Promise<ClipboardCapture> {
  let text = ''
  let html = ''
  try {
    text = (await clipboard.readText()) ?? ''
    const items = await clipboard.read()
    for (const item of items) {
      if (item.types.includes('text/html')) {
        const blob = (await item.getType('text/html')) as Blob
        html = await blob.text()
        break
      }
    }
  } catch {
    /* clipboard empty or non-text */
  }
  return analyse(text, html)
}

export function analyse(text: string, html = ''): ClipboardCapture {
  const lines = text.split(/\r?\n/)
  const mdSignals =
    (/^\s{0,3}#{1,6}\s/m.test(text) ? 2 : 0) +
    (/```/.test(text) ? 2 : 0) +
    (/^\s*[-*+]\s+\S/m.test(text) ? 1 : 0) +
    (/^\s*\d+\.\s+\S/m.test(text) ? 1 : 0) +
    (/\*\*[^*]+\*\*/.test(text) ? 1 : 0) +
    (/\[[^\]]+\]\([^)]+\)/.test(text) ? 1 : 0) +
    (/^\s*>\s/m.test(text) ? 1 : 0) +
    (/^\s*\|.*\|\s*$/m.test(text) ? 1 : 0)
  return {
    text,
    words: countWords(text),
    lines: lines.length,
    looksLikeMarkdown: mdSignals >= 2,
    detectedSource: detectSource(text, html),
    detectedTitle: inferTitle(text),
  }
}

export function detectSource(text: string, html: string): Source {
  const h = html.toLowerCase()
  if (h.includes('claude.ai') || h.includes('anthropic') || /class="[^"]*font-claude/.test(h)) return 'claude'
  if (h.includes('chatgpt.com') || h.includes('chat.openai.com') || h.includes('openai')) return 'chatgpt'
  if (h.includes('github.com') || h.includes('markdown-body')) return 'github'
  if (/\bclaude\b/i.test(text.slice(0, 400))) return 'claude'
  if (/\bchatgpt\b/i.test(text.slice(0, 400))) return 'chatgpt'
  return 'manual'
}
