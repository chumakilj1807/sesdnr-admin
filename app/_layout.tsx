import { useEffect, useRef } from 'react'
import { Stack, router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as Notifications from 'expo-notifications'
import { useStore } from '@/lib/store'
import { setupNotifications } from '@/lib/notifications'
import { registerBackgroundSync } from '@/lib/backgroundTask'
import { registerPushToken } from '@/lib/api'

// Passive listener — fires when Firebase generates/refreshes the token
// This is more reliable than getDevicePushTokenAsync on MIUI
function setupTokenListener() {
  const sub = Notifications.addPushTokenListener((tokenData) => {
    if (tokenData?.data) {
      console.log('[FCM] Token from listener, type:', tokenData.type, 'len:', tokenData.data.length)
      registerPushToken(tokenData.data).catch((e) =>
        console.error('[FCM] registerPushToken error:', e?.message)
      )
    }
  })
  return sub
}

async function tryGetFcmToken() {
  try {
    console.log('[FCM] Calling getDevicePushTokenAsync...')
    const tokenData = await Notifications.getDevicePushTokenAsync()
    console.log('[FCM] Got token type:', tokenData?.type, 'len:', tokenData?.data?.length)
    if (tokenData?.data) {
      await registerPushToken(tokenData.data)
      console.log('[FCM] Token sent to server OK')
    } else {
      console.warn('[FCM] Token data empty')
    }
  } catch (e: any) {
    console.error('[FCM] getDevicePushTokenAsync failed:', e?.message ?? String(e))
  }
}

export default function RootLayout() {
  const { initSettings, initialized, settings } = useStore()
  const notifListener = useRef<Notifications.EventSubscription>()
  const responseListener = useRef<Notifications.EventSubscription>()
  const tokenListener = useRef<Notifications.EventSubscription>()

  useEffect(() => {
    // 1. Set up passive token listener immediately (before any awaits)
    tokenListener.current = setupTokenListener()
    console.log('[FCM] Token listener registered')

    // 2. Init settings (independent try/catch so failure doesn't block FCM)
    initSettings().catch((e) => console.error('[BOOT] initSettings error:', e?.message))

    // 3. Setup notifications channels + permissions (independent)
    setupNotifications().catch((e) =>
      console.error('[BOOT] setupNotifications error:', e?.message)
    )

    // 4. Register background sync
    try { registerBackgroundSync() } catch {}

    // 5. Try to get FCM token directly (independent of permissions)
    tryGetFcmToken()

    // 6. Notification event listeners
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
