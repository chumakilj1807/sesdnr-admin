import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio'

// Режим «входящий звонок» для чатов: зацикленный рингтон + sticky-уведомление,
// пока оператор не откроет чат или не нажмёт «Отключить».

export const CHAT_RING_CATEGORY = 'chat-ring'
export const CHAT_RING_OPEN = 'chat-ring-open'
export const CHAT_RING_STOP = 'chat-ring-stop'

// Фиксированный id — повторное срабатывание заменяет уведомление, а не плодит их
const CHAT_RING_NOTIFICATION_ID = 'chat-ring'

let player: AudioPlayer | null = null

// Категорию надо зарегистрировать до показа уведомления с action-кнопками
export async function setupChatRingCategory() {
  try {
    await Notifications.setNotificationCategoryAsync(CHAT_RING_CATEGORY, [
      {
        identifier: CHAT_RING_OPEN,
        buttonTitle: 'Открыть чат',
        options: { opensAppToForeground: true },
      },
      {
        identifier: CHAT_RING_STOP,
        buttonTitle: '✕ Отключить',
        options: { opensAppToForeground: false, isDestructive: true },
      },
    ])
  } catch (e) {
    console.warn('setupChatRingCategory failed:', e)
  }
}

// Запустить рингтон (если уже играет — просто продолжаем) + sticky-уведомление
export async function startChatRing(sessionId: string, preview?: string) {
  try {
    if (!player) {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'duckOthers',
      })
      player = createAudioPlayer(require('../assets/ringtone.wav'))
      player.loop = true
    }
    if (!player.playing) player.play()
  } catch (e) {
    console.warn('startChatRing audio failed:', e)
  }

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: CHAT_RING_NOTIFICATION_ID,
      content: {
        title: '💬 Клиент пишет в чат',
        body: preview ? preview.slice(0, 80) : 'Новое сообщение — клиент ждёт ответа',
        sound: false, // звук даёт рингтон, системный не нужен
        data: { screen: 'chats', sessionId, chatRing: true },
        priority: 'max',
        categoryIdentifier: CHAT_RING_CATEGORY,
        ...(Platform.OS === 'android' ? { sticky: true, autoCancel: false } : {}),
      } as any,
      trigger: Platform.OS === 'android' ? { channelId: 'chats', seconds: 1, repeats: false } : null,
    })
  } catch (e) {
    console.warn('startChatRing notification failed:', e)
  }
}

// Остановить рингтон и убрать sticky-уведомление из шторки
export async function stopChatRing() {
  try {
    if (player) {
      player.pause()
      player.remove()
      player = null
    }
  } catch {}
  try {
    await Notifications.dismissNotificationAsync(CHAT_RING_NOTIFICATION_ID)
  } catch {}
}
