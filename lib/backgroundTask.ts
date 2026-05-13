import * as BackgroundFetch from 'expo-background-fetch'
import * as TaskManager from 'expo-task-manager'
import * as SecureStore from 'expo-secure-store'
import { configureApi, fetchBookings, fetchChats } from './api'
import { getBookings, upsertBooking, getSessions, upsertSession } from './db'
import { notifyNewBooking, notifyNewMessage } from './notifications'
import type { AppSettings } from './types'

export const BG_TASK = 'XENOM_BG_SYNC'

// Must be defined at module top level, before app registers
TaskManager.defineTask(BG_TASK, async () => {
  try {
    const raw = await SecureStore.getItemAsync('app_settings_v2')
    if (!raw) return BackgroundFetch.BackgroundFetchResult.NoData

    const settings = JSON.parse(raw) as AppSettings
    const site = settings.sites?.find((s) => s.id === settings.currentSiteId)
    if (!site) return BackgroundFetch.BackgroundFetchResult.NoData

    configureApi(site.serverUrl, site.token)

    // Check for new bookings
    const localBookings = await getBookings()
    const localBookingIds = new Set(localBookings.map((b) => b.id))
    const remoteBookings = await fetchBookings()
    const newBookings = remoteBookings.filter((b) => !localBookingIds.has(b.id) && b.status === 'new')
    for (const b of remoteBookings) await upsertBooking(b)
    if (newBookings.length > 0) await notifyNewBooking(newBookings.length)

    // Check for new chat messages
    const localSessions = await getSessions()
    const lastSeenAt = new Map(localSessions.map((s) => [s.id, s.lastMessageAt]))
    const remoteSessions = await fetchChats()
    for (const s of remoteSessions) {
      const prev = lastSeenAt.get(s.id)
      const isNewSession = prev === undefined
      const hasNewMsg = !isNewSession && s.lastSender === 'user' && s.lastMessageAt !== prev
      if ((isNewSession && s.lastSender === 'user') || hasNewMsg) {
        await notifyNewMessage(s.id, s.lastMessage ?? undefined)
      }
      await upsertSession(s)
    }

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
