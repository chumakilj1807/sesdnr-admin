import { useEffect, useRef } from 'react'
import { Stack, router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as Notifications from 'expo-notifications'
import { useStore } from '@/lib/store'
import { setupNotifications } from '@/lib/notifications'
import { registerBackgroundSync } from '@/lib/backgroundTask'
import { registerPushToken, debugPing } from '@/lib/api'

async function tryGetFcmToken() {
  try {
    await debugPing('fcm_start')
    const tokenData = await Notifications.getDevicePushTokenAsync()
    const tokenStr = tokenData?.data
    await debugPing('fcm_token_ok', tokenStr ? `len=${tokenStr.length} type=${tokenData.type}` : 'empty')
    if (tokenStr) {
      await registerPushToken(tokenStr)
      await debugPing('fcm_registered')
    }
  } catch (e: any) {
    await debugPing('fcm_error', e?.message ?? String(e))
  }
}

export default function RootLayout() {
  const { initSettings, initialized, settings } = useStore()
  const notifListener = useRef<Notifications.EventSubscription>()
  const responseListener = useRef<Notifications.EventSubscription>()
  const tokenListener = useRef<Notifications.EventSubscription>()

  useEffect(() => {
    // Passive token listener — fires when Firebase refreshes token
    tokenListener.current = Notifications.addPushTokenListener((tokenData) => {
      if (tokenData?.data) {
        debugPing('token_listener_fired', `type=${tokenData.type} len=${tokenData.data.length}`)
        registerPushToken(tokenData.data).catch(() => {})
      }
    })

    // Init settings, then setup notifications — each independent
    initSettings()
      .then(() => debugPing('init_done'))
      .catch((e) => debugPing('init_error', e?.message))

    setupNotifications()
      .then((ok) => debugPing('notif_done', String(ok)))
      .catch((e) => debugPing('notif_error', e?.message))

    try { registerBackgroundSync() } catch {}

    // Get FCM token 3s after start (gives Firebase time to initialize)
    setTimeout(() => { tryGetFcmToken() }, 3000)

    notifListener.current = Notifications.addNotificationReceivedListener(() => {})
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any
      if (data?.screen === 'chats' && data?.sessionId) {
        router.push(`/chat/${data.sessionId}` as any)
      }
    })

    return () => {
      tokenListener.current?.remove()
      notifListener.current?.remove()
      responseListener.current?.remove()
    }
  }, [])

  if (!initialized) return null

  return (
    <>
      <StatusBar style="light" backgroundColor="#0B0F1A" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0B0F1A' } }}>
        {!settings.setupDone ? (
          <Stack.Screen name="setup" />
        ) : (
          <>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="chat/[sessionId]"
              options={{ headerShown: false, presentation: 'card' }}
            />
          </>
        )}
      </Stack>
    </>
  )
}
