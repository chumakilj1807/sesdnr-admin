import { useEffect, useRef } from 'react'
import { Stack, router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as Notifications from 'expo-notifications'
import { useStore } from '@/lib/store'
import { setupNotifications } from '@/lib/notifications'
import { registerBackgroundSync } from '@/lib/backgroundTask'
import { registerPushToken } from '@/lib/api'

async function registerFcmToken() {
  try {
    console.log('[FCM] Requesting push token...')
    const token = await Notifications.getDevicePushTokenAsync()
    console.log('[FCM] Got token type:', token?.type, 'data length:', token?.data?.length)
    if (token?.data) {
      await registerPushToken(token.data)
      console.log('[FCM] Token registered with server OK')
    } else {
      console.warn('[FCM] Token is empty or null')
    }
  } catch (e: any) {
    console.error('[FCM] registerFcmToken error:', e?.message ?? e)
  }
}

export default function RootLayout() {
  const { initSettings, initialized, settings } = useStore()
  const notifListener = useRef<Notifications.EventSubscription>()
  const responseListener = useRef<Notifications.EventSubscription>()

  useEffect(() => {
    async function boot() {
      await initSettings()
      // Request permissions first, then get FCM token
      const granted = await setupNotifications()
      console.log('[FCM] Notification permission:', granted)
      registerBackgroundSync()
      await registerFcmToken()
    }
    boot()

    notifListener.current = Notifications.addNotificationReceivedListener(() => {})

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any
      if (data?.screen === 'chats' && data?.sessionId) {
        router.push(`/chat/${data.sessionId}` as any)
      }
    })

    return () => {
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
