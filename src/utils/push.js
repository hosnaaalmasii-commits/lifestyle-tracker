// Web Push subscribe/unsubscribe helpers. The VAPID public key is not a
// secret (same trust model as the Google OAuth Client ID elsewhere in this
// app — it's meant to be handed to browsers), so it's fine to hardcode here;
// it must match the public half of the key pair the send-due-notifications
// Edge Function signs with (VAPID_PRIVATE_KEY, set as a Supabase secret).
export const VAPID_PUBLIC_KEY = 'BCIrdZknLohRuIYK64oE0z5iqeH6vJtp_tGOZdlR4XM7O04eWEU-_KaM3DC5pCYdNf1KON2yqlq6G6sxS-ovHzQ'

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

// Save a subscription row. Not an upsert: push_subscriptions has no UPDATE
// policy (push_notifications.sql), so upserting an existing endpoint failed
// with an RLS error — re-enabling on a device that was already registered
// broke. Insert, and treat "already there" (23505) as success.
async function saveSubscriptionRow(supabaseClient, row) {
  const { error } = await supabaseClient.from('push_subscriptions').insert(row)
  if (error && error.code !== '23505') throw error
}

// Requests notification permission, subscribes this device to Web Push, and
// saves the subscription into Supabase (one row per device — the same
// person on their phone and their laptop each need their own row so both
// get notified). Returns the subscription, or throws if permission was
// denied or push isn't supported.
export async function subscribeToPush(supabaseClient, userId, deviceLabel) {
  if (!isPushSupported()) throw new Error('Push notifications are not supported in this browser.')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission was not granted.')

  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }

  const json = subscription.toJSON()
  await saveSubscriptionRow(supabaseClient, {
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    device_label: deviceLabel,
  })

  return subscription
}

// Is *this* device actually signed up? (2026-10-30, "it doesn't send
// notifications": the switch used `settings.pushEnabled`, which syncs
// between devices — on the iPhone it showed "on" because the pc had
// enabled it, while the iPhone itself had no subscription at all.)
export async function isThisDeviceSubscribed() {
  if (!isPushSupported() || Notification.permission !== 'granted') return false
  try {
    const registration = await navigator.serviceWorker.ready
    return !!(await registration.pushManager.getSubscription())
  } catch { return false }
}

// On every sign-in / app start: re-save this device's existing
// subscription, so a row that got lost (deleted, an expired endpoint that
// iOS renewed, a reset database) is restored without the user doing
// anything. Does nothing unless the device already allowed notifications.
export async function refreshPushSubscription(supabaseClient, userId) {
  if (!supabaseClient || !userId || !(await isThisDeviceSubscribed())) return false
  const registration = await navigator.serviceWorker.ready
  const json = (await registration.pushManager.getSubscription()).toJSON()
  await saveSubscriptionRow(supabaseClient, {
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    device_label: navigator.userAgent.slice(0, 60),
  })
  return true
}

// Shows a notification right now, from this device — proves the phone
// may and can display them (not that the server sends them).
export async function showTestNotification() {
  if (!isPushSupported()) throw new Error('Deze browser kan geen meldingen tonen. Op iPhone: open de app via het icoon op je beginscherm.')
  if (Notification.permission !== 'granted') throw new Error('Meldingen zijn niet toegestaan. Zet ze aan bij Instellingen → Meldingen → Lifestyle.')
  const registration = await navigator.serviceWorker.ready
  await registration.showNotification('Testmelding', { body: 'Meldingen werken op dit toestel 👍', icon: 'icons/icon-192.png', tag: 'test' })
}

export async function unsubscribeFromPush(supabaseClient) {
  if (!isPushSupported()) return
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return
  await supabaseClient.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
  await subscription.unsubscribe()
}
