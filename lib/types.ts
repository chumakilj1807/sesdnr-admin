export interface Site {
  id: string
  name: string
  serverUrl: string
  token: string
}

// Переключатели push-уведомлений по типам событий.
// false = события по-прежнему собираются в приложение, но пуши не приходят.
export interface NotifySettings {
  bookings: boolean
  chats: boolean
  calls: boolean
  mail: boolean
}

export interface AppSettings {
  adminName: string
  setupDone: boolean
  sites: Site[]
  currentSiteId: string // deprecated — оставлено для совместимости со старой версией
  notify: NotifySettings
}

export interface Booking {
  id: string
  type: 'booking' | 'callback'
  name: string | null
  phone: string
  objectType: string | null
  area: number | null
  address: string | null
  date: string | null
  timeSlot: string | null
  status: 'new' | 'processing' | 'done' | 'cancelled'
  notes: string | null
  createdAt: string
  // С какого сайта пришла заявка — заполняется при агрегации feed
  siteId: string
  siteName: string
  // Произвольные поля формы сайта (у разных сайтов разные формы).
  // Всё, что не name/phone, показывается в карточке как «поле: значение».
  payload: Record<string, unknown> | null
}

export interface MailItem {
  id: string
  from: string
  to: string | null
  subject: string | null
  snippet: string | null
  date: string // ISO
  read: boolean
  siteId: string
  siteName: string
}

export interface MailDetail extends MailItem {
  body: string | null
}

// Событие клика по номеру телефона на сайте
export interface CallEvent {
  id: string
  page: string | null
  ts: string // ISO
  siteId: string
  siteName: string
}

export interface ChatSession {
  id: string
  status: 'waiting' | 'closed'
  createdAt: string
  lastMessage: string | null
  lastMessageAt: string | null
  lastSender: 'user' | 'admin' | null
  // С какого сайта чат
  siteId: string
  siteName: string
}

export interface Message {
  id: string
  sessionId: string
  text: string
  sender: 'user' | 'admin'
  createdAt: string
}
