import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { todayKey } from '../utils/dates'
import { generateWorkoutSchedule, getAlternateExercise, findRegionForExercise } from '../utils/workoutGenerator'
import { DEFAULT_COLORS } from '../utils/colorPresets'
import { requestGoogleToken, fetchTodayBusyMinutes } from '../utils/googleCalendar'

const STORAGE_KEY = 'lifestyle-tracker-data-v1'

const DEFAULT_DATA = {
  version: 2,
  settings: {
    themeMode: 'system',
    colors: { ...DEFAULT_COLORS },
    waterGoalMl: 2000,
    sleepGoalHours: 8,
    weightUnit: 'kg',
    headingFont: 'fraunces',
    density: 'comfortable',
    useGradientAccents: false,
    gentleMode: false,
    googleClientId: '',
    googleCalendarConnected: false,
  },
  water: {},
  sleep: {},
  workouts: {
    profile: null,
    schedule: [],
    completions: {},
    exerciseLogs: {},
  },
  weight: [],
  mood: [],
  nutrition: {},
  photos: [],
  habitContracts: [],
  painLog: {},
  motivationFlags: {},
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
      workouts: { ...DEFAULT_DATA.workouts, ...parsed.workouts, exerciseLogs: { ...parsed.workouts?.exerciseLogs } },
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
  const accessTokenRef = useRef(null)
  // Ephemeral only — the access token and its derived status are never
  // persisted to localStorage (only the client ID + a "was connected" flag are).
  const [calendarStatus, setCalendarStatus] = useState({ connected: false, busyMinutesToday: null, error: null })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  // Quietly try to resume a Google Calendar connection on load, without prompting.
  useEffect(() => {
    const { googleCalendarConnected, googleClientId } = data.settings
    if (!googleCalendarConnected || !googleClientId) return
    let cancelled = false
    requestGoogleToken(googleClientId, { silent: true })
      .then(async (token) => {
        if (cancelled || !token) return
        accessTokenRef.current = token
        const minutes = await fetchTodayBusyMinutes(token)
        if (!cancelled) setCalendarStatus({ connected: true, busyMinutesToday: minutes, error: null })
      })
      .catch(() => { /* silent attempt — just leave it disconnected */ })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Apply theme + accent colors + personalization to the document root as CSS variables.
  useEffect(() => {
    const root = document.documentElement
    const { themeMode, colors, headingFont, density, useGradientAccents } = data.settings
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
    root.style.setProperty('--accent-gradient-end', colors.gradientEnd)
    root.style.setProperty('--accent-fill', useGradientAccents ? `linear-gradient(135deg, ${colors.accent}, ${colors.gradientEnd})` : colors.accent)
    root.style.setProperty('--ring-fill', useGradientAccents ? `linear-gradient(135deg, ${colors.ring}, ${colors.gradientEnd})` : colors.ring)
    root.setAttribute('data-density', density)
    root.setAttribute('data-font', headingFont)
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
    clearWater: (dateKey = todayKey()) => {
      lastWaterAdd.current = null
      setData((d) => {
        const water = { ...d.water }
        delete water[dateKey]
        return { ...d, water }
      })
    },

    logSleep: (dateKey, hours, quality) => {
      setData((d) => ({ ...d, sleep: { ...d.sleep, [dateKey]: { hours, quality } } }))
    },
    deleteSleep: (dateKey) => {
      setData((d) => {
        const sleep = { ...d.sleep }
        delete sleep[dateKey]
        return { ...d, sleep }
      })
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
    swapExercise: (day, exerciseIndex) => {
      setData((d) => ({
        ...d,
        workouts: {
          ...d.workouts,
          schedule: d.workouts.schedule.map((s) => {
            if (s.day !== day) return s
            const exercises = s.exercises.map((ex, i) => {
              if (i !== exerciseIndex) return ex
              const region = ex.region || findRegionForExercise(ex.name)
              if (!region) return ex
              return { ...ex, region, name: getAlternateExercise(region, ex.name) }
            })
            return { ...s, exercises }
          }),
        },
      }))
    },
    addCustomExercise: (day, exercise) => {
      setData((d) => ({
        ...d,
        workouts: {
          ...d.workouts,
          schedule: d.workouts.schedule.map((s) =>
            s.day === day ? { ...s, exercises: [...s.exercises, { ...exercise, custom: true }] } : s
          ),
        },
      }))
    },
    removeExercise: (day, exerciseIndex) => {
      setData((d) => ({
        ...d,
        workouts: {
          ...d.workouts,
          schedule: d.workouts.schedule.map((s) =>
            s.day === day ? { ...s, exercises: s.exercises.filter((_, i) => i !== exerciseIndex) } : s
          ),
        },
      }))
    },
    logExercisePR: (exerciseName, weight, reps, dateKey = todayKey()) => {
      setData((d) => ({
        ...d,
        workouts: {
          ...d.workouts,
          exerciseLogs: {
            ...d.workouts.exerciseLogs,
            [exerciseName]: [
              ...(d.workouts.exerciseLogs[exerciseName] || []),
              { id: makeId(), date: dateKey, weight, reps },
            ],
          },
        },
      }))
    },
    deleteExercisePR: (exerciseName, id) => {
      setData((d) => ({
        ...d,
        workouts: {
          ...d.workouts,
          exerciseLogs: {
            ...d.workouts.exerciseLogs,
            [exerciseName]: (d.workouts.exerciseLogs[exerciseName] || []).filter((log) => log.id !== id),
          },
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

    addHabitContract: (contract) => {
      setData((d) => ({ ...d, habitContracts: [...d.habitContracts, { id: makeId(), createdAt: todayKey(), ...contract }] }))
    },
    deleteHabitContract: (id) => setData((d) => ({ ...d, habitContracts: d.habitContracts.filter((c) => c.id !== id) })),

    setPainAreas: (dateKey, areaIds) => {
      setData((d) => ({ ...d, painLog: { ...d.painLog, [dateKey]: areaIds } }))
    },
    setLowMotivation: (dateKey, on) => {
      setData((d) => ({ ...d, motivationFlags: { ...d.motivationFlags, [dateKey]: on } }))
    },

    setThemeMode: (mode) => setData((d) => ({ ...d, settings: { ...d.settings, themeMode: mode } })),
    setColor: (key, hex) => setData((d) => ({ ...d, settings: { ...d.settings, colors: { ...d.settings.colors, [key]: hex } } })),
    resetColors: () => setData((d) => ({ ...d, settings: { ...d.settings, colors: { ...DEFAULT_COLORS } } })),
    applyThemePreset: (colors) => setData((d) => ({ ...d, settings: { ...d.settings, colors: { ...colors } } })),
    setHeadingFont: (font) => setData((d) => ({ ...d, settings: { ...d.settings, headingFont: font } })),
    setDensity: (density) => setData((d) => ({ ...d, settings: { ...d.settings, density } })),
    setUseGradientAccents: (on) => setData((d) => ({ ...d, settings: { ...d.settings, useGradientAccents: on } })),
    setGentleMode: (on) => setData((d) => ({ ...d, settings: { ...d.settings, gentleMode: on } })),

    connectGoogleCalendar: async (clientId) => {
      setData((d) => ({ ...d, settings: { ...d.settings, googleClientId: clientId } }))
      setCalendarStatus({ connected: false, busyMinutesToday: null, error: null })
      try {
        const token = await requestGoogleToken(clientId, { silent: false })
        accessTokenRef.current = token
        const minutes = await fetchTodayBusyMinutes(token)
        setCalendarStatus({ connected: true, busyMinutesToday: minutes, error: null })
        setData((d) => ({ ...d, settings: { ...d.settings, googleCalendarConnected: true } }))
      } catch (e) {
        setCalendarStatus({ connected: false, busyMinutesToday: null, error: e.message })
        throw e
      }
    },
    disconnectGoogleCalendar: () => {
      accessTokenRef.current = null
      setCalendarStatus({ connected: false, busyMinutesToday: null, error: null })
      setData((d) => ({ ...d, settings: { ...d.settings, googleCalendarConnected: false } }))
    },
    refreshCalendarStatus: async () => {
      if (!accessTokenRef.current) return
      try {
        const minutes = await fetchTodayBusyMinutes(accessTokenRef.current)
        setCalendarStatus({ connected: true, busyMinutesToday: minutes, error: null })
      } catch (e) {
        setCalendarStatus((s) => ({ ...s, error: e.message }))
      }
    },

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
        workouts: { ...DEFAULT_DATA.workouts, ...parsed.workouts, exerciseLogs: { ...parsed.workouts?.exerciseLogs } },
      })
    },
    clearAll: () => {
      accessTokenRef.current = null
      setCalendarStatus({ connected: false, busyMinutesToday: null, error: null })
      setData(structuredClone(DEFAULT_DATA))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [data])

  const value = useMemo(
    () => ({ data: { ...data, calendarStatus }, calendarStatus, ...actions }),
    [data, calendarStatus, actions]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
