export interface Site {
  id: string
  name: string
  serverUrl: string
  token: string
}

export interface AppSettings {
  adminName: string
  setupDone: boolean
  sites: Site[]
  currentSiteId: string // deprecated — оставлено для совместимости со старой версией
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
