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
    })
    await Notifications.setNotificationChannelAsync('chats', {
      name: 'Новые сообщения',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 150, 150, 150],
      lightColor: '#7C3AED',
      sound: 'default',
    })
  }

  const { status } = await Notifications.requestPermissionsAsync()
  return status === 'granted'
}

export async function notifyNewBooking(count: number) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '📋 Новая заявка',
      body: count > 1 ? `${count} новых заявок ожидают обработки` : 'Новая заявка ожидает обработки',
      sound: 'default',
      data: { screen: 'bookings' },
    },
    trigger: null,
    identifier: `booking_${Date.now()}`,
    ...(Platform.OS === 'android' ? { channelId: 'bookings' } as any : {}),
  })
}

export async function notifyNewMessage(sessionId: string, preview?: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '💬 Новое сообщение в чате',
      body: preview ? `${preview.slice(0, 80)}` : 'Клиент написал сообщение',
      sound: 'default',
      data: { screen: 'chats', sessionId },
    },
    trigger: null,
    identifier: `msg_${Date.now()}`,
    ...(Platform.OS === 'android' ? { channelId: 'chats' } as any : {}),
  })
}
