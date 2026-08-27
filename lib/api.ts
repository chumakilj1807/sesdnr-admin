import type { Booking, CallEvent, ChatSession, MailDetail, MailItem, Message, Site } from './types'

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
  if (!res.ok) {
    // status нужен агрегаторам, чтобы отличить «эндпоинта нет» (404) от сбоя сети
    const err = new Error(`HTTP ${res.status}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return res.json()
}

const errStatus = (e: unknown): number | undefined =>
  (e as { status?: number } | null)?.status

// ── Bookings (per-site) ──────────────────────────────────────────────────────
export const fetchBookingsFor = async (site: Site, since?: string): Promise<Booking[]> => {
  const raw = await req<(Omit<Booking, 'siteId' | 'siteName' | 'payload'> & {
    payload?: Record<string, unknown> | null
    fields?: Record<string, unknown> | null
  })[]>(
    site,
    `/api/app/bookings${since ? `?since=${encodeURIComponent(since)}` : ''}`
  )
  // TODO(contract): произвольные поля формы ждём в `payload` (fallback — `fields`).
  return raw.map((b) => ({
    ...b,
    payload: b.payload ?? b.fields ?? null,
    siteId: site.id,
    siteName: site.name,
  }))
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

// Поддерживает оба вызова: debugPing(site, step, extra) и legacy debugPing(step, extra)
export const debugPing = (siteOrStep: Site | string, step?: string, extra?: string) => {
  const site = typeof siteOrStep === 'string' ? null : siteOrStep
  const stepStr = typeof siteOrStep === 'string' ? siteOrStep : (step ?? '')
  return req(site, '/api/app/ping', {
    method: 'POST',
    body: JSON.stringify({ step: stepStr, extra }),
  }).catch(() => {})
}

// ── Mail (per-site) ──────────────────────────────────────────────────────────
// TODO(contract): bridge-эндпоинты почты зафиксированы в ТЗ приложения:
//   GET /api/app/mail?box=inbox&since=  → MailItem[]
//   GET /api/app/mail/[id]              → MailDetail (с body)
//   POST /api/app/mail/send { to, subject, body, site, inReplyTo }
// Если сервер отдаёт другие имена полей — поправить маппинг тут.
// Если эндпоинта на сайте нет (404), сайт попадает в `unsupported` агрегатора.
function mapMail(site: Site, m: any): MailItem {
  return {
    id: String(m.id),
    from: m.from ?? '',
    to: m.to ?? null,
    subject: m.subject ?? null,
    snippet: m.snippet ?? m.preview ?? null,
    date: m.date ?? m.createdAt ?? new Date().toISOString(),
    read: !!m.read,
    siteId: site.id,
    siteName: site.name,
  }
}

export const fetchMailFor = async (site: Site, box = 'inbox', since?: string): Promise<MailItem[]> => {
  const raw = await req<any[]>(
    site,
    `/api/app/mail?box=${encodeURIComponent(box)}${since ? `&since=${encodeURIComponent(since)}` : ''}`
  )
  return raw.map((m) => mapMail(site, m))
}

export const fetchMailDetail = async (site: Site, id: string): Promise<MailDetail> => {
  const m = await req<any>(site, `/api/app/mail/${encodeURIComponent(id)}`)
  return { ...mapMail(site, m), body: m.body ?? m.text ?? m.html ?? null }
}

export const sendMail = (
  site: Site,
  msg: { to: string; subject: string; body: string; inReplyTo?: string }
) =>
  req<{ ok?: boolean }>(site, '/api/app/mail/send', {
    method: 'POST',
    // TODO(contract): поле `site` — домен сайта-отправителя (от какого адреса слать)
    body: JSON.stringify({
      to: msg.to,
      subject: msg.subject,
      body: msg.body,
      site: site.serverUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
      ...(msg.inReplyTo ? { inReplyTo: msg.inReplyTo } : {}),
    }),
  })

export interface AggregateResult<T> {
  items: T[]
  errors: { siteId: string; siteName: string; error: string }[]
  unsupported: Site[] // сайты, где эндпоинт отсутствует (404)
}

export async function fetchAllMail(
  sites: Site[],
  box = 'inbox',
  since?: string
): Promise<AggregateResult<MailItem>> {
  const results = await Promise.allSettled(sites.map((s) => fetchMailFor(s, box, since)))
  const items: MailItem[] = []
  const errors: AggregateResult<MailItem>['errors'] = []
  const unsupported: Site[] = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      items.push(...r.value)
    } else if (errStatus(r.reason) === 404) {
      unsupported.push(sites[i])
    } else {
      errors.push({
        siteId: sites[i].id,
        siteName: sites[i].name,
        error: String(r.reason?.message ?? r.reason),
      })
    }
  })
  items.sort((a, b) => (a.date < b.date ? 1 : -1))
  return { items, errors, unsupported }
}

// ── Calls: клики по номеру на сайтах (per-site) ──────────────────────────────
// TODO(contract): GET /api/app/calls?since= → [{ id, site, page, ts }]
export const fetchCallsFor = async (site: Site, since?: string): Promise<CallEvent[]> => {
  const raw = await req<any[]>(
    site,
    `/api/app/calls${since ? `?since=${encodeURIComponent(since)}` : ''}`
  )
  return raw.map((c) => ({
    id: String(c.id),
    page: c.page ?? null,
    ts: c.ts ?? c.createdAt ?? new Date().toISOString(),
    siteId: site.id,
    siteName: site.name,
  }))
}

export async function fetchAllCalls(
  sites: Site[],
  since?: string
): Promise<AggregateResult<CallEvent>> {
  const results = await Promise.allSettled(sites.map((s) => fetchCallsFor(s, since)))
  const items: CallEvent[] = []
  const errors: AggregateResult<CallEvent>['errors'] = []
  const unsupported: Site[] = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      items.push(...r.value)
    } else if (errStatus(r.reason) === 404) {
      unsupported.push(sites[i])
    } else {
      errors.push({
        siteId: sites[i].id,
        siteName: sites[i].name,
        error: String(r.reason?.message ?? r.reason),
      })
    }
  })
  items.sort((a, b) => (a.ts < b.ts ? 1 : -1))
  return { items, errors, unsupported }
}

// ── Legacy single-site helpers (для обратной совместимости) ──────────────────
export const fetchBookings = (since?: string) =>
  req<Booking[]>(null, `/api/app/bookings${since ? `?since=${encodeURIComponent(since)}` : ''}`)
export const patchBooking = (id: string, status: string, notes?: string) =>
  req<Booking>(null, `/api/app/bookings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, notes }),
  })
export const fetchChats = () => req<ChatSession[]>(null, '/api/app/chats')
