import { useEffect, useRef } from 'react'
import { Stack, router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as Notifications from 'expo-notifications'
import * as SecureStore from 'expo-secure-store'
import { useStore } from '@/lib/store'
import { setupNotifications } from '@/lib/notifications'
import { registerBackgroundSync } from '@/lib/backgroundTask'
import { registerPushTokenEverywhere, debugPing } from '@/lib/api'

const FCM_TOKEN_KEY = 'fcm_token_v1'

async function saveFcmToken(token: string) {
  try { await SecureStore.setItemAsync(FCM_TOKEN_KEY, token) } catch {}
}

async function loadFcmToken(): Promise<string | null> {
  try { return await SecureStore.getItemAsync(FCM_TOKEN_KEY) } catch { return null }
}

async function registerOnAllSites(token: string) {
  const sites = useStore.getState().settings.sites
  if (sites.length === 0 || !token) return
  await registerPushTokenEverywhere(sites, token)
  // Через текущий single-site fallback не нужно — registerPushTokenEverywhere
  // дёргает каждый сайт явно по его serverUrl + token.
}

async function tryGetFcmToken() {
  try {
    await debugPing('fcm_start')
    const tokenData = await Notifications.getDevicePushTokenAsync()
    const tokenStr = tokenData?.data
    await debugPing('fcm_token_ok', tokenStr ? `len=${tokenStr.length} type=${tokenData.type}` : 'empty')
    if (tokenStr) {
      await saveFcmToken(tokenStr)
      await registerOnAllSites(tokenStr)
      await debugPing('fcm_registered_all')
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
    // Token listener — срабатывает когда Firebase обновил токен
    tokenListener.current = Notifications.addPushTokenListener((tokenData) => {
      if (tokenData?.data) {
        debugPing('token_listener_fired', `type=${tokenData.type} len=${tokenData.data.length}`)
        saveFcmToken(tokenData.data)
        registerOnAllSites(tokenData.data).catch(() => {})
      }
    })

    // Init settings, then setup notifications
    initSettings()
      .then(async () => {
        await debugPing('init_done')
        // Сразу зарегистрировать сохранённый токен на ВСЕХ подключённых сайтах
        const saved = await loadFcmToken()
        if (saved) {
          await registerOnAllSites(saved)
          await debugPing('fcm_registered_from_cache')
        }
      })
      .catch((e) => debugPing('init_error', e?.message))

    setupNotifications()
      .then((ok) => debugPing('notif_done', String(ok)))
      .catch((e) => debugPing('notif_error', e?.message))

    try { registerBackgroundSync() } catch {}

    // Через 3 секунды получаем свежий fcm-токен (даём Firebase инициализироваться)
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

  // При добавлении/удалении сайта — перерегистрировать токен на новом сайте
  useEffect(() => {
    if (!initialized) return
    ;(async () => {
      const saved = await loadFcmToken()
      if (saved && settings.sites.length > 0) {
        await registerOnAllSites(saved)
      }
    })()
  }, [settings.sites.length, initialized])

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
