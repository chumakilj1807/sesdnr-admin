import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { configureApi } from './api'
import type { Booking, ChatSession, Message, AppSettings, NotifySettings, Site } from './types'

const DEFAULT_NOTIFY: NotifySettings = { bookings: true, chats: true, calls: true, mail: true }

interface AppState {
  settings: AppSettings
  bookings: Booking[]
  sessions: ChatSession[]
  messages: Record<string, Message[]>
  newBookingsCount: number
  newMessagesCount: number
  newCallsCount: number
  newMailCount: number
  initialized: boolean

  currentSite: () => Site | null
  siteById: (id: string) => Site | null

  initSettings: () => Promise<void>
  saveSettings: (s: Partial<AppSettings>) => Promise<void>
  addSite: (site: Site) => Promise<void>
  updateSite: (id: string, updates: Partial<Site>) => Promise<void>
  removeSite: (id: string) => Promise<void>
  switchSite: (id: string) => Promise<void>

  setBookings: (b: Booking[]) => void
  updateBooking: (id: string, status: string, notes?: string) => void
  setSessions: (s: ChatSession[]) => void
  setMessages: (sessionId: string, msgs: Message[]) => void
  addMessage: (msg: Message) => void
  replaceMessage: (tempId: string, real: Message) => void
  clearNewBookings: () => void
  clearNewMessages: () => void
  clearNewCalls: () => void
  clearNewMail: () => void
  incrementNewBookings: () => void
  incrementNewMessages: () => void
  incrementNewCalls: (n?: number) => void
  incrementNewMail: (n?: number) => void
}

const DEFAULT_SETTINGS: AppSettings = {
  adminName: '',
  setupDone: false,
  sites: [],
  currentSiteId: '',
  notify: DEFAULT_NOTIFY,
}

// Singleton API оставлен для chat detail screen, чтобы старая страница тоже работала.
// Новый код использует per-call site из api.ts
function applyCurrentSite(settings: AppSettings) {
  const site = settings.sites.find(s => s.id === settings.currentSiteId) ?? settings.sites[0]
  if (site) configureApi(site.serverUrl, site.token)
}

async function persist(settings: AppSettings) {
  await SecureStore.setItemAsync('app_settings_v2', JSON.stringify(settings))
}

export const useStore = create<AppState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  bookings: [],
  sessions: [],
  messages: {},
  newBookingsCount: 0,
  newMessagesCount: 0,
  newCallsCount: 0,
  newMailCount: 0,
  initialized: false,

  currentSite: () => {
    const { settings } = get()
    return settings.sites.find(s => s.id === settings.currentSiteId) ?? settings.sites[0] ?? null
  },

  siteById: (id) => {
    const { settings } = get()
    return settings.sites.find(s => s.id === id) ?? null
  },

  initSettings: async () => {
    try {
      let raw = await SecureStore.getItemAsync('app_settings_v2')
      if (!raw) {
        // Миграция из старого формата
        const oldRaw = await SecureStore.getItemAsync('app_settings')
        if (oldRaw) {
          const old = JSON.parse(oldRaw)
          if (old.serverUrl) {
            const migratedSite: Site = {
              id: 'site_default',
              name: 'Основной сайт',
              serverUrl: old.serverUrl,
              token: old.token ?? 'sesdnr-app-2026',
            }
            const migrated: AppSettings = {
              adminName: old.adminName ?? '',
              setupDone: old.setupDone ?? false,
              sites: [migratedSite],
              currentSiteId: 'site_default',
              notify: { ...DEFAULT_NOTIFY },
            }
            await persist(migrated)
            set({ settings: migrated, initialized: true })
            applyCurrentSite(migrated)
            return
          }
        }
        set({ initialized: true })
        return
      }
      const saved = JSON.parse(raw) as Partial<AppSettings>
      const settings: AppSettings = {
        ...DEFAULT_SETTINGS,
        ...saved,
        // старые сохранённые настройки могут не содержать notify — мержим с дефолтом
        notify: { ...DEFAULT_NOTIFY, ...(saved.notify ?? {}) },
      }
      set({ settings, initialized: true })
      applyCurrentSite(settings)
    } catch {
      set({ initialized: true })
    }
  },

  saveSettings: async (partial) => {
    const next = { ...get().settings, ...partial }
    set({ settings: next })
    await persist(next)
    applyCurrentSite(next)
  },

  addSite: async (site) => {
    const settings = get().settings
    const sites = [...settings.sites, site]
    // первый сайт автоматически становится «текущим» для legacy single-site логики
    const currentSiteId = settings.sites.length === 0 ? site.id : settings.currentSiteId
    const next = { ...settings, sites, currentSiteId }
    set({ settings: next })
    await persist(next)
    applyCurrentSite(next)
  },

  updateSite: async (id, updates) => {
    const settings = get().settings
    const sites = settings.sites.map(s => s.id === id ? { ...s, ...updates } : s)
    const next = { ...settings, sites }
    set({ settings: next })
    await persist(next)
    applyCurrentSite(next)
  },

  removeSite: async (id) => {
    const settings = get().settings
    const sites = settings.sites.filter(s => s.id !== id)
    const currentSiteId = settings.currentSiteId === id
      ? (sites[0]?.id ?? '')
      : settings.currentSiteId
    const next = { ...settings, sites, currentSiteId }
    // удаляем заявки/сессии этого сайта из in-memory feed
    set({
      settings: next,
      bookings: get().bookings.filter(b => b.siteId !== id),
      sessions: get().sessions.filter(s => s.siteId !== id),
    })
    await persist(next)
    applyCurrentSite(next)
  },

  switchSite: async (id) => {
    const settings = get().settings
    const next = { ...settings, currentSiteId: id }
    set({ settings: next })
    await persist(next)
    applyCurrentSite(next)
  },

  setBookings: (bookings) => set({ bookings }),
  updateBooking: (id, status, notes) =>
    set((s) => ({
      bookings: s.bookings.map((b) =>
        b.id === id ? { ...b, status: status as Booking['status'], notes: notes ?? b.notes } : b
      ),
    })),

  setSessions: (sessions) => set({ sessions }),
  setMessages: (sessionId, msgs) =>
    set((s) => ({ messages: { ...s.messages, [sessionId]: msgs } })),
  addMessage: (msg) =>
    set((s) => {
      const existing = s.messages[msg.sessionId] ?? []
      if (existing.some((m) => m.id === msg.id)) return s
      return {
        messages: { ...s.messages, [msg.sessionId]: [...existing, msg] },
        sessions: s.sessions.map((sess) =>
          sess.id === msg.sessionId
            ? { ...sess, lastMessage: msg.text, lastMessageAt: msg.createdAt, lastSender: msg.sender }
            : sess
        ),
      }
    }),
  replaceMessage: (tempId, real) =>
    set((s) => {
      const existing = s.messages[real.sessionId] ?? []
      const without = existing.filter((m) => m.id !== tempId && m.id !== real.id)
      return {
        messages: { ...s.messages, [real.sessionId]: [...without, real] },
      }
    }),

  clearNewBookings: () => set({ newBookingsCount: 0 }),
  clearNewMessages: () => set({ newMessagesCount: 0 }),
  clearNewCalls: () => set({ newCallsCount: 0 }),
  clearNewMail: () => set({ newMailCount: 0 }),
  incrementNewBookings: () => set((s) => ({ newBookingsCount: s.newBookingsCount + 1 })),
  incrementNewMessages: () => set((s) => ({ newMessagesCount: s.newMessagesCount + 1 })),
  incrementNewCalls: (n = 1) => set((s) => ({ newCallsCount: s.newCallsCount + n })),
  incrementNewMail: (n = 1) => set((s) => ({ newMailCount: s.newMailCount + n })),
}))
