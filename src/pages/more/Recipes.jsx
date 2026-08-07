import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { hasApiKey, ClaudeApiError } from '../../utils/claudeApi'
import { generateRecipe } from '../../utils/recipeEngine'
import BackHeader from '../../components/BackHeader'
import ConfirmDialog from '../../components/ConfirmDialog'
import Icon from '../../components/Icon'

export default function Recipes({ onBack, setView }) {
  const { data, saveRecipe, deleteRecipe } = useApp()
  const [prompt, setPrompt] = useState('')
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toDelete, setToDelete] = useState(null)

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

  const renderRecipe = (recipe, onSave) => (
    <div className="card" style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 16 }}>{recipe.name}</div>
      {recipe.tags?.length > 0 && (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-start', marginTop: 6 }}>
          {recipe.tags.map((t) => <span key={t} className="tag">{t}</span>)}
        </div>
      )}
      <div className="text-sm faint mono" style={{ marginTop: 8 }}>
        {recipe.macros.calories} kcal · {recipe.macros.proteinG}g protein · {recipe.macros.carbsG}g carbs · {recipe.macros.fatG}g fat
      </div>
      <div className="text-sm faint" style={{ marginTop: 10, fontWeight: 600 }}>Ingredients</div>
      <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
        {recipe.ingredients.map((ing, i) => <li key={i} className="text-sm">{ing.name} — {ing.amount}</li>)}
      </ul>
      <div className="text-sm faint" style={{ marginTop: 10, fontWeight: 600 }}>Instructions</div>
      <ol style={{ margin: '4px 0 0', paddingLeft: 18 }}>
        {recipe.instructions.map((step, i) => <li key={i} className="text-sm">{step}</li>)}
      </ol>
      {onSave && (
        <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={onSave}>Save</button>
      )}
    </div>
  )

  if (!keyPresent) {
    return (
      <div className="page">
        <BackHeader eyebrow="More" title="Recipes" onBack={onBack} />
        <div className="empty-state">
          <div className="icon"><Icon name="apple" size={26} /></div>
          <p>Connect your own Claude API key to generate recipes from what you ask for — nothing is sent anywhere until you add a key.</p>
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => setView('settings')}>Set up in Settings</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <BackHeader eyebrow="More" title="Recipes" onBack={onBack} />

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

      {draft && renderRecipe(draft, handleSave)}

      <div className="section-title">Saved recipes</div>
      {saved.length === 0 ? (
        <div className="empty-state"><div className="icon"><Icon name="apple" size={26} /></div><p>No recipes saved yet.</p></div>
      ) : (
        <div className="stack">
          {saved.map((r) => (
            <div key={r.id} className="card" style={{ position: 'relative' }}>
              {renderRecipe(r, null)}
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
    </div>
  )
}
