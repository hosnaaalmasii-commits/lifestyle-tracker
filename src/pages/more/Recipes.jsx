import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { hasApiKey, ClaudeApiError } from '../../utils/claudeApi'
import { generateRecipe, swapIngredient } from '../../utils/recipeEngine'
import BackHeader from '../../components/BackHeader'
import ConfirmDialog from '../../components/ConfirmDialog'
import Sheet from '../../components/Sheet'
import Icon from '../../components/Icon'

const SWAP_DIRECTIONS = [
  { value: 'lower-calorie', label: 'Lower calorie' },
  { value: 'higher-protein', label: 'Higher protein' },
  { value: 'lower-carb', label: 'Lower carb' },
  { value: 'lower-fat', label: 'Lower fat' },
]

export default function Recipes({ onBack, setView }) {
  const { data, saveRecipe, deleteRecipe, updateRecipe } = useApp()
  const [prompt, setPrompt] = useState('')
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toDelete, setToDelete] = useState(null)
  const [swapTarget, setSwapTarget] = useState(null)
  const [swapLoading, setSwapLoading] = useState(false)
  const [swapError, setSwapError] = useState('')
  const [lastSwappedKey, setLastSwappedKey] = useState(null)

  const keyPresent = hasApiKey()
  const saved = [...data.recipes].reverse()

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setLoading(true)
    setError('')
    setDraft(null)
    try {
      const recipe = await generateRecipe(prompt.trim(), data)
      setDraft(recipe)
    } catch (e) {
      setError(e instanceof ClaudeApiError ? e.message : 'Something went wrong generating that recipe.')
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
      const updatedIngredients = swapTarget.recipe.ingredients.map((ing, i) =>
        i === swapTarget.ingredientIndex ? result.ingredient : ing
      )
      if (swapTarget.recipeKey === 'draft') {
        setDraft((d) => (d ? { ...d, ingredients: updatedIngredients, macros: result.macros } : d))
      } else {
        updateRecipe(swapTarget.recipeKey, { ingredients: updatedIngredients, macros: result.macros })
      }
      setLastSwappedKey(swapTarget.recipeKey)
      setSwapTarget(null)
    } catch (e) {
      setSwapError(e instanceof ClaudeApiError ? e.message : 'Something went wrong with that swap.')
    } finally {
      setSwapLoading(false)
    }
  }

  const renderRecipe = (recipe, onSave, recipeKey) => (
    <div className="card" style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 16 }}>{recipe.name}</div>
      {recipe.tags?.length > 0 && (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-start', marginTop: 6 }}>
          {recipe.tags.map((t, i) => (
            <span
              key={i}
              className="tag"
              style={{
                background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
                color: 'var(--accent)',
                borderRadius: 999,
                padding: '3px 10px',
                fontSize: 12,
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="text-sm faint mono" style={{ marginTop: 8 }}>
        {recipe.macros.calories} kcal · {recipe.macros.proteinG}g protein · {recipe.macros.carbsG}g carbs · {recipe.macros.fatG}g fat
      </div>
      <div className="text-sm faint" style={{ marginTop: 10, fontWeight: 600 }}>Ingredients</div>
      <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
        {recipe.ingredients.map((ing, i) => (
          <li
            key={i}
            className="text-sm"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}
          >
            <span>{ing.name} — {ing.amount}</span>
            {keyPresent && (
              <button
                aria-label="Swap ingredient"
                onClick={() => setSwapTarget({ recipe, recipeKey, ingredientIndex: i })}
                style={{
                  background: 'var(--surface-soft)', border: '1px solid var(--border)', borderRadius: '50%',
                  width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0, marginLeft: 8, padding: 0,
                }}
              >
                <Icon name="repeat" size={12} />
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="text-sm faint" style={{ marginTop: 10, fontWeight: 600 }}>Instructions</div>
      <ol style={{ margin: '4px 0 0', paddingLeft: 18 }}>
        {recipe.instructions.map((step, i) => <li key={i} className="text-sm">{step}</li>)}
      </ol>
      {lastSwappedKey === recipeKey && (
        <p className="text-sm faint" style={{ marginTop: 8, fontStyle: 'italic' }}>
          Steps may need a small adjustment for this swap.
        </p>
      )}
      {onSave && (
        <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={onSave}>Save</button>
      )}
    </div>
  )

  return (
    <div className="page">
      <BackHeader eyebrow="More" title="Recipes" onBack={onBack} />

      {keyPresent ? (
        <>
          <div className="field">
            <label>What do you want to cook?</label>
            <input
              className="input"
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. something high-protein with chicken"
            />
          </div>
          <button className="btn btn-primary btn-block" onClick={handleGenerate} disabled={loading || !prompt.trim()}>
            {loading ? 'Generating…' : 'Generate'}
          </button>
          {error && <p className="text-sm" style={{ color: 'var(--danger)', marginTop: 8 }}>{error}</p>}

          {draft && renderRecipe(draft, handleSave, 'draft')}
        </>
      ) : (
        <div className="empty-state">
          <div className="icon"><Icon name="apple" size={26} /></div>
          <p>Connect your own Claude API key to generate recipes from what you ask for — nothing is sent anywhere until you add a key.</p>
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => setView('settings')}>Set up in Settings</button>
        </div>
      )}

      <div className="section-title">Saved recipes</div>
      {saved.length === 0 ? (
        <div className="empty-state"><div className="icon"><Icon name="apple" size={26} /></div><p>No recipes saved yet.</p></div>
      ) : (
        <div className="stack">
          {saved.map((r) => (
            <div key={r.id} style={{ position: 'relative' }}>
              {renderRecipe(r, null, r.id)}
              <button
                className="btn-ghost"
                style={{ marginTop: 10, background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 13 }}
                onClick={() => setToDelete(r)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete recipe?"
        message="This saved recipe will be removed."
        confirmLabel="Delete"
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={() => { deleteRecipe(toDelete.id); setToDelete(null) }}
      />

      <Sheet
        open={!!swapTarget}
        onClose={() => { setSwapTarget(null); setSwapError('') }}
        title={swapTarget ? `Swap ${swapTarget.recipe.ingredients[swapTarget.ingredientIndex]?.name || ''}` : ''}
      >
        <div className="stack">
          {SWAP_DIRECTIONS.map((d) => (
            <button
              key={d.value}
              className="btn btn-secondary btn-block"
              disabled={swapLoading}
              onClick={() => handleSwap(d.value)}
            >
              {swapLoading ? 'Swapping…' : d.label}
            </button>
          ))}
        </div>
        {swapError && <p className="text-sm" style={{ color: 'var(--danger)', marginTop: 8 }}>{swapError}</p>}
      </Sheet>
    </div>
  )
}
