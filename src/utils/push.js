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

// Requests notification permission, subscribes this device to Web Push, and
// upserts the subscription into Supabase (one row per device — the same
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
  const { error } = await supabaseClient.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    device_label: deviceLabel,
  }, { onConflict: 'endpoint' })
  if (error) throw error

  return subscription
}

export async function unsubscribeFromPush(supabaseClient) {
  if (!isPushSupported()) return
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return
  await supabaseClient.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
  await subscription.unsubscribe()
}
