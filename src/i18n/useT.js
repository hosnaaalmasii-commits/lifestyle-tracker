import { useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { translate, languageInfo, pick } from './index'

// const { t, lang, locale, pickLang } = useT()
// t('ov.tasksOf', { done: 3, total: 9 }) → "3 van 9 taken" (in the app language)
export function useT() {
  const { data } = useApp()
  const lang = data.settings.language || 'nl'
  const t = useCallback((key, vars) => translate(lang, key, vars), [lang])
  const pickLang = useCallback((list) => pick(list, lang), [lang])
  return { t, lang, locale: languageInfo(lang).locale, pickLang }
}
