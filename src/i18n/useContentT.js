import { useCallback, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { hasApiKey } from '../utils/claudeApi'
import { translateTexts } from '../utils/contentTranslate'
import { languageInfo, pick } from './index'
import { TASK_LABELS, STAGE_NAMES } from './content'

// Strings waiting to be sent to Claude, per language, shared across every
// component on screen so one render collects everything into one call.
const pending = {}
const inflight = {}
let flushTimer = null
// Sends per string, capped so a string that never comes back translated
// (or a failing call) can't become an endless, billed retry loop.
const attempts = {}
const MAX_ATTEMPTS = 2

// tc(text) → the text in the app language. Known plan labels come from a
// fixed table; anything else is looked up in the translation cache
// (data.contentTranslations) and, if missing, queued for one batched
// Claude call (only when an API key is set). Until it arrives the
// original text is shown.
export function useContentT() {
  const { data, addContentTranslations } = useApp()
  const lang = data.settings.language || 'nl'
  const cache = data.contentTranslations?.[lang] || {}

  const tc = useCallback((text) => {
    if (!text) return text
    const fixed = TASK_LABELS[text]
    if (fixed) return pick(fixed, lang)
    if (cache[text]) return cache[text]
    if (hasApiKey() && !inflight[lang]?.has(text) && (attempts[`${lang}|${text}`] || 0) < MAX_ATTEMPTS) {
      ;(pending[lang] ||= new Set()).add(text)
    }
    return text
  }, [lang, cache])

  // Stage names of the companions have their own fixed table.
  const stageName = useCallback((archetypeId, stageIndex, fallback) => {
    const list = STAGE_NAMES[archetypeId]?.[stageIndex]
    return list ? pick(list, lang) : fallback
  }, [lang])

  useEffect(() => {
    if (!pending[lang]?.size || flushTimer) return
    flushTimer = setTimeout(async () => {
      flushTimer = null
      const batch = [...(pending[lang] || [])].slice(0, 60)
      if (!batch.length) return
      batch.forEach((s) => pending[lang].delete(s))
      const busy = (inflight[lang] ||= new Set())
      batch.forEach((s) => { busy.add(s); attempts[`${lang}|${s}`] = (attempts[`${lang}|${s}`] || 0) + 1 })
      try {
        const result = await translateTexts(batch, languageInfo(lang).aiName)
        addContentTranslations(lang, result)
      } catch {
        // Leave them untranslated; they'll be retried on a later render.
      } finally {
        batch.forEach((s) => busy.delete(s))
      }
    }, 150)
  })

  return { tc, stageName, lang }
}
