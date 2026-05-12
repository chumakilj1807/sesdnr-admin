import type { Booking, ChatSession, Message } from './types'

let _serverUrl = ''
let _token = ''

export function configureApi(serverUrl: string, token: string) {
  _serverUrl = serverUrl.replace(/\/$/, '')
  _token = token
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${_serverUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${_token}`,
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── Bookings ─────────────────────────────────────────────────────────────────
export const fetchBookings = (since?: string) =>
  request<Booking[]>(`/api/app/bookings${since ? `?since=${encodeURIComponent(since)}` : ''}`)

export const patchBooking = (id: string, status: string, notes?: string) =>
  request<Booking>(`/api/app/bookings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, notes }),
  })

// ── Chats ────────────────────────────────────────────────────────────────────
export const fetchChats = () => request<ChatSession[]>('/api/app/chats')

export const fetchMessages = (sessionId: string, since?: string) =>
  request<Message[]>(
    `/api/app/messages?sessionId=${sessionId}${since ? `&since=${encodeURIComponent(since)}` : ''}`
  )

export const sendMessage = (sessionId: string, message: string, adminName: string) =>
  request<Message>('/api/app/chat/send', {
    method: 'POST',
    body: JSON.stringify({ sessionId, message, adminName }),
  })

export const sendTyping = (sessionId: string) =>
  request('/api/app/chat/typing', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  })

export const closeChat = (sessionId: string) =>
  request('/api/app/chat/close', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  })
