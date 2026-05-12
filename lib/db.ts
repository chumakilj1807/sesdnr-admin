import * as SQLite from 'expo-sqlite'
import type { Booking, ChatSession, Message } from './types'

let _db: SQLite.SQLiteDatabase | null = null

export async function getDb() {
  if (_db) return _db
  _db = await SQLite.openDatabaseAsync('sesdnr.db')
  await _db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT,
      phone TEXT NOT NULL,
      objectType TEXT,
      area REAL,
      address TEXT,
      date TEXT,
      timeSlot TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      notes TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'waiting',
      createdAt TEXT NOT NULL,
      lastMessage TEXT,
      lastMessageAt TEXT,
      lastSender TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      text TEXT NOT NULL,
      sender TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `)
  return _db
}

// ── Settings ─────────────────────────────────────────────────────────────────
export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb()
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key])
  return row?.value ?? null
}

export async function setSetting(key: string, value: string) {
  const db = await getDb()
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value])
}

// ── Bookings ─────────────────────────────────────────────────────────────────
export async function upsertBooking(b: Booking) {
  const db = await getDb()
  await db.runAsync(
    `INSERT OR REPLACE INTO bookings
     (id, type, name, phone, objectType, area, address, date, timeSlot, status, notes, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [b.id, b.type, b.name ?? null, b.phone, b.objectType ?? null, b.area ?? null,
     b.address ?? null, b.date ?? null, b.timeSlot ?? null, b.status, b.notes ?? null, b.createdAt]
  )
}

export async function getBookings(): Promise<Booking[]> {
  const db = await getDb()
  return db.getAllAsync<Booking>('SELECT * FROM bookings ORDER BY createdAt DESC')
}

export async function updateBookingLocal(id: string, status: string, notes?: string) {
  const db = await getDb()
  await db.runAsync(
    'UPDATE bookings SET status = ?, notes = COALESCE(?, notes) WHERE id = ?',
    [status, notes ?? null, id]
  )
}

// ── Chat sessions ─────────────────────────────────────────────────────────────
export async function upsertSession(s: ChatSession) {
  const db = await getDb()
  await db.runAsync(
    `INSERT OR REPLACE INTO chat_sessions
     (id, status, createdAt, lastMessage, lastMessageAt, lastSender)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [s.id, s.status, s.createdAt, s.lastMessage ?? null, s.lastMessageAt ?? null, s.lastSender ?? null]
  )
}

export async function getSessions(): Promise<ChatSession[]> {
  const db = await getDb()
  return db.getAllAsync<ChatSession>('SELECT * FROM chat_sessions ORDER BY createdAt DESC')
}

export async function updateSessionStatus(id: string, status: string) {
  const db = await getDb()
  await db.runAsync('UPDATE chat_sessions SET status = ? WHERE id = ?', [status, id])
}

// ── Messages ─────────────────────────────────────────────────────────────────
export async function upsertMessage(m: Message) {
  const db = await getDb()
  await db.runAsync(
    'INSERT OR REPLACE INTO messages (id, sessionId, text, sender, createdAt) VALUES (?, ?, ?, ?, ?)',
    [m.id, m.sessionId, m.text, m.sender, m.createdAt]
  )
}

export async function getMessages(sessionId: string): Promise<Message[]> {
  const db = await getDb()
  return db.getAllAsync<Message>('SELECT * FROM messages WHERE sessionId = ? ORDER BY createdAt ASC', [sessionId])
}

export async function getLastMessageId(sessionId: string): Promise<string | null> {
  const db = await getDb()
  const row = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM messages WHERE sessionId = ? ORDER BY createdAt DESC LIMIT 1', [sessionId]
  )
  return row?.id ?? null
}
