import * as BackgroundFetch from 'expo-background-fetch'
import * as TaskManager from 'expo-task-manager'
import * as SecureStore from 'expo-secure-store'
import { fetchAllBookings, fetchAllCalls, fetchAllChats, fetchAllMail } from './api'
import {
  getBookings, upsertBooking, getSessions, upsertSession,
  getCallEvents, upsertCallEvent, getMail, upsertMail,
} from './db'
import { notifyNewBooking, notifyNewCall, notifyNewMail, notifyNewMessage } from './notifications'
import { startChatRing } from './chatRing'
import type { AppSettings, NotifySettings } from './types'

export const BG_TASK = 'XENOM_BG_SYNC'

// Must be defined at module top level, before app registers
TaskManager.defineTask(BG_TASK, async () => {
  try {
    const raw = await SecureStore.getItemAsync('app_settings_v2')
    if (!raw) return BackgroundFetch.BackgroundFetchResult.NoData

    const settings = JSON.parse(raw) as AppSettings
    const sites = settings.sites ?? []
    if (sites.length === 0) return BackgroundFetch.BackgroundFetchResult.NoData

    // Переключатели уведомлений: выкл = собираем события, но пушей нет
    const savedNotify = (settings.notify ?? {}) as Partial<NotifySettings>
    const notify: NotifySettings = {
      bookings: savedNotify.bookings ?? true,
      chats: savedNotify.chats ?? true,
      calls: savedNotify.calls ?? true,
      mail: savedNotify.mail ?? true,
      chatRing: savedNotify.chatRing ?? true,
    }

    // Bookings — параллельно со всех сайтов
    const localBookings = await getBookings()
    const localBookingIds = new Set(localBookings.map((b) => b.id))
    const { bookings: remoteBookings } = await fetchAllBookings(sites)
    const newBookings = remoteBookings.filter(
      (b) => !localBookingIds.has(b.id) && b.status === 'new'
    )
    for (const b of remoteBookings) await upsertBooking(b)
    if (newBookings.length > 0 && notify.bookings) await notifyNewBooking(newBookings.length)

    // Chats — параллельно со всех сайтов
    const localSessions = await getSessions()
    const lastSeenAt = new Map(localSessions.map((s) => [s.id, s.lastMessageAt]))
    const { sessions: remoteSessions } = await fetchAllChats(sites)
    for (const s of remoteSessions) {
      const prev = lastSeenAt.get(s.id)
      const isNewSession = prev === undefined
      const hasNewMsg = !isNewSession && s.lastSender === 'user' && s.lastMessageAt !== prev
      if ((isNewSession && s.lastSender === 'user') || hasNewMsg) {
        if (notify.chats) await notifyNewMessage(s.id, s.lastMessage ?? undefined)
        // Режим «входящий звонок»: рингтон + sticky-уведомление
        if (notify.chats && notify.chatRing) await startChatRing(s.id, s.lastMessage ?? undefined)
      }
      await upsertSession(s)
    }

    // Calls — клики по номеру. На первом запуске (пустая локальная таблица)
    // только заполняем кэш, чтобы не завалить пользователя пушами за всю историю.
    try {
      const localCalls = await getCallEvents()
      const knownCallIds = new Set(localCalls.map((c) => `${c.siteId}:${c.id}`))
      const { items: remoteCalls } = await fetchAllCalls(sites)
      const newCalls = remoteCalls.filter((c) => !knownCallIds.has(`${c.siteId}:${c.id}`))
      for (const c of remoteCalls) await upsertCallEvent(c)
      if (newCalls.length > 0 && localCalls.length > 0 && notify.calls) {
        await notifyNewCall(newCalls[0].siteName, newCalls.length)
      }
    } catch {}

    // Mail — новые входящие. Та же логика «тихого» первого запуска.
    try {
      const localMail = await getMail()
      const knownMailIds = new Set(localMail.map((m) => `${m.siteId}:${m.id}`))
      const { items: remoteMail } = await fetchAllMail(sites)
      const newMail = remoteMail.filter((m) => !knownMailIds.has(`${m.siteId}:${m.id}`))
      for (const m of remoteMail) await upsertMail(m)
      if (newMail.length > 0 && localMail.length > 0 && notify.mail) {
        await notifyNewMail(newMail.length, newMail[0].siteName)
      }
    } catch {}

    return BackgroundFetch.BackgroundFetchResult.NewData
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed
  }
})

export async function registerBackgroundSync() {
  try {
    const status = await BackgroundFetch.getStatusAsync()
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) return

    const isRegistered = await TaskManager.isTaskRegisteredAsync(BG_TASK)
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(BG_TASK, {
        minimumInterval: 60 * 15,
        stopOnTerminate: false,
        startOnBoot: true,
      })
    }
  } catch {}
}
