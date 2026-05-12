import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useStore } from '@/lib/store'

export default function RootLayout() {
  const { initSettings, initialized, settings } = useStore()

  useEffect(() => {
    initSettings()
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
