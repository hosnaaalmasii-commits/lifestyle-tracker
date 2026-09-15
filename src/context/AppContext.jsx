import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { todayKey } from '../utils/dates'
import transformatieplan from '../data/transformatieplan-data.json'
import { WEEKDAY_KEYS } from '../utils/taskSchedule'
import { generateWorkoutSchedule, getAlternateExercise, findRegionForExercise } from '../utils/workoutGenerator'
import { DEFAULT_COLORS } from '../utils/colorPresets'
import { DEFAULT_FINTECH_GRADIENT, getFintechGradient } from '../utils/fintechGradients'
import { requestGoogleToken, requestGoogleAuthCode, fetchTodayBusyMinutes, syncTasksToCalendar } from '../utils/googleCalendar'
import { hasOuraApiKey, getOuraApiKey, fetchOuraToday } from '../utils/ouraApi'
import { isCloudSyncConfigured, getSupabaseClient } from '../utils/supabaseClient'
import { subscribeToPush, unsubscribeFromPush } from '../utils/push'
import { WALLPAPER_OPTIONS } from '../components/Wallpaper'
import {
  signUp as cloudSignUpApi, signIn as cloudSignInApi, signOut as cloudSignOutApi,
  getSession, onAuthStateChange, reconcile, pushToCloud, markLocalModified,
  exchangeGoogleAuthCode, deleteGoogleCalendarToken,
} from '../utils/cloudSync'

const STORAGE_KEY = 'lifestyle-tracker-data-v1'

// Seeds the editable task schedule from data/transformatieplan-data.json on
// first load. Once a user's own taskSchedule is saved to localStorage, the
// top-level spread in mergeWithDefaults() takes their saved (possibly
// edited) version instead — this only ever supplies the starting point.
function seedTaskSchedule() {
  const out = {}
  for (const day of WEEKDAY_KEYS) {
    out[day] = (transformatieplan.daily_schedules_by_weekday?.[day] || []).map((t, i) => ({
      id: `${day}-${i}`,
      time: t.time,
      label: t.label,
      category: t.category,
      notify: t.notify,
    }))
  }
  return out
}

const DEFAULT_DATA = {
  version: 2,
  settings: {
    themeMode: 'system',
    uiStyle: 'classic',
    fintechGradient: DEFAULT_FINTECH_GRADIENT,
    colors: { ...DEFAULT_COLORS },
    waterGoalMl: 2000,
    sleepGoalHours: 8,
    macroGoals: { calories: 2000, proteinG: 100, carbsG: 250, fatG: 65 },
    weightUnit: 'kg',
    headingFont: 'fraunces',
    density: 'comfortable',
    useGradientAccents: false,
    gentleMode: false,
    googleClientId: '',
    googleCalendarConnected: false,
    googleAutoSyncEnabled: false,
    supabaseUrl: '',
    supabaseAnonKey: '',
    streakThresholdPct: 80,
    notifyCategories: { eten: true, training: true, supplement: true, herstel: true, werk: false, zelfzorg: true },
    calorieTargets: structuredClone(transformatieplan.calorie_targets || {}),
    timezone: '',
    pushEnabled: false,
    wallpaper: 'none',
  },
  taskSchedule: seedTaskSchedule(),
  mealRotation: structuredClone(transformatieplan.meal_rotation || null),
  taskCompletions: {},
  measurements: [],
  googleCalendarEventIds: {},
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
  meals: [],
  photos: [],
  habitContracts: [],
  painLog: {},
  motivationFlags: {},
  cycle: [],
  budget: [],
  schedule: [],
  notes: [],
  recipes: [],
  alcohol: [],
  character: {
    archetype: null,
    feedPointCredit: 0,
    createdAt: null,
  },
}

// Shallow-merge so new fields added in later app versions get defaults —
// shared by loadData, importData, and applying a pulled cloud sync blob so
// all three stay in sync with each other.
function mergeWithDefaults(parsed) {
  return {
    ...structuredClone(DEFAULT_DATA),
    ...parsed,
    settings: { ...DEFAULT_DATA.settings, ...parsed.settings, colors: { ...DEFAULT_COLORS, ...parsed.settings?.colors } },
    workouts: { ...DEFAULT_DATA.workouts, ...parsed.workouts, exerciseLogs: { ...parsed.workouts?.exerciseLogs } },
  }
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return structuredClone(DEFAULT_DATA)
    return mergeWithDefaults(JSON.parse(raw))
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

  // Ephemeral, refetched on load and on demand — the Oura token itself
  // lives only in its own localStorage slot (ouraApi.js), same trust model
  // as the Anthropic key, never in this data object.
  const [ouraStatus, setOuraStatus] = useState({ sleepScore: null, readinessScore: null, activeCalories: null, loading: false, error: null })

  // Cloud sync — also ephemeral. The Supabase session itself is persisted
  // by the Supabase client in its own separate localStorage key, same as
  // every other credential in this app lives in its own isolated slot.
  const [sync, setSync] = useState({ signedIn: false, email: null, status: 'idle', lastSyncedAt: null, error: null })
  const sessionUserRef = useRef(null)
  // Set right before applying a pulled cloud blob via setData, so the very
  // next render doesn't turn around and re-push what was just pulled.
  const suppressSyncRef = useRef(false)
  const pushTimerRef = useRef(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    if (!suppressSyncRef.current) markLocalModified()
  }, [data])

  const doReconcile = useCallback(async (userId) => {
    setSync((s) => ({ ...s, status: 'syncing', error: null }))
    try {
      const { supabaseUrl: url, supabaseAnonKey: anonKey } = data.settings
      const result = await reconcile(url, anonKey, userId, data)
      if (result.direction === 'pulled') {
        suppressSyncRef.current = true
        setData(mergeWithDefaults(result.blob))
      }
      setSync((s) => ({ ...s, status: 'synced', lastSyncedAt: new Date().toISOString(), error: null }))
    } catch (e) {
      setSync((s) => ({ ...s, status: 'error', error: e.message }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  // Resume a Supabase session on load (the SDK persists it itself) and
  // reconcile once against the cloud; keep sign-in state current after that.
  useEffect(() => {
    const { supabaseUrl: url, supabaseAnonKey: anonKey } = data.settings
    if (!isCloudSyncConfigured(data.settings)) return
    let cancelled = false

    getSession(url, anonKey).then(async (session) => {
      if (cancelled || !session) return
      sessionUserRef.current = session.user
      setSync((s) => ({ ...s, signedIn: true, email: session.user.email }))
      await doReconcile(session.user.id)
    })

    const unsubscribe = onAuthStateChange(url, anonKey, (session) => {
      sessionUserRef.current = session?.user || null
      setSync((s) => ({ ...s, signedIn: !!session, email: session?.user?.email || null }))
    })

    return () => { cancelled = true; unsubscribe() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.settings.supabaseUrl, data.settings.supabaseAnonKey])

  // Debounced push of the whole blob whenever it changes, while signed in.
  useEffect(() => {
    if (suppressSyncRef.current) { suppressSyncRef.current = false; return }
    if (!isCloudSyncConfigured(data.settings) || !sessionUserRef.current) return
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current)
    pushTimerRef.current = setTimeout(async () => {
      const { supabaseUrl: url, supabaseAnonKey: anonKey } = data.settings
      const ts = markLocalModified()
      try {
        await pushToCloud(url, anonKey, sessionUserRef.current.id, data, ts)
        setSync((s) => ({ ...s, status: 'synced', lastSyncedAt: ts, error: null }))
      } catch (e) {
        setSync((s) => ({ ...s, status: 'error', error: e.message }))
      }
    }, 2500)
    return () => clearTimeout(pushTimerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, sync.signedIn])

  // Captured once, silently — the send-due-notifications Edge Function
  // needs each user's IANA timezone to know when their local task times are
  // "now" (it has no other way to know what timezone a user is in).
  useEffect(() => {
    if (data.settings.timezone) return
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz) setData((d) => ({ ...d, settings: { ...d.settings, timezone: tz } }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // Quietly pull today's Oura data on load if a token is configured —
  // matches the Google Calendar "silent resume" pattern above.
  useEffect(() => {
    if (!hasOuraApiKey()) return
    let cancelled = false
    setOuraStatus((s) => ({ ...s, loading: true }))
    fetchOuraToday(getOuraApiKey(), todayKey())
      .then((result) => { if (!cancelled) setOuraStatus({ ...result, loading: false, error: null }) })
      .catch((e) => { if (!cancelled) setOuraStatus((s) => ({ ...s, loading: false, error: e.message })) })
    return () => { cancelled = true }
  }, [])

  // Apply theme + accent colors + personalization to the document root as CSS variables.
  useEffect(() => {
    const root = document.documentElement
    const { themeMode, colors, headingFont, density, useGradientAccents, uiStyle, fintechGradient, wallpaper } = data.settings
    if (themeMode === 'system') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', themeMode)
    }
    if (uiStyle === 'fintech') {
      root.setAttribute('data-style', 'fintech')
    } else {
      root.removeAttribute('data-style')
    }
    const grad = getFintechGradient(fintechGradient)
    root.style.setProperty('--fintech-grad-from', grad.from)
    root.style.setProperty('--fintech-grad-to', grad.to)
    root.style.setProperty('--fintech-accent', grad.accent)

    const fintechOn = uiStyle === 'fintech'
    // A wallpaper (Wallpaper.jsx) carries its own matching accent/ring/
    // gradientEnd so the rest of the UI doesn't clash with whatever photo
    // is behind it — same idea as the Fintech override below, just for a
    // different setting. Fintech's own gradient wins if both are somehow
    // active, since Fintech already has a complete color identity of its
    // own; the wallpaper override only applies to Classic.
    const wallpaperOpt = !fintechOn ? WALLPAPER_OPTIONS.find((w) => w.key === wallpaper && w.accent) : null
    // Under Fintech, every accent throughout the app (rings, streak flame,
    // mini-card icons, section dots) switches to the chosen gradient family
    // instead of the user's Classic accent — otherwise only card chrome
    // changes and the app barely reads as redesigned.
    // A wallpaper deliberately collapses water/sleep/workout to the SAME
    // single accent color (unlike Classic's own three independently-picked
    // section colors) — the whole point is everything reading as one
    // cohesive tint matching the photo, not a clash of unrelated hues on
    // top of it. gradientEnd is only ever used as the far end of a
    // same-hue-family gradient fill, never as its own flat section color.
    // Classic used to let water/sleep/workout be independently picked
    // colors (blue/purple/brown by default) — every page reading as its
    // own hue instead of one app. Collapsed to always match the main
    // accent (Overview's color), same idea as the wallpaper override just
    // above, so every page reads as one cohesive color, not per-section
    // ones. Ring stays independent — that's a same-screen two-tone pairing
    // with accent (see THEME_PRESETS, e.g. Emerald & Gold), not a
    // page-to-page inconsistency.
    const accent = fintechOn ? grad.from : wallpaperOpt?.accent || colors.accent
    const ring = fintechOn ? grad.from : wallpaperOpt?.accent || colors.ring
    const water = fintechOn ? grad.from : wallpaperOpt?.accent || colors.accent
    const sleep = fintechOn ? grad.accent : wallpaperOpt?.accent || colors.accent
    const workout = fintechOn ? grad.to : wallpaperOpt?.accent || colors.accent
    const gradientEnd = fintechOn ? grad.to : wallpaperOpt?.gradientEnd || colors.gradientEnd
    // Deliberately NOT forcing gradient fills on for wallpapers the way
    // Fintech does — Fintech is a complete alternate visual language built
    // around two-tone gradients throughout, but Classic's pill buttons
    // etc. are flat/solid everywhere else, so a gradient CTA button next
    // to flat pill buttons read as two different color systems clashing
    // rather than one cohesive tint. Flat wins unless the user has
    // separately opted into gradient accents themselves.
    const useGradient = fintechOn ? true : useGradientAccents

    root.style.setProperty('--accent', accent)
    root.style.setProperty('--accent-ring', ring)
    root.style.setProperty('--accent-water', water)
    root.style.setProperty('--accent-sleep', sleep)
    root.style.setProperty('--accent-workout', workout)
    root.style.setProperty('--accent-gradient-end', gradientEnd)
    root.style.setProperty('--accent-fill', useGradient ? `linear-gradient(135deg, ${accent}, ${gradientEnd})` : accent)
    root.style.setProperty('--ring-fill', useGradient ? `linear-gradient(135deg, ${ring}, ${gradientEnd})` : ring)
    root.setAttribute('data-density', density)
    root.setAttribute('data-font', headingFont)
    root.setAttribute('data-wallpaper', wallpaper || 'none')
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
    setMacroGoals: (goals) => setData((d) => ({ ...d, settings: { ...d.settings, macroGoals: { ...d.settings.macroGoals, ...goals } } })),
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

    addMeal: (meal, dateKey = todayKey()) => {
      setData((d) => ({ ...d, meals: [...d.meals, { id: makeId(), date: dateKey, loggedAt: Date.now(), ...meal }].sort((a, b) => a.date.localeCompare(b.date) || a.loggedAt - b.loggedAt) }))
    },
    deleteMeal: (id) => setData((d) => ({ ...d, meals: d.meals.filter((m) => m.id !== id) })),

    addHabitContract: (contract) => {
      setData((d) => ({ ...d, habitContracts: [...d.habitContracts, { id: makeId(), createdAt: todayKey(), ...contract }] }))
    },
    deleteHabitContract: (id) => setData((d) => ({ ...d, habitContracts: d.habitContracts.filter((c) => c.id !== id) })),

    addCycleEntry: (entry, dateKey = todayKey()) => {
      setData((d) => ({ ...d, cycle: [...d.cycle, { id: makeId(), date: dateKey, ...entry }].sort((a, b) => a.date.localeCompare(b.date)) }))
    },
    deleteCycleEntry: (id) => setData((d) => ({ ...d, cycle: d.cycle.filter((c) => c.id !== id) })),

    addAlcoholEntry: (entry, dateKey = todayKey()) => {
      setData((d) => ({ ...d, alcohol: [...d.alcohol, { id: makeId(), date: dateKey, ...entry }].sort((a, b) => a.date.localeCompare(b.date)) }))
    },
    deleteAlcoholEntry: (id) => setData((d) => ({ ...d, alcohol: d.alcohol.filter((a) => a.id !== id) })),

    addExpense: (expense, dateKey = todayKey()) => {
      setData((d) => ({ ...d, budget: [...d.budget, { id: makeId(), date: dateKey, ...expense }].sort((a, b) => a.date.localeCompare(b.date)) }))
    },
    deleteExpense: (id) => setData((d) => ({ ...d, budget: d.budget.filter((b) => b.id !== id) })),

    toggleTask: (dateKey, taskId) => {
      setData((d) => {
        const dayCompletions = { ...(d.taskCompletions[dateKey] || {}) }
        dayCompletions[taskId] = !dayCompletions[taskId]
        return { ...d, taskCompletions: { ...d.taskCompletions, [dateKey]: dayCompletions } }
      })
    },
    updateTaskSchedule: (day, tasks) => {
      setData((d) => ({ ...d, taskSchedule: { ...d.taskSchedule, [day]: tasks } }))
    },
    addTaskToDay: (day, task) => {
      setData((d) => ({ ...d, taskSchedule: { ...d.taskSchedule, [day]: [...(d.taskSchedule[day] || []), { id: makeId(), notify: true, ...task }] } }))
    },
    updateTaskInDay: (day, taskId, changes) => {
      setData((d) => ({
        ...d,
        taskSchedule: {
          ...d.taskSchedule,
          [day]: d.taskSchedule[day].map((t) => (t.id === taskId ? { ...t, ...changes } : t)),
        },
      }))
    },
    removeTaskFromDay: (day, taskId) => {
      setData((d) => ({ ...d, taskSchedule: { ...d.taskSchedule, [day]: d.taskSchedule[day].filter((t) => t.id !== taskId) } }))
    },

    setMealForDay: (weekLetter, day, mealKey, value) => {
      setData((d) => ({
        ...d,
        mealRotation: {
          ...d.mealRotation,
          meals_by_week: {
            ...d.mealRotation.meals_by_week,
            [weekLetter]: {
              ...d.mealRotation.meals_by_week[weekLetter],
              [day]: { ...d.mealRotation.meals_by_week[weekLetter][day], [mealKey]: value },
            },
          },
        },
      }))
    },
    setMealCycle: (cycle) => setData((d) => ({ ...d, mealRotation: { ...d.mealRotation, cycle } })),
    setMealRotationReference: (mondayKey) => setData((d) => ({ ...d, mealRotation: { ...d.mealRotation, reference_monday: mondayKey } })),

    setStreakThreshold: (pct) => setData((d) => ({ ...d, settings: { ...d.settings, streakThresholdPct: pct } })),
    setNotifyCategory: (category, on) => setData((d) => ({ ...d, settings: { ...d.settings, notifyCategories: { ...d.settings.notifyCategories, [category]: on } } })),
    setCalorieTargets: (targets) => setData((d) => ({ ...d, settings: { ...d.settings, calorieTargets: { ...d.settings.calorieTargets, ...targets, lastRevisedAt: todayKey() } } })),

    // Push notifications need a signed-in Cloud Sync account — the
    // send-due-notifications Edge Function looks up each subscription's
    // user_id to find that user's app_data (taskSchedule, timezone, etc.),
    // so there's no meaningful "push without an account" mode.
    enablePushNotifications: async (deviceLabel) => {
      if (!sessionUserRef.current) throw new Error('Sign in to Cloud Sync first (More → Settings) — push notifications need an account to know which device to notify.')
      const client = getSupabaseClient(data.settings.supabaseUrl, data.settings.supabaseAnonKey)
      await subscribeToPush(client, sessionUserRef.current.id, deviceLabel || navigator.userAgent.slice(0, 60))
      setData((d) => ({ ...d, settings: { ...d.settings, pushEnabled: true } }))
    },
    disablePushNotifications: async () => {
      const client = getSupabaseClient(data.settings.supabaseUrl, data.settings.supabaseAnonKey)
      if (client) await unsubscribeFromPush(client)
      setData((d) => ({ ...d, settings: { ...d.settings, pushEnabled: false } }))
    },

    addMeasurement: (entry, dateKey = todayKey()) => {
      setData((d) => ({ ...d, measurements: [...d.measurements, { id: makeId(), date: dateKey, ...entry }].sort((a, b) => a.date.localeCompare(b.date)) }))
    },
    deleteMeasurement: (id) => setData((d) => ({ ...d, measurements: d.measurements.filter((m) => m.id !== id) })),

    addScheduleItem: (item, dateKey = todayKey()) => {
      setData((d) => ({ ...d, schedule: [...d.schedule, { id: makeId(), date: dateKey, ...item }].sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))) }))
    },
    deleteScheduleItem: (id) => setData((d) => ({ ...d, schedule: d.schedule.filter((s) => s.id !== id) })),

    addNote: (text, dateKey = todayKey()) => {
      setData((d) => ({ ...d, notes: [...d.notes, { id: makeId(), date: dateKey, text, createdAt: Date.now() }] }))
    },
    deleteNote: (id) => setData((d) => ({ ...d, notes: d.notes.filter((n) => n.id !== id) })),

    saveRecipe: (recipe) => {
      setData((d) => ({ ...d, recipes: [...d.recipes, { ...recipe, id: recipe.id || makeId(), savedAt: Date.now() }] }))
    },
    deleteRecipe: (id) => setData((d) => ({ ...d, recipes: d.recipes.filter((r) => r.id !== id) })),
    updateRecipe: (id, changes) => {
      setData((d) => ({ ...d, recipes: d.recipes.map((r) => (r.id === id ? { ...r, ...changes } : r)) }))
    },

    // One-time onboarding choice. startingXp (from Spark's existing XP,
    // computed by the caller) becomes the migration credit so switching to
    // the Character System never resets progress back to zero.
    chooseCharacter: (archetype, startingXp = 0) => {
      setData((d) => ({
        ...d,
        character: { archetype, feedPointCredit: startingXp, createdAt: todayKey() },
      }))
    },
    // Swaps which archetype the same growth history is read through —
    // deliberately doesn't touch createdAt or feedPointCredit, so changing
    // your mind later doesn't reset progress back to zero.
    changeArchetype: (archetype) => {
      setData((d) => ({ ...d, character: { ...d.character, archetype } }))
    },

    setPainAreas: (dateKey, areaIds) => {
      setData((d) => ({ ...d, painLog: { ...d.painLog, [dateKey]: areaIds } }))
    },
    setLowMotivation: (dateKey, on) => {
      setData((d) => ({ ...d, motivationFlags: { ...d.motivationFlags, [dateKey]: on } }))
    },

    setThemeMode: (mode) => setData((d) => ({ ...d, settings: { ...d.settings, themeMode: mode } })),
    setUiStyle: (style) => setData((d) => ({ ...d, settings: { ...d.settings, uiStyle: style } })),
    setFintechGradient: (key) => setData((d) => ({ ...d, settings: { ...d.settings, fintechGradient: key } })),
    setColor: (key, hex) => setData((d) => ({ ...d, settings: { ...d.settings, colors: { ...d.settings.colors, [key]: hex } } })),
    resetColors: () => setData((d) => ({ ...d, settings: { ...d.settings, colors: { ...DEFAULT_COLORS } } })),
    applyThemePreset: (colors) => setData((d) => ({ ...d, settings: { ...d.settings, colors: { ...colors } } })),
    setHeadingFont: (font) => setData((d) => ({ ...d, settings: { ...d.settings, headingFont: font } })),
    setDensity: (density) => setData((d) => ({ ...d, settings: { ...d.settings, density } })),
    setUseGradientAccents: (on) => setData((d) => ({ ...d, settings: { ...d.settings, useGradientAccents: on } })),
    setGentleMode: (on) => setData((d) => ({ ...d, settings: { ...d.settings, gentleMode: on } })),
    setWallpaper: (key) => setData((d) => ({ ...d, settings: { ...d.settings, wallpaper: key } })),

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
    // Pushes the next 7 days of scheduled tasks into Google Calendar as
    // real events, creating or updating them (never duplicating, thanks to
    // the eventId map kept in googleCalendarEventIds). Returns any
    // per-task errors so the caller can surface them instead of failing
    // the whole sync on one bad event.
    syncTasksToGoogleCalendar: async () => {
      if (!accessTokenRef.current) throw new Error('Connect Google Calendar first (More → Settings).')
      const { eventIds, errors } = await syncTasksToCalendar(accessTokenRef.current, data.taskSchedule, data.googleCalendarEventIds)
      setData((d) => ({ ...d, googleCalendarEventIds: { ...d.googleCalendarEventIds, ...eventIds } }))
      return errors
    },
    // One-time setup for the daily cron-driven sync (supabase/functions/
    // sync-calendar-tasks) — separate from the manual button above, which
    // only ever has a short-lived in-memory access token to work with.
    // Requesting a fresh consent screen (initCodeClient's default) each
    // time is deliberate: Google only returns a refresh_token on a consent
    // the user hasn't already granted, so re-prompting is what makes
    // re-enabling after a disconnect reliably work.
    enableCalendarAutoSync: async () => {
      if (!sessionUserRef.current) throw new Error('Sign in to Cloud Sync first (More → Settings) — automatic sync needs somewhere to store the connection that a daily server job can reach.')
      const clientId = data.settings.googleClientId
      if (!clientId) throw new Error('Connect Google Calendar with a Client ID first.')
      const code = await requestGoogleAuthCode(clientId)
      await exchangeGoogleAuthCode(data.settings.supabaseUrl, data.settings.supabaseAnonKey, code, clientId)
      setData((d) => ({ ...d, settings: { ...d.settings, googleAutoSyncEnabled: true } }))
    },
    disableCalendarAutoSync: async () => {
      await deleteGoogleCalendarToken(data.settings.supabaseUrl, data.settings.supabaseAnonKey)
      setData((d) => ({ ...d, settings: { ...d.settings, googleAutoSyncEnabled: false } }))
    },

    refreshOura: async () => {
      if (!hasOuraApiKey()) throw new Error('No Oura token set. Add one in Settings.')
      setOuraStatus((s) => ({ ...s, loading: true }))
      try {
        const result = await fetchOuraToday(getOuraApiKey(), todayKey())
        setOuraStatus({ ...result, loading: false, error: null })
      } catch (e) {
        setOuraStatus((s) => ({ ...s, loading: false, error: e.message }))
        throw e
      }
    },

    setSupabaseConfig: (url, anonKey) => {
      setData((d) => ({ ...d, settings: { ...d.settings, supabaseUrl: url, supabaseAnonKey: anonKey } }))
    },
    disconnectSupabase: () => {
      sessionUserRef.current = null
      setSync({ signedIn: false, email: null, status: 'idle', lastSyncedAt: null, error: null })
      setData((d) => ({ ...d, settings: { ...d.settings, supabaseUrl: '', supabaseAnonKey: '' } }))
    },
    cloudSignUp: (email, password) => {
      const { supabaseUrl: url, supabaseAnonKey: anonKey } = data.settings
      return cloudSignUpApi(url, anonKey, email, password)
    },
    cloudSignIn: (email, password) => {
      const { supabaseUrl: url, supabaseAnonKey: anonKey } = data.settings
      return cloudSignInApi(url, anonKey, email, password)
    },
    cloudSignOut: async () => {
      const { supabaseUrl: url, supabaseAnonKey: anonKey } = data.settings
      await cloudSignOutApi(url, anonKey)
      sessionUserRef.current = null
      setSync({ signedIn: false, email: null, status: 'idle', lastSyncedAt: null, error: null })
    },
    syncNow: () => sessionUserRef.current && doReconcile(sessionUserRef.current.id),

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
      setData(mergeWithDefaults(parsed))
    },
    clearAll: () => {
      accessTokenRef.current = null
      setCalendarStatus({ connected: false, busyMinutesToday: null, error: null })
      sessionUserRef.current = null
      setSync({ signedIn: false, email: null, status: 'idle', lastSyncedAt: null, error: null })
      setData(structuredClone(DEFAULT_DATA))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [data])

  const value = useMemo(
    () => ({ data: { ...data, calendarStatus, ouraStatus }, calendarStatus, ouraStatus, sync, ...actions }),
    [data, calendarStatus, ouraStatus, sync, actions]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
