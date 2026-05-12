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
}

export interface ChatSession {
  id: string
  status: 'waiting' | 'closed'
  createdAt: string
  lastMessage: string | null
  lastMessageAt: string | null
  lastSender: 'user' | 'admin' | null
}

export interface Message {
  id: string
  sessionId: string
  text: string
  sender: 'user' | 'admin'
  createdAt: string
}

export interface AppSettings {
  serverUrl: string
  token: string
  adminName: string
  setupDone: boolean
}
