import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export async function setupNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('bookings', {
      name: 'Новые заявки',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7C3AED',
      sound: 'default',
      enableVibrate: true,
    })
    await Notifications.setNotificationChannelAsync('chats', {
      name: 'Новые сообщения',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 150, 150, 150],
      lightColor: '#7C3AED',
      sound: 'default',
      enableVibrate: true,
    })
    await Notifications.setNotificationChannelAsync('calls', {
      name: 'Клики по номеру',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 200, 200, 200],
      lightColor: '#7C3AED',
      sound: 'default',
      enableVibrate: true,
    })
    await Notifications.setNotificationChannelAsync('mail', {
      name: 'Новые письма',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 150],
      lightColor: '#7C3AED',
      sound: 'default',
      enableVibrate: true,
    })
  }
  const { status } = await Notifications.requestPermissionsAsync()
  return status === 'granted'
}

// On Android 8+, channelId MUST be inside the trigger — not at top level
function trigger(channelId: string): any {
  if (Platform.OS === 'android') {
    return { channelId, seconds: 1, repeats: false }
  }
  return null
}

export async function notifyNewBooking(count: number) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📋 Новая заявка!',
        body: count > 1
          ? `${count} новых заявок ожидают обработки`
          : 'Поступила новая заявка — нажмите чтобы открыть',
        sound: true,
        data: { screen: 'bookings' },
        priority: 'max',
      } as any,
      trigger: trigger('bookings'),
    })
  } catch (e) {
    console.warn('notifyNewBooking failed:', e)
  }
}

export async function notifyNewMessage(sessionId: string, preview?: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '💬 Новое сообщение в чате',
        body: preview ? preview.slice(0, 80) : 'Клиент написал — нажмите чтобы ответить',
        sound: true,
        data: { screen: 'chats', sessionId },
        priority: 'max',
      } as any,
      trigger: trigger('chats'),
    })
  } catch (e) {
    console.warn('notifyNewMessage failed:', e)
  }
}

export async function notifyNewCall(siteName: string, count = 1) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📞 Клик по номеру',
        body: count > 1
          ? `${count} кликов по номеру, последний — на ${siteName}`
          : `Клик по номеру на ${siteName}`,
        sound: true,
        data: { screen: 'calls' },
        priority: 'max',
      } as any,
      trigger: trigger('calls'),
    })
  } catch (e) {
    console.warn('notifyNewCall failed:', e)
  }
}

export async function notifyNewMail(count: number, siteName?: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📬 Почта · новое письмо',
        body: count > 1
          ? `${count} новых писем${siteName ? ` — последнее на ${siteName}` : ''}`
          : siteName ?? 'Нажмите чтобы прочитать',
        sound: true,
        data: { screen: 'mail' },
        priority: 'high',
      } as any,
      trigger: trigger('mail'),
    })
  } catch (e) {
    console.warn('notifyNewMail failed:', e)
  }
}

export async function sendTestNotification() {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '✅ Уведомления работают!',
        body: 'Xenom Manager настроен правильно — уведомления будут приходить',
        sound: true,
        priority: 'max',
      } as any,
      trigger: trigger('chats'),
    })
  } catch (e) {
    console.warn('testNotification failed:', e)
  }
}
