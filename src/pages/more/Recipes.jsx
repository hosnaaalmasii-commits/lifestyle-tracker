import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { hasApiKey, ClaudeApiError } from '../../utils/claudeApi'
import { generateRecipe, swapIngredient } from '../../utils/recipeEngine'
import BackHeader from '../../components/BackHeader'
import ConfirmDialog from '../../components/ConfirmDialog'
import Sheet from '../../components/Sheet'
import Icon from '../../components/Icon'
import { tx } from '../../i18n/tx'

const SWAP_DIRECTIONS = [
  { value: 'lower-calorie', label: 'Minder calorieën' },
  { value: 'higher-protein', label: 'Meer eiwit' },
  { value: 'lower-carb', label: 'Minder koolhydraten' },
  { value: 'lower-fat', label: 'Minder vet' },
]

// Ask Claude for a recipe, tweak an ingredient, keep the good ones.
// Richting E layout (2026-10-16): Dutch source text (it used to be English,
// so without a translation it showed English), saved recipes as a short
// list — tap one to open it in a sheet.
export default function Recipes({ onBack, setView }) {
  const { data, saveRecipe, deleteRecipe, updateRecipe } = useApp()
  const [prompt, setPrompt] = useState('')
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const [swapTarget, setSwapTarget] = useState(null)
  const [swapLoading, setSwapLoading] = useState(false)
  const [swapError, setSwapError] = useState('')
  const [lastSwappedKey, setLastSwappedKey] = useState(null)

  const keyPresent = hasApiKey()
  const saved = [...data.recipes].reverse()
  const opened = saved.find((r) => r.id === openId) || null

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setLoading(true)
    setError('')
    setDraft(null)
    try {
      setDraft(await generateRecipe(prompt.trim(), data))
    } catch (e) {
      setError(e instanceof ClaudeApiError ? e.message : tx("Het recept maken lukte niet — probeer het nog eens."))
    } finally {
      setLoading(false)
    }
  }

  const handleSave = () => {
    if (draft) saveRecipe(draft)
    setDraft(null)
    setPrompt('')
  }

  const handleSwap = async (direction) => {
    if (!swapTarget) return
    setSwapLoading(true)
    setSwapError('')
    try {
      const result = await swapIngredient(swapTarget.recipe, swapTarget.ingredientIndex, direction, data)
      const updatedIngredients = swapTarget.recipe.ingredients.map((ing, i) => (i === swapTarget.ingredientIndex ? result.ingredient : ing))
      if (swapTarget.recipeKey === 'draft') setDraft((d) => (d ? { ...d, ingredients: updatedIngredients, macros: result.macros } : d))
      else updateRecipe(swapTarget.recipeKey, { ingredients: updatedIngredients, macros: result.macros })
      setLastSwappedKey(swapTarget.recipeKey)
      setSwapTarget(null)
    } catch (e) {
      setSwapError(e instanceof ClaudeApiError ? e.message : tx("Vervangen lukte niet — probeer het nog eens."))
    } finally {
      setSwapLoading(false)
    }
  }

  const macroLine = (m) => `${m.calories} kcal · ${m.proteinG} g ${tx("eiwit")} · ${m.carbsG} g ${tx("koolh.")} · ${m.fatG} g ${tx("vet")}`

  const recipeBody = (recipe, recipeKey) => (
    <div className="stack" style={{ gap: 12 }}>
      {recipe.tags?.length > 0 && (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
          {recipe.tags.map((t, i) => <span key={i} className="chip" style={{ pointerEvents: 'none', padding: '4px 11px', fontSize: 12 }}>{t}</span>)}
        </div>
      )}
      <div className="text-sm faint">{macroLine(recipe.macros)}</div>
      <div>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{tx("Ingrediënten")}</div>
        <div className="list-card" style={{ padding: 0 }}>
          {recipe.ingredients.map((ing, i) => (
            <div key={i} className="list-row" style={{ padding: '8px 0' }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 14 }}>{ing.name} <span className="faint">— {ing.amount}</span></span>
              {keyPresent && (
                <button type="button" className="chip" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setSwapTarget({ recipe, recipeKey, ingredientIndex: i })}>
                  {tx("Vervang")}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{tx("Bereiding")}</div>
        <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {recipe.instructions.map((step, i) => <li key={i} className="text-sm">{step}</li>)}
        </ol>
      </div>
      {lastSwappedKey === recipeKey && <p className="text-sm faint" style={{ margin: 0 }}>{tx("Na een vervanging moet een stap soms licht aangepast worden.")}</p>}
    </div>
  )

  return (
    <div className="page">
      <BackHeader title={tx("Recepten")} onBack={onBack} />

      {keyPresent ? (
        <div className="card stack" style={{ gap: 10 }}>
          <label style={{ fontWeight: 700 }}>{tx("Wat wil je koken?")}</label>
          <input className="input" type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleGenerate() }} placeholder={tx("bv. iets eiwitrijks met kip")} />
          <button className="btn btn-primary btn-block" onClick={handleGenerate} disabled={loading || !prompt.trim()}>
            {loading ? tx("Recept bedenken…") : tx("Maak een recept")}
          </button>
          {error && <p className="text-sm" style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>}
        </div>
      ) : (
        <div className="card stack" style={{ gap: 10 }}>
          <span className="text-sm">{tx("Om recepten te laten maken heb je je Claude-sleutel nodig.")}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setView('coachsettings')}>{tx("Sleutel invullen")}</button>
        </div>
      )}

      {draft && (
        <div className="card stack" style={{ gap: 12, marginTop: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{draft.name}</div>
          {recipeBody(draft, 'draft')}
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setDraft(null)}>{tx("Weggooien")}</button>
            <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>{tx("Bewaren")}</button>
          </div>
        </div>
      )}

      <div className="section-title">{tx("Bewaarde recepten")}</div>
      {saved.length === 0 ? (
        <div className="card text-sm muted">{tx("Nog geen recepten bewaard.")}</div>
      ) : (
        <div className="card list-card">
          {saved.map((r) => (
            <button key={r.id} type="button" className="list-row" onClick={() => setOpenId(r.id)}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>{r.name}</span>
                <span className="text-sm faint">{r.macros.calories} kcal · {r.macros.proteinG} g {tx("eiwit")}</span>
              </span>
              <Icon name="chevronRight" size={16} />
            </button>
          ))}
        </div>
      )}

      <Sheet open={!!opened} onClose={() => setOpenId(null)} title={opened?.name || ''}>
        {opened && (
          <>
            {recipeBody(opened, opened.id)}
            <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 16, color: 'var(--danger)' }} onClick={() => { setToDelete(opened); setOpenId(null) }}>
              {tx("Recept verwijderen")}
            </button>
          </>
        )}
      </Sheet>

      <ConfirmDialog
        open={!!toDelete}
        title={tx("Recept verwijderen?")}
        message={toDelete?.name || ''}
        confirmLabel={tx("Verwijderen")}
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={() => { deleteRecipe(toDelete.id); setToDelete(null) }}
      />

      <Sheet
        open={!!swapTarget}
        onClose={() => { if (swapLoading) return; setSwapTarget(null); setSwapError('') }}
        title={swapTarget ? `${tx("Vervang")} ${swapTarget.recipe.ingredients[swapTarget.ingredientIndex]?.name || ''}` : ''}
      >
        <div className="stack">
          {SWAP_DIRECTIONS.map((d) => (
            <button key={d.value} type="button" className="btn btn-secondary btn-block" disabled={swapLoading} onClick={() => handleSwap(d.value)}>
              {swapLoading ? tx("Bezig…") : tx(d.label)}
            </button>
          ))}
        </div>
        {swapError && <p className="text-sm" style={{ color: 'var(--danger)', marginTop: 8 }}>{swapError}</p>}
      </Sheet>
    </div>
  )
}
