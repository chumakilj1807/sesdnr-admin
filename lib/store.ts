import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { configureApi } from './api'
import type { Booking, ChatSession, Message, AppSettings } from './types'

interface AppState {
  settings: AppSettings
  bookings: Booking[]
  sessions: ChatSession[]
  messages: Record<string, Message[]>
  newBookingsCount: number
  newMessagesCount: number
  initialized: boolean

  initSettings: () => Promise<void>
  saveSettings: (s: Partial<AppSettings>) => Promise<void>
  setBookings: (b: Booking[]) => void
  updateBooking: (id: string, status: string, notes?: string) => void
  setSessions: (s: ChatSession[]) => void
  setMessages: (sessionId: string, msgs: Message[]) => void
  addMessage: (msg: Message) => void
  clearNewBookings: () => void
  clearNewMessages: () => void
  incrementNewBookings: () => void
  incrementNewMessages: () => void
}

const DEFAULT_SETTINGS: AppSettings = {
  serverUrl: 'http://192.168.1.100:3001',
  token: 'sesdnr-app-2026',
  adminName: '',
  setupDone: false,
}

export const useStore = create<AppState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  bookings: [],
  sessions: [],
  messages: {},
  newBookingsCount: 0,
  newMessagesCount: 0,
  initialized: false,

  initSettings: async () => {
    try {
      const raw = await SecureStore.getItemAsync('app_settings')
      if (raw) {
        const saved = JSON.parse(raw) as AppSettings
        set({ settings: { ...DEFAULT_SETTINGS, ...saved }, initialized: true })
        configureApi(saved.serverUrl, saved.token)
      } else {
        set({ initialized: true })
      }
    } catch {
      set({ initialized: true })
    }
  },

  saveSettings: async (partial) => {
    const next = { ...get().settings, ...partial }
    set({ settings: next })
    await SecureStore.setItemAsync('app_settings', JSON.stringify(next))
    configureApi(next.serverUrl, next.token)
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
    set((s) => ({
      messages: {
        ...s.messages,
        [msg.sessionId]: [...(s.messages[msg.sessionId] ?? []), msg],
      },
      sessions: s.sessions.map((sess) =>
        sess.id === msg.sessionId
          ? { ...sess, lastMessage: msg.text, lastMessageAt: msg.createdAt, lastSender: msg.sender }
          : sess
      ),
    })),

  clearNewBookings: () => set({ newBookingsCount: 0 }),
  clearNewMessages: () => set({ newMessagesCount: 0 }),
  incrementNewBookings: () => set((s) => ({ newBookingsCount: s.newBookingsCount + 1 })),
  incrementNewMessages: () => set((s) => ({ newMessagesCount: s.newMessagesCount + 1 })),
}))
