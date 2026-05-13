import { useEffect, useRef } from 'react'
import { Stack, router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as Notifications from 'expo-notifications'
import { useStore } from '@/lib/store'
import { setupNotifications } from '@/lib/notifications'

export default function RootLayout() {
  const { initSettings, initialized, settings } = useStore()
  const notifListener = useRef<Notifications.EventSubscription>()
  const responseListener = useRef<Notifications.EventSubscription>()

  useEffect(() => {
    initSettings()
    setupNotifications()

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
