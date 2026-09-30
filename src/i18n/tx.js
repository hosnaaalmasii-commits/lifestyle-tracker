// tx("Some UI text") — for the long tail of screens (menu sub-pages,
// sheets, settings details) whose strings aren't in the hand-written
// dictionary (i18n/index.js). A plain function, no hook, so it can wrap
// any JSX text: it returns the cached translation for the current app
// language, or the original text while a translation is pending.
//
// Missing strings are queued and sent to Claude in one batch after each
// render (flushTx, called from an AppContext effect), then cached in
// data.contentTranslations — shared with useContentT — so each string is
// translated once per language, ever. Without an API key the original
// text is shown. AppProvider keeps the current language/cache in sync via
// setTxState on every render, and every page re-renders when the cache
// changes because the cache lives in app data.
import { hasApiKey } from '../utils/claudeApi'
import { translateTexts } from '../utils/contentTranslate'
import { languageInfo } from './index'

let state = { lang: 'nl', cache: {} }
const pending = new Map() // lang -> Set
const inflight = new Map() // lang -> Set
// How often each string was sent, per language. Capped so a string Claude
// keeps leaving out (or a failing call) can never turn into an endless,
// billed retry loop — it just stays untranslated this session.
const attempts = new Map() // `${lang}|${text}` -> count
const MAX_ATTEMPTS = 2

export function setTxState(lang, cache) {
  state = { lang, cache: cache || {} }
}

export function tx(text) {
  if (typeof text !== 'string' || !/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(text)) return text
  const hit = state.cache[text]
  if (hit) return hit
  if (hasApiKey() && !inflight.get(state.lang)?.has(text) && (attempts.get(`${state.lang}|${text}`) || 0) < MAX_ATTEMPTS) {
    if (!pending.has(state.lang)) pending.set(state.lang, new Set())
    pending.get(state.lang).add(text)
  }
  return text
}

let flushing = false
export async function flushTx(addTranslations) {
  if (flushing) return
  const lang = state.lang
  const queue = pending.get(lang)
  if (!queue?.size) return
  const batch = [...queue].slice(0, 80)
  batch.forEach((s) => queue.delete(s))
  if (!inflight.has(lang)) inflight.set(lang, new Set())
  const busy = inflight.get(lang)
  batch.forEach((s) => { busy.add(s); attempts.set(`${lang}|${s}`, (attempts.get(`${lang}|${s}`) || 0) + 1) })
  flushing = true
  try {
    const result = await translateTexts(batch, languageInfo(lang).aiName)
    addTranslations(lang, result)
  } catch {
    // Left untranslated; retried on a later render.
  } finally {
    batch.forEach((s) => busy.delete(s))
    flushing = false
  }
}
