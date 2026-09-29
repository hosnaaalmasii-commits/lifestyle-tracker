import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { todayKey } from '../utils/dates'
import transformatieplan from '../data/transformatieplan-data.json'
import { WEEKDAY_KEYS } from '../utils/taskSchedule'
import { generateWorkoutSchedule, getAlternateExercise, findRegionForExercise } from '../utils/workoutGenerator'
import { DEFAULT_COLOR_THEME, getColorTheme } from '../utils/colorThemes'
import { DEFAULT_LANGUAGE, languageInfo } from '../i18n'
import { setAiLanguage } from '../utils/claudeApi'
import { setTxState, flushTx } from '../i18n/tx'
import { requestGoogleToken, requestGoogleAuthCode, fetchTodayBusyMinutes, syncTasksToCalendar, fetchEventsForDate, DEFAULT_GOOGLE_CLIENT_ID, resolveGoogleClientId } from '../utils/googleCalendar'
import { hasOuraApiKey, getOuraApiKey, fetchOuraToday } from '../utils/ouraApi'
import { isCloudSyncConfigured, getSupabaseClient } from '../utils/supabaseClient'
import { subscribeToPush, unsubscribeFromPush } from '../utils/push'
import {
  signUp as cloudSignUpApi, signIn as cloudSignInApi, signOut as cloudSignOutApi,
  getSession, onAuthStateChange, reconcile, pushToCloud, markLocalModified,
  exchangeGoogleAuthCode, deleteGoogleCalendarToken,
} from '../utils/cloudSync'
// The normalized/encrypted Supabase tables (see supabase/normalized_tables.sql
// and supabase/encrypted_tables.sql) — built in an earlier session, live on
// the user's Supabase project, but never wired up until now. Every relevant
// action below fires a best-effort dual-write here (see syncNormalized) on
// top of the existing whole-blob Cloud Sync, which stays untouched as the
// source of truth for local state and cross-device sync.
import { upsertWaterLog, deleteWaterLog } from '../services/waterService'
import { upsertSleepLog, deleteSleepLog } from '../services/sleepService'
import {
  upsertWorkoutScheduleDay, setWorkoutCompletion, addExerciseLog, deleteExerciseLog,
} from '../services/workoutService'
import { addMoodLog, deleteMoodLog } from '../services/moodService'
import { upsertNutritionLog } from '../services/nutritionService'
import { addBudgetEntry, deleteBudgetEntry } from '../services/budgetService'
import { addScheduleItem as addScheduleItemLog, deleteScheduleItemLog } from '../services/scheduleService'
import { addWeightLog, deleteWeightLog } from '../services/weightService'
import { addCycleLog, deleteCycleLog } from '../services/cycleService'
import { addNote as addNoteLog, deleteNote as deleteNoteLog } from '../services/notesService'
import { backfillNormalizedTables as runNormalizedBackfill } from '../utils/normalizedBackfill'

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
    // One visual style for the whole app; only its colour theme is a
    // choice (utils/colorThemes.js — Paars / Warm / Neon).
    colorTheme: DEFAULT_COLOR_THEME,
    // Shown in the Overview greeting ("Goedemorgen, <name>"). Optional.
    displayName: '',
    // App language (i18n/index.js): nl | en | fr | de | es. Also the
    // language every Claude reply is written in.
    language: DEFAULT_LANGUAGE,
    waterGoalMl: 2000,
    sleepGoalHours: 8,
    macroGoals: { calories: 2000, proteinG: 100, carbsG: 250, fatG: 65 },
    weightUnit: 'kg',
    gentleMode: false,
    googleClientId: DEFAULT_GOOGLE_CLIENT_ID,
    googleCalendarConnected: false,
    googleAutoSyncEnabled: false,
    supabaseUrl: '',
    supabaseAnonKey: '',
    streakThresholdPct: 80,
    notifyCategories: { eten: true, training: true, supplement: true, herstel: true, werk: false, zelfzorg: true },
    calorieTargets: structuredClone(transformatieplan.calorie_targets || {}),
    timezone: '',
    // Where travel is measured from when the AI day planner estimates
    // travel time to an appointment — a free-text place ("Utrecht", an
    // address). Not sent anywhere except inside that one Claude request.
    homeLocation: '',
    pushEnabled: false,
  },
  taskSchedule: seedTaskSchedule(),
  mealRotation: structuredClone(transformatieplan.meal_rotation || null),
  taskCompletions: {},
  // Per-date deviations from the weekly template — see getTasksForDate in
  // utils/taskSchedule.js: { [dateKey]: { tasks?, appointments?, meals? } }.
  dayOverrides: {},
  // What's in the fridge/freezer/cupboard — [{ id, name, location, addedAt }].
  // Drives the "cook with what you have" meal swap (utils/pantry.js).
  pantry: [],
  // AI-estimated macros per meal-rotation dish, keyed by the dish text —
  // cached so each dish is only ever estimated once (Voeding page).
  mealEstimates: {},
  // Cached AI translations of plan content per language:
  // { [lang]: { [sourceText]: translation } } — see i18n/useContentT.js.
  contentTranslations: {},
  // Named places the user told the app about ("gym", "work", "home") —
  // [{ id, name, address }]. Used for appointment locations/travel.
  places: [],
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
// Settings from the retired Classic/Fintech/wallpaper styling system —
// dropped on load so they stop riding along in every sync (a custom
// wallpaper was a full-size image data URL).
const RETIRED_SETTINGS = ['themeMode', 'uiStyle', 'fintechGradient', 'colors', 'headingFont', 'density', 'useGradientAccents', 'wallpaper', 'customWallpaper']

function mergeWithDefaults(parsed) {
  const savedSettings = { ...parsed.settings }
  for (const key of RETIRED_SETTINGS) delete savedSettings[key]
  return {
    ...structuredClone(DEFAULT_DATA),
    ...parsed,
    settings: {
      ...DEFAULT_DATA.settings,
      ...savedSettings,
      // Empty or not-a-client-ID (e.g. a pasted calendar URL) → built-in ID.
      googleClientId: resolveGoogleClientId(parsed.settings?.googleClientId),
    },
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

  // Push the chosen colour theme onto the document root as CSS variables
  // — every component reads var(--accent), var(--second), etc.
  useEffect(() => {
    const root = document.documentElement
    const t = getColorTheme(data.settings.colorTheme)
    const vars = {
      '--bg': t.bg, '--bg-soft': t.bg, '--surface': t.surface, '--surface-soft': t.surfaceSoft, '--surface-raised': t.surfaceRaised,
      '--text': t.text, '--text-soft': t.textSoft, '--text-faint': t.textFaint,
      '--accent': t.accent, '--second': t.second, '--accent-contrast': t.onAccent, '--glow': t.glow,
      '--accent-water': t.water, '--accent-sleep': t.sleep, '--accent-workout': t.workout,
    }
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.bg)
  }, [data.settings.colorTheme])

  useEffect(() => {
    const info = languageInfo(data.settings.language)
    document.documentElement.lang = info.code
    setAiLanguage(info.aiName)
  }, [data.settings.language])

  // Best-effort mirror to the normalized Supabase tables — fires only when
  // signed into Cloud Sync (needs a user to attribute the row to) with
  // Supabase configured, never blocks or throws into the caller, and never
  // touches local state or the whole-blob sync either way. `fn` is a
  // zero-arg thunk returning the service-layer promise, so callers can
  // build the call with values captured at the moment of the edit.
  const syncNormalized = (fn) => {
    if (!isCloudSyncConfigured(data.settings) || !sessionUserRef.current) return
    fn().catch((err) => console.warn('[normalized sync]', err))
  }

  const actions = useMemo(() => ({
    addWater: (ml, dateKey = todayKey()) => {
      lastWaterAdd.current = { dateKey, ml }
      const newMl = Math.max(0, (data.water[dateKey] || 0) + ml)
      setData((d) => ({ ...d, water: { ...d.water, [dateKey]: newMl } }))
      syncNormalized(() => upsertWaterLog(data.settings.supabaseUrl, data.settings.supabaseAnonKey, dateKey, newMl))
    },
    undoLastWater: () => {
      const last = lastWaterAdd.current
      if (!last) return
      lastWaterAdd.current = null
      const newMl = Math.max(0, (data.water[last.dateKey] || 0) - last.ml)
      setData((d) => ({
        ...d,
        water: { ...d.water, [last.dateKey]: newMl },
      }))
      syncNormalized(() => upsertWaterLog(data.settings.supabaseUrl, data.settings.supabaseAnonKey, last.dateKey, newMl))
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
      syncNormalized(() => deleteWaterLog(data.settings.supabaseUrl, data.settings.supabaseAnonKey, dateKey))
    },

    logSleep: (dateKey, hours, quality) => {
      setData((d) => ({ ...d, sleep: { ...d.sleep, [dateKey]: { hours, quality } } }))
      syncNormalized(() => upsertSleepLog(data.settings.supabaseUrl, data.settings.supabaseAnonKey, dateKey, hours, quality))
    },
    deleteSleep: (dateKey) => {
      setData((d) => {
        const sleep = { ...d.sleep }
        delete sleep[dateKey]
        return { ...d, sleep }
      })
      syncNormalized(() => deleteSleepLog(data.settings.supabaseUrl, data.settings.supabaseAnonKey, dateKey))
    },
    setSleepGoal: (hours) => setData((d) => ({ ...d, settings: { ...d.settings, sleepGoalHours: hours } })),

    setWorkoutProfile: (profile) => {
      const schedule = generateWorkoutSchedule(profile)
      setData((d) => ({ ...d, workouts: { ...d.workouts, profile, schedule } }))
      const { supabaseUrl: url, supabaseAnonKey: key } = data.settings
      for (const s of schedule) {
        syncNormalized(() => upsertWorkoutScheduleDay(url, key, s.day, s.exercises, !!s.rest))
      }
    },
    toggleWorkoutDay: (dateKey) => {
      const newCompleted = !data.workouts.completions[dateKey]
      setData((d) => ({
        ...d,
        workouts: {
          ...d.workouts,
          completions: { ...d.workouts.completions, [dateKey]: newCompleted },
        },
      }))
      syncNormalized(() => setWorkoutCompletion(data.settings.supabaseUrl, data.settings.supabaseAnonKey, dateKey, newCompleted))
    },
    swapExercise: (day, exerciseIndex) => {
      let updatedDay = null
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
            updatedDay = { ...s, exercises }
            return updatedDay
          }),
        },
      }))
      if (updatedDay) {
        syncNormalized(() => upsertWorkoutScheduleDay(data.settings.supabaseUrl, data.settings.supabaseAnonKey, day, updatedDay.exercises, !!updatedDay.rest))
      }
    },
    addCustomExercise: (day, exercise) => {
      let updatedDay = null
      setData((d) => ({
        ...d,
        workouts: {
          ...d.workouts,
          schedule: d.workouts.schedule.map((s) => {
            if (s.day !== day) return s
            updatedDay = { ...s, exercises: [...s.exercises, { ...exercise, custom: true }] }
            return updatedDay
          }),
        },
      }))
      if (updatedDay) {
        syncNormalized(() => upsertWorkoutScheduleDay(data.settings.supabaseUrl, data.settings.supabaseAnonKey, day, updatedDay.exercises, !!updatedDay.rest))
      }
    },
    removeExercise: (day, exerciseIndex) => {
      let updatedDay = null
      setData((d) => ({
        ...d,
        workouts: {
          ...d.workouts,
          schedule: d.workouts.schedule.map((s) => {
            if (s.day !== day) return s
            updatedDay = { ...s, exercises: s.exercises.filter((_, i) => i !== exerciseIndex) }
            return updatedDay
          }),
        },
      }))
      if (updatedDay) {
        syncNormalized(() => upsertWorkoutScheduleDay(data.settings.supabaseUrl, data.settings.supabaseAnonKey, day, updatedDay.exercises, !!updatedDay.rest))
      }
    },
    logExercisePR: (exerciseName, weight, reps, dateKey = todayKey()) => {
      const entryId = makeId()
      setData((d) => ({
        ...d,
        workouts: {
          ...d.workouts,
          exerciseLogs: {
            ...d.workouts.exerciseLogs,
            [exerciseName]: [
              ...(d.workouts.exerciseLogs[exerciseName] || []),
              { id: entryId, date: dateKey, weight, reps },
            ],
          },
        },
      }))
      syncNormalized(() => addExerciseLog(data.settings.supabaseUrl, data.settings.supabaseAnonKey, entryId, exerciseName, dateKey, weight, reps))
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
      syncNormalized(() => deleteExerciseLog(data.settings.supabaseUrl, data.settings.supabaseAnonKey, id))
    },

    addWeight: (kg, dateKey = todayKey()) => {
      const entryId = makeId()
      setData((d) => ({ ...d, weight: [...d.weight, { id: entryId, date: dateKey, kg }].sort((a, b) => a.date.localeCompare(b.date)) }))
      syncNormalized(() => addWeightLog(data.settings.supabaseUrl, data.settings.supabaseAnonKey, entryId, dateKey, kg))
    },
    deleteWeight: (id) => {
      setData((d) => ({ ...d, weight: d.weight.filter((w) => w.id !== id) }))
      syncNormalized(() => deleteWeightLog(data.settings.supabaseUrl, data.settings.supabaseAnonKey, id))
    },
    setWeightUnit: (unit) => setData((d) => ({ ...d, settings: { ...d.settings, weightUnit: unit } })),

    addMood: (emoji, note, dateKey = todayKey()) => {
      const entryId = makeId()
      setData((d) => ({ ...d, mood: [...d.mood, { id: entryId, date: dateKey, emoji, note }].sort((a, b) => a.date.localeCompare(b.date)) }))
      syncNormalized(() => addMoodLog(data.settings.supabaseUrl, data.settings.supabaseAnonKey, entryId, dateKey, emoji, note))
    },
    deleteMood: (id) => {
      setData((d) => ({ ...d, mood: d.mood.filter((m) => m.id !== id) }))
      syncNormalized(() => deleteMoodLog(data.settings.supabaseUrl, data.settings.supabaseAnonKey, id))
    },

    setNutritionItem: (dateKey, key, value) => {
      const fullDay = {
        breakfast: false, lunch: false, dinner: false, vegetables: false, snacks: false,
        ...data.nutrition[dateKey],
        [key]: value,
      }
      setData((d) => ({
        ...d,
        nutrition: { ...d.nutrition, [dateKey]: fullDay },
      }))
      syncNormalized(() => upsertNutritionLog(data.settings.supabaseUrl, data.settings.supabaseAnonKey, dateKey, fullDay))
    },

    addPhoto: (photo) => setData((d) => ({ ...d, photos: [...d.photos, { id: makeId(), ...photo }].sort((a, b) => a.date.localeCompare(b.date)) })),
    deletePhoto: (id) => setData((d) => ({ ...d, photos: d.photos.filter((p) => p.id !== id) })),

    addMeal: (meal, dateKey = todayKey()) => {
      setData((d) => ({ ...d, meals: [...d.meals, { id: makeId(), date: dateKey, loggedAt: Date.now(), ...meal }].sort((a, b) => a.date.localeCompare(b.date) || a.loggedAt - b.loggedAt) }))
    },
    deleteMeal: (id) => setData((d) => ({ ...d, meals: d.meals.filter((m) => m.id !== id) })),
    addContentTranslations: (lang, map) => setData((d) => ({
      ...d,
      contentTranslations: { ...d.contentTranslations, [lang]: { ...d.contentTranslations?.[lang], ...map } },
    })),
    setMealEstimate: (text, estimate) => setData((d) => ({ ...d, mealEstimates: { ...d.mealEstimates, [text]: estimate } })),

    addHabitContract: (contract) => {
      setData((d) => ({ ...d, habitContracts: [...d.habitContracts, { id: makeId(), createdAt: todayKey(), ...contract }] }))
    },
    deleteHabitContract: (id) => setData((d) => ({ ...d, habitContracts: d.habitContracts.filter((c) => c.id !== id) })),

    addCycleEntry: (entry, dateKey = todayKey()) => {
      const entryId = makeId()
      setData((d) => ({ ...d, cycle: [...d.cycle, { id: entryId, date: dateKey, ...entry }].sort((a, b) => a.date.localeCompare(b.date)) }))
      syncNormalized(() => addCycleLog(data.settings.supabaseUrl, data.settings.supabaseAnonKey, entryId, dateKey, entry.flow, entry.symptoms, entry.note))
    },
    deleteCycleEntry: (id) => {
      setData((d) => ({ ...d, cycle: d.cycle.filter((c) => c.id !== id) }))
      syncNormalized(() => deleteCycleLog(data.settings.supabaseUrl, data.settings.supabaseAnonKey, id))
    },

    addAlcoholEntry: (entry, dateKey = todayKey()) => {
      setData((d) => ({ ...d, alcohol: [...d.alcohol, { id: makeId(), date: dateKey, ...entry }].sort((a, b) => a.date.localeCompare(b.date)) }))
    },
    deleteAlcoholEntry: (id) => setData((d) => ({ ...d, alcohol: d.alcohol.filter((a) => a.id !== id) })),

    addExpense: (expense, dateKey = todayKey()) => {
      const entryId = makeId()
      setData((d) => ({ ...d, budget: [...d.budget, { id: entryId, date: dateKey, ...expense }].sort((a, b) => a.date.localeCompare(b.date)) }))
      syncNormalized(() => addBudgetEntry(data.settings.supabaseUrl, data.settings.supabaseAnonKey, entryId, dateKey, expense.amount, expense.category, expense.note))
    },
    deleteExpense: (id) => {
      setData((d) => ({ ...d, budget: d.budget.filter((b) => b.id !== id) }))
      syncNormalized(() => deleteBudgetEntry(data.settings.supabaseUrl, data.settings.supabaseAnonKey, id))
    },

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
    savePlace: ({ name, address }) => setData((d) => {
      const rest = (d.places || []).filter((p) => p.name.toLowerCase() !== name.toLowerCase())
      return { ...d, places: [...rest, { id: makeId(), name, address }] }
    }),
    setHomeLocation: (place) => setData((d) => ({ ...d, settings: { ...d.settings, homeLocation: place } })),
    addPantryItems: (items) => {
      setData((d) => ({ ...d, pantry: [...d.pantry, ...items.map((it) => ({ id: makeId(), addedAt: todayKey(), ...it }))] }))
    },
    removePantryItem: (id) => setData((d) => ({ ...d, pantry: d.pantry.filter((p) => p.id !== id) })),
    clearPantry: () => setData((d) => ({ ...d, pantry: [] })),

    // text = null restores the planned meal for that slot.
    setDayMealSwap: (dateKey, slot, text) => {
      setData((d) => {
        const current = d.dayOverrides[dateKey] || {}
        const meals = { ...current.meals }
        if (text == null) delete meals[slot]
        else meals[slot] = text
        return { ...d, dayOverrides: { ...d.dayOverrides, [dateKey]: { ...current, meals } } }
      })
    },
    applyDayReplan: (dateKey, tasks, appointments) => {
      setData((d) => ({ ...d, dayOverrides: { ...d.dayOverrides, [dateKey]: { ...d.dayOverrides[dateKey], tasks, appointments } } }))
    },
    // Back to the weekly template for this date (meal swaps are kept —
    // they're a separate decision from the schedule replan).
    resetDayPlan: (dateKey) => {
      setData((d) => {
        const { tasks: _t, appointments: _a, ...rest } = d.dayOverrides[dateKey] || {}
        return { ...d, dayOverrides: { ...d.dayOverrides, [dateKey]: rest } }
      })
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
      const entryId = makeId()
      setData((d) => ({ ...d, schedule: [...d.schedule, { id: entryId, date: dateKey, ...item }].sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))) }))
      syncNormalized(() => addScheduleItemLog(data.settings.supabaseUrl, data.settings.supabaseAnonKey, entryId, dateKey, item.time, item.text))
    },
    deleteScheduleItem: (id) => {
      setData((d) => ({ ...d, schedule: d.schedule.filter((s) => s.id !== id) }))
      syncNormalized(() => deleteScheduleItemLog(data.settings.supabaseUrl, data.settings.supabaseAnonKey, id))
    },

    addNote: (text, dateKey = todayKey()) => {
      const entryId = makeId()
      setData((d) => ({ ...d, notes: [...d.notes, { id: entryId, date: dateKey, text, createdAt: Date.now() }] }))
      syncNormalized(() => addNoteLog(data.settings.supabaseUrl, data.settings.supabaseAnonKey, entryId, dateKey, text))
    },
    deleteNote: (id) => {
      setData((d) => ({ ...d, notes: d.notes.filter((n) => n.id !== id) }))
      syncNormalized(() => deleteNoteLog(data.settings.supabaseUrl, data.settings.supabaseAnonKey, id))
    },

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

    setColorTheme: (key) => setData((d) => ({ ...d, settings: { ...d.settings, colorTheme: key } })),
    setLanguage: (code) => setData((d) => ({ ...d, settings: { ...d.settings, language: code } })),
    setDisplayName: (name) => setData((d) => ({ ...d, settings: { ...d.settings, displayName: name } })),
    setGentleMode: (on) => setData((d) => ({ ...d, settings: { ...d.settings, gentleMode: on } })),

    connectGoogleCalendar: async (rawClientId) => {
      const clientId = resolveGoogleClientId(rawClientId)
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
      const { eventIds, errors } = await syncTasksToCalendar(accessTokenRef.current, data.taskSchedule, data.googleCalendarEventIds, 7, data.dayOverrides)
      setData((d) => ({ ...d, googleCalendarEventIds: { ...d.googleCalendarEventIds, ...eventIds } }))
      return errors
    },
    // Returns null (not an error) when Calendar isn't connected, so the
    // replan sheet can simply hide its "import from agenda" option.
    fetchCalendarEventsForDate: async (dateKey) => {
      if (!accessTokenRef.current) return null
      return fetchEventsForDate(accessTokenRef.current, dateKey)
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
    backfillNormalizedTables: async (onProgress) => {
      if (!isCloudSyncConfigured(data.settings) || !sessionUserRef.current) {
        throw new Error('Sign in to Cloud Sync first.')
      }
      const { supabaseUrl: url, supabaseAnonKey: anonKey } = data.settings
      return runNormalizedBackfill(data, url, anonKey, onProgress)
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

  // tx(): keep its language/cache current before children render, and send
  // whatever they queued after they have (see i18n/tx.js).
  const txLang = data.settings.language || 'nl'
  setTxState(txLang, data.contentTranslations?.[txLang])
  useEffect(() => { flushTx(actions.addContentTranslations) })

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
