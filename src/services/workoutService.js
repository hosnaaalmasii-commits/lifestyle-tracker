import { getSupabaseClient } from '../utils/supabaseClient'

export async function upsertWorkoutScheduleDay(url, anonKey, day, exercises, rest) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase
    .from('workout_schedule')
    .upsert({ day, exercises, rest }, { onConflict: 'user_id,day' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listWorkoutSchedule(url, anonKey) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase.from('workout_schedule').select('id, day, exercises, rest')
  if (error) throw error
  return data
}

export async function setWorkoutCompletion(url, anonKey, date, completed) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase
    .from('workout_completions')
    .upsert({ date, completed }, { onConflict: 'user_id,date' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listWorkoutCompletions(url, anonKey) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase.from('workout_completions').select('id, date, completed').order('date')
  if (error) throw error
  return data
}

export async function addExerciseLog(url, anonKey, clientId, exerciseName, date, weight, reps) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase
    .from('exercise_logs')
    .upsert(
      { client_id: clientId, exercise_name: exerciseName, date, weight, reps },
      { onConflict: 'user_id,client_id' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listExerciseLogs(url, anonKey, exerciseName) {
  const supabase = getSupabaseClient(url, anonKey)
  const { data, error } = await supabase
    .from('exercise_logs')
    .select('id, client_id, exercise_name, date, weight, reps')
    .eq('exercise_name', exerciseName)
    .order('date')
  if (error) throw error
  return data
}
