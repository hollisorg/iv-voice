// Turns a raw transcript into the text that gets typed: drops filler words and silence
// artefacts, applies spoken commands and the user's replacements, and tidies spacing.

// Whisper sometimes "hears" these in near-silence; drop them when they are the whole transcript.
const SILENCE_PHRASES = /^(thank you\.?|thanks for watching[.!]?|you\.?|bye\.?|\[blank_audio\]|\(silence\)|\.)$/i

const FILLERS = /(^|[\s,])(?:um+|uh+|erm+|er|ah+|hmm+|mm+)(?=[\s,.!?]|$)[,]?/gi

const COMMANDS = [
  [/\s*\b(new paragraph)\b[.,]?\s*/gi, '\n\n'],
  [/\s*\b(new line|newline)\b[.,]?\s*/gi, '\n']
]

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function cleanTranscript(raw, { removeFillers = true, spokenCommands = true, replacements = [] } = {}) {
  let text = String(raw)
    .replace(/\[[^\]]*\]|\([^)]*(music|silence|inaudible|blank)[^)]*\)/gi, ' ') // [BLANK_AUDIO], (music)
    .replace(/\s+/g, ' ')
    .trim()

  if (!text || SILENCE_PHRASES.test(text)) return ''

  if (removeFillers) {
    text = text.replace(FILLERS, '$1').replace(/\s{2,}/g, ' ').replace(/^[,\s]+/, '')
  }

  if (spokenCommands) {
    for (const [re, out] of COMMANDS) text = text.replace(re, out)
  }

  for (const { from, to } of replacements) {
    if (!from) continue
    text = text.replace(new RegExp(`(?<![\\w])${escapeRe(from)}(?![\\w])`, 'gi'), to)
  }

  text = text
    .replace(/ +([,.!?;:])/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .trim()

  // Capitalise the first letter of the text and of each new line.
  text = text.replace(/(^|\n)([a-z])/g, (_, a, b) => a + b.toUpperCase())
  return text
}

// Whisper's initial prompt nudges spelling of names and jargon. Keep it short.
export function vocabularyPrompt(terms) {
  const words = terms.map((t) => t.trim()).filter(Boolean)
  if (!words.length) return ''
  return `Vocabulary: ${words.join(', ')}.`.slice(0, 600)
}
