import type { Booking, ChatSession, Message, Site } from './types'

// Глобальный «текущий» — сохранён только для обратной совместимости со старыми
// местами; новые вызовы принимают `Site` явно
let _defaultUrl = ''
let _defaultToken = ''

export function configureApi(serverUrl: string, token: string) {
  _defaultUrl = serverUrl.replace(/\/$/, '')
  _defaultToken = token
}

async function req<T>(site: Site | null, path: string, init?: RequestInit): Promise<T> {
  const url = (site?.serverUrl ?? _defaultUrl).replace(/\/$/, '')
  const token = site?.token ?? _defaultToken
  const res = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── Bookings (per-site) ──────────────────────────────────────────────────────
export const fetchBookingsFor = async (site: Site, since?: string): Promise<Booking[]> => {
  const raw = await req<Omit<Booking, 'siteId' | 'siteName'>[]>(
    site,
    `/api/app/bookings${since ? `?since=${encodeURIComponent(since)}` : ''}`
  )
  return raw.map((b) => ({ ...b, siteId: site.id, siteName: site.name }))
}

export const patchBookingFor = (site: Site, id: string, status: string, notes?: string) =>
  req<Booking>(site, `/api/app/bookings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, notes }),
  })

// Агрегатор: одновременно дергаем все сайты, собираем в один список
export async function fetchAllBookings(sites: Site[]): Promise<{
  bookings: Booking[]
  errors: { siteId: string; siteName: string; error: string }[]
}> {
  const results = await Promise.allSettled(sites.map((s) => fetchBookingsFor(s)))
  const bookings: Booking[] = []
  const errors: { siteId: string; siteName: string; error: string }[] = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      bookings.push(...r.value)
    } else {
      errors.push({
        siteId: sites[i].id,
        siteName: sites[i].name,
        error: String((r as PromiseRejectedResult).reason?.message ?? r.reason),
      })
    }
  })
  // самые свежие — сверху
  bookings.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  return { bookings, errors }
}

// ── Chats (per-site) ─────────────────────────────────────────────────────────
export const fetchChatsFor = async (site: Site): Promise<ChatSession[]> => {
  const raw = await req<Omit<ChatSession, 'siteId' | 'siteName'>[]>(site, '/api/app/chats')
  return raw.map((s) => ({ ...s, siteId: site.id, siteName: site.name }))
}

export async function fetchAllChats(sites: Site[]): Promise<{
  sessions: ChatSession[]
  errors: { siteId: string; siteName: string; error: string }[]
}> {
  const results = await Promise.allSettled(sites.map((s) => fetchChatsFor(s)))
  const sessions: ChatSession[] = []
  const errors: { siteId: string; siteName: string; error: string }[] = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      sessions.push(...r.value)
    } else {
      errors.push({
        siteId: sites[i].id,
        siteName: sites[i].name,
        error: String((r as PromiseRejectedResult).reason?.message ?? r.reason),
      })
    }
  })
  sessions.sort((a, b) => {
    const at = a.lastMessageAt ?? a.createdAt
    const bt = b.lastMessageAt ?? b.createdAt
    return at < bt ? 1 : -1
  })
  return { sessions, errors }
}

// ── Messages / send / typing / close (per-site) ──────────────────────────────
export const fetchMessages = (site: Site, sessionId: string, since?: string) =>
  req<Message[]>(
    site,
    `/api/app/messages?sessionId=${sessionId}${since ? `&since=${encodeURIComponent(since)}` : ''}`
  )

export const sendMessage = (site: Site, sessionId: string, message: string, adminName: string) =>
  req<Message>(site, '/api/app/chat/send', {
    method: 'POST',
    body: JSON.stringify({ sessionId, message, adminName }),
  })

export const sendTyping = (site: Site, sessionId: string) =>
  req(site, '/api/app/chat/typing', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  })

export const closeChat = (site: Site, sessionId: string) =>
  req(site, '/api/app/chat/close', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  })

export const registerPushToken = (site: Site, token: string) =>
  req(site, '/api/app/push-token', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })

// Для каждого сайта зарегистрировать FCM token — вызывать при логине / получении токена
export async function registerPushTokenEverywhere(sites: Site[], token: string) {
  await Promise.allSettled(sites.map((s) => registerPushToken(s, token)))
}

export const debugPing = (site: Site, step: string, extra?: string) =>
  req(site, '/api/app/ping', {
    method: 'POST',
    body: JSON.stringify({ step, extra }),
  }).catch(() => {})

// ── Legacy single-site helpers (для обратной совместимости) ──────────────────
export const fetchBookings = (since?: string) =>
  req<Booking[]>(null, `/api/app/bookings${since ? `?since=${encodeURIComponent(since)}` : ''}`)
export const patchBooking = (id: string, status: string, notes?: string) =>
  req<Booking>(null, `/api/app/bookings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, notes }),
  })
export const fetchChats = () => req<ChatSession[]>(null, '/api/app/chats')
