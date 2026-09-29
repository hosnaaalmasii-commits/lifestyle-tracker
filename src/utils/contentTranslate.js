// One Claude call that translates a batch of short content strings (meal
// names, exercise names, task labels the user typed) into the app
// language. Results are cached in data.contentTranslations by the caller
// (i18n/useContentT.js), so each string is only ever translated once.
import { sendToClaude } from './claudeApi'

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['source', 'translation'],
        properties: { source: { type: 'string' }, translation: { type: 'string' } },
      },
    },
  },
}

export async function translateTexts(texts, languageName) {
  const system = `You translate short strings from a personal health app (meal names, exercise names, daily task labels) into ${languageName}.
- Translate every string, even if it mixes Dutch and English. If it is already natural ${languageName}, return it unchanged.
- Keep numbers, times, units (g, ml, kcal, min) and symbols like "+" and "/" as they are.
- Use natural everyday wording as a native speaker would write it on a phone app — short, no explanations.
- Return one item per input string, with "source" exactly equal to the input.`
  const raw = await sendToClaude({
    system,
    messages: [{ role: 'user', content: JSON.stringify(texts) }],
    maxTokens: 4000,
    schema: SCHEMA,
    effort: 'low',
  })
  const parsed = JSON.parse(raw)
  const out = {}
  for (const it of parsed.items || []) {
    if (texts.includes(it.source) && it.translation?.trim()) out[it.source] = it.translation.trim()
  }
  return out
}
