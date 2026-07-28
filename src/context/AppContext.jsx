import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { todayKey } from '../utils/dates'
import { generateWorkoutSchedule } from '../utils/workoutGenerator'
import { DEFAULT_COLORS } from '../utils/colorPresets'

const STORAGE_KEY = 'lifestyle-tracker-data-v1'

const DEFAULT_DATA = {
  version: 1,
  settings: {
    themeMode: 'system',
    colors: { ...DEFAULT_COLORS },
    waterGoalMl: 2000,
    sleepGoalHours: 8,
    weightUnit: 'kg',
  },
  water: {},
  sleep: {},
  workouts: {
    profile: null,
    schedule: [],
    completions: {},
  },
  weight: [],
  mood: [],
  nutrition: {},
  photos: [],
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return structuredClone(DEFAULT_DATA)
    const parsed = JSON.parse(raw)
    // Shallow-merge so new fields added in later app versions get defaults.
    return {
      ...structuredClone(DEFAULT_DATA),
      ...parsed,
      settings: { ...DEFAULT_DATA.settings, ...parsed.settings, colors: { ...DEFAULT_COLORS, ...parsed.settings?.colors } },
      workouts: { ...DEFAULT_DATA.workouts, ...parsed.workouts },
    }
  } catch {
    return structuredClone(DEFAULT_DATA)
  }
}

const AppContext = createContext(null)

let idCounter = 0
function makeId() {
  idCounter += 1
  return `${Date.now().toString(36)}-${idCounter}`
}

export function AppProvider({ children }) {
  const [data, setData] = useState(loadData)
  const lastWaterAdd = useRef(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  // Apply theme + accent colors to the document root as CSS variables.
  useEffect(() => {
    const root = document.documentElement
    const { themeMode, colors } = data.settings
    if (themeMode === 'system') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', themeMode)
    }
    root.style.setProperty('--accent', colors.accent)
    root.style.setProperty('--accent-ring', colors.ring)
    root.style.setProperty('--accent-water', colors.water)
    root.style.setProperty('--accent-sleep', colors.sleep)
    root.style.setProperty('--accent-workout', colors.workout)
  }, [data.settings])

  const actions = useMemo(() => ({
    addWater: (ml, dateKey = todayKey()) => {
      lastWaterAdd.current = { dateKey, ml }
      setData((d) => ({ ...d, water: { ...d.water, [dateKey]: Math.max(0, (d.water[dateKey] || 0) + ml) } }))
    },
    undoLastWater: () => {
      const last = lastWaterAdd.current
      if (!last) return
      lastWaterAdd.current = null
      setData((d) => ({
        ...d,
        water: { ...d.water, [last.dateKey]: Math.max(0, (d.water[last.dateKey] || 0) - last.ml) },
      }))
    },
    setWaterGoal: (ml) => setData((d) => ({ ...d, settings: { ...d.settings, waterGoalMl: ml } })),

    logSleep: (dateKey, hours, quality) => {
      setData((d) => ({ ...d, sleep: { ...d.sleep, [dateKey]: { hours, quality } } }))
    },
    setSleepGoal: (hours) => setData((d) => ({ ...d, settings: { ...d.settings, sleepGoalHours: hours } })),

    setWorkoutProfile: (profile) => {
      const schedule = generateWorkoutSchedule(profile)
      setData((d) => ({ ...d, workouts: { ...d.workouts, profile, schedule } }))
    },
    toggleWorkoutDay: (dateKey) => {
      setData((d) => ({
        ...d,
        workouts: {
          ...d.workouts,
          completions: { ...d.workouts.completions, [dateKey]: !d.workouts.completions[dateKey] },
        },
      }))
    },

    addWeight: (kg, dateKey = todayKey()) => {
      setData((d) => ({ ...d, weight: [...d.weight, { id: makeId(), date: dateKey, kg }].sort((a, b) => a.date.localeCompare(b.date)) }))
    },
    deleteWeight: (id) => setData((d) => ({ ...d, weight: d.weight.filter((w) => w.id !== id) })),
    setWeightUnit: (unit) => setData((d) => ({ ...d, settings: { ...d.settings, weightUnit: unit } })),

    addMood: (emoji, note, dateKey = todayKey()) => {
      setData((d) => ({ ...d, mood: [...d.mood, { id: makeId(), date: dateKey, emoji, note }].sort((a, b) => a.date.localeCompare(b.date)) }))
    },
    deleteMood: (id) => setData((d) => ({ ...d, mood: d.mood.filter((m) => m.id !== id) })),

    setNutritionItem: (dateKey, key, value) => {
      setData((d) => ({
        ...d,
        nutrition: {
          ...d.nutrition,
          [dateKey]: {
            breakfast: false, lunch: false, dinner: false, vegetables: false, snacks: false,
            ...d.nutrition[dateKey],
            [key]: value,
          },
        },
      }))
    },

    addPhoto: (photo) => setData((d) => ({ ...d, photos: [...d.photos, { id: makeId(), ...photo }].sort((a, b) => a.date.localeCompare(b.date)) })),
    deletePhoto: (id) => setData((d) => ({ ...d, photos: d.photos.filter((p) => p.id !== id) })),

    setThemeMode: (mode) => setData((d) => ({ ...d, settings: { ...d.settings, themeMode: mode } })),
    setColor: (key, hex) => setData((d) => ({ ...d, settings: { ...d.settings, colors: { ...d.settings.colors, [key]: hex } } })),
    resetColors: () => setData((d) => ({ ...d, settings: { ...d.settings, colors: { ...DEFAULT_COLORS } } })),

    exportData: () => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lifestyle-tracker-backup-${todayKey()}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    },
    importData: (json) => {
      const parsed = typeof json === 'string' ? JSON.parse(json) : json
      setData({
        ...structuredClone(DEFAULT_DATA),
        ...parsed,
        settings: { ...DEFAULT_DATA.settings, ...parsed.settings, colors: { ...DEFAULT_COLORS, ...parsed.settings?.colors } },
        workouts: { ...DEFAULT_DATA.workouts, ...parsed.workouts },
      })
    },
    clearAll: () => setData(structuredClone(DEFAULT_DATA)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [data])

  const value = useMemo(() => ({ data, ...actions }), [data, actions])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
