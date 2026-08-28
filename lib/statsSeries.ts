import type { Booking, CallEvent, ChatSession, MailItem } from './types'
import { STATUS_LABEL } from '@/constants/Colors'

export type SeriesId = 'bookings' | 'calls' | 'mails' | 'chats'
export type Granularity = 'month' | 'day'

export interface SeriesPoint {
  key: string // 'YYYY-MM' или 'YYYY-MM-DD'
  bookings: number
  calls: number
  mails: number
  chats: number
  total: number
}

export interface SeriesInput {
  bookings: Booking[]
  calls: CallEvent[]
  mails: MailItem[]
  sessions: ChatSession[]
}

export interface DetailEvent {
  ts: string // ISO
  kind: SeriesId
  text: string
  sub?: string
}

export interface BucketDetail {
  key: string
  title: string // «28 августа 2026» или «август 2026»
  counts: Record<SeriesId, number>
  events: DetailEvent[] // по убыванию времени
}

// ── Ключи бакетов ─────────────────────────────────────────────────────────────
export const monthKey = (iso: string) => (iso ?? '').slice(0, 7)
export const dayKey = (iso: string) => (iso ?? '').slice(0, 10)

export const bucketKey = (iso: string, g: Granularity) => (g === 'day' ? dayKey(iso) : monthKey(iso))

// Последние N месяцев включая текущий, ключи YYYY-MM
export function lastMonths(n: number): string[] {
  const out: string[] = []
  const d = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const t = new Date(d.getFullYear(), d.getMonth() - i, 1)
    out.push(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

// Последние N дней включая сегодня, ключи YYYY-MM-DD
export function lastDays(n: number): string[] {
  const out: string[] = []
  const d = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i)
    out.push(
      `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
    )
  }
  return out
}

// Все дни конкретного месяца (ключ YYYY-MM)
export function daysOfMonth(mk: string): string[] {
  const [y, m] = mk.split('-').map(Number)
  if (!y || !m) return []
  const n = new Date(y, m, 0).getDate()
  return Array.from({ length: n }, (_, i) => `${mk}-${String(i + 1).padStart(2, '0')}`)
}

// ── Подписи ───────────────────────────────────────────────────────────────────
export function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number)
  if (!y || !m) return key
  return new Date(y, m - 1, 1).toLocaleString('ru', { month: 'short' })
}

export function axisLabel(key: string, g: Granularity) {
  if (g === 'month') return monthLabel(key)
  return key.slice(8, 10) // день месяца
}

export function monthTitle(key: string) {
  const [y, m] = key.split('-').map(Number)
  if (!y || !m) return key
  return new Date(y, m - 1, 1).toLocaleString('ru', { month: 'long', year: 'numeric' })
}

export function dayTitle(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  if (!y || !m || !d) return key
  return new Date(y, m - 1, d).toLocaleString('ru', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function bucketTitle(key: string, g: Granularity) {
  return g === 'day' ? dayTitle(key) : monthTitle(key)
}

const timeOf = (iso: string) => {
  const d = new Date(iso)
  if (isNaN(+d)) return ''
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

// ── Серии ─────────────────────────────────────────────────────────────────────
// Из сырых записей → массив точек по заданным ключам бакетов.
// Записи вне диапазона ключей игнорируются.
export function buildSeries(input: SeriesInput, keys: string[], g: Granularity): SeriesPoint[] {
  const map = new Map<string, SeriesPoint>()
  for (const k of keys) map.set(k, { key: k, bookings: 0, calls: 0, mails: 0, chats: 0, total: 0 })

  const bump = (iso: string, id: SeriesId) => {
    const p = map.get(bucketKey(iso, g))
    if (!p) return
    p[id]++
    p.total++
  }
  for (const b of input.bookings) bump(b.createdAt, 'bookings')
  for (const c of input.calls) bump(c.ts, 'calls')
  for (const m of input.mails) bump(m.date, 'mails')
  for (const s of input.sessions) bump(s.createdAt, 'chats')

  return keys.map(k => map.get(k)!)
}

// Тренд серии: сравнение последней точки с предыдущей.
// Возвращает процент изменения (null — если сравнивать не с чем).
export function seriesTrend(points: SeriesPoint[], id: SeriesId): number | null {
  if (points.length < 2) return null
  const prev = points[points.length - 2][id]
  const cur = points[points.length - 1][id]
  if (prev === 0) return cur > 0 ? 100 : null
  return Math.round(((cur - prev) / prev) * 100)
}

// ── Детализация бакета ────────────────────────────────────────────────────────
// Название услуги из заявки: objectType, затем первое поле payload,
// похожее на «услуга/service».
export function serviceOf(b: Booking): string | null {
  if (b.objectType) return b.objectType
  if (b.payload) {
    for (const [k, v] of Object.entries(b.payload)) {
      if (/услуга|service/i.test(k) && typeof v === 'string' && v) return v
    }
  }
  return null
}

function bookingText(b: Booking): string {
  const who = b.name ?? b.phone ?? 'без имени'
  const svc = serviceOf(b)
  const st = STATUS_LABEL[b.status] ?? b.status
  return `Заявка — ${who}${svc ? ` (${svc})` : ''}, статус: ${st.toLowerCase()}`
}

export function bucketDetail(key: string, g: Granularity, input: SeriesInput, maxEvents = 20): BucketDetail {
  const inBucket = (iso: string) => bucketKey(iso, g) === key
  const events: DetailEvent[] = []

  const counts: Record<SeriesId, number> = { bookings: 0, calls: 0, mails: 0, chats: 0 }

  for (const b of input.bookings) {
    if (!inBucket(b.createdAt)) continue
    counts.bookings++
    events.push({ ts: b.createdAt, kind: 'bookings', text: bookingText(b) })
  }
  for (const c of input.calls) {
    if (!inBucket(c.ts)) continue
    counts.calls++
    events.push({ ts: c.ts, kind: 'calls', text: `Клик по номеру — страница ${c.page ?? '—'}` })
  }
  for (const m of input.mails) {
    if (!inBucket(m.date)) continue
    counts.mails++
    events.push({
      ts: m.date,
      kind: 'mails',
      text: `Письмо — от ${m.from ?? '—'}${m.subject ? ` «${m.subject}»` : ''}`,
    })
  }
  for (const s of input.sessions) {
    if (!inBucket(s.createdAt)) continue
    counts.chats++
    events.push({
      ts: s.createdAt,
      kind: 'chats',
      text: 'Чат — новая сессия',
      sub: s.lastMessage ?? undefined,
    })
  }

  events.sort((a, b) => (a.ts < b.ts ? 1 : -1))
  return { key, title: bucketTitle(key, g), counts, events: events.slice(0, maxEvents) }
}

export { timeOf }
