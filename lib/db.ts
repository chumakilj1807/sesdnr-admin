import * as SQLite from 'expo-sqlite'
import type { Booking, CallEvent, ChatSession, MailItem, Message } from './types'

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
      createdAt TEXT NOT NULL,
      siteId TEXT NOT NULL DEFAULT '',
      siteName TEXT NOT NULL DEFAULT '',
      payload TEXT
    );

    CREATE TABLE IF NOT EXISTS mail (
      id TEXT NOT NULL,
      siteId TEXT NOT NULL DEFAULT '',
      siteName TEXT NOT NULL DEFAULT '',
      sender TEXT NOT NULL DEFAULT '',
      recipient TEXT,
      subject TEXT,
      snippet TEXT,
      body TEXT,
      date TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (siteId, id)
    );

    CREATE TABLE IF NOT EXISTS call_events (
      id TEXT NOT NULL,
      siteId TEXT NOT NULL DEFAULT '',
      siteName TEXT NOT NULL DEFAULT '',
      page TEXT,
      ts TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (siteId, id)
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'waiting',
      createdAt TEXT NOT NULL,
      lastMessage TEXT,
      lastMessageAt TEXT,
      lastSender TEXT,
      siteId TEXT NOT NULL DEFAULT '',
      siteName TEXT NOT NULL DEFAULT ''
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

  // Миграция: добавляем siteId/siteName, если БД создана старой версией
  await ensureColumn('bookings', 'siteId', "TEXT NOT NULL DEFAULT ''")
  await ensureColumn('bookings', 'siteName', "TEXT NOT NULL DEFAULT ''")
  await ensureColumn('bookings', 'payload', 'TEXT')
  await ensureColumn('chat_sessions', 'siteId', "TEXT NOT NULL DEFAULT ''")
  await ensureColumn('chat_sessions', 'siteName', "TEXT NOT NULL DEFAULT ''")
  return _db
}

async function ensureColumn(table: string, col: string, decl: string) {
  if (!_db) return
  const cols = await _db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`)
  if (!cols.some((c) => c.name === col)) {
    try { await _db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${col} ${decl}`) } catch {}
  }
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
type BookingRow = Omit<Booking, 'payload'> & { payload: string | null }

function parseBooking(row: BookingRow): Booking {
  let payload: Booking['payload'] = null
  if (row.payload) {
    try { payload = JSON.parse(row.payload) } catch {}
  }
  return { ...row, payload }
}

export async function upsertBooking(b: Booking) {
  const db = await getDb()
  await db.runAsync(
    `INSERT OR REPLACE INTO bookings
     (id, type, name, phone, objectType, area, address, date, timeSlot, status, notes, createdAt, siteId, siteName, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [b.id, b.type, b.name ?? null, b.phone, b.objectType ?? null, b.area ?? null,
     b.address ?? null, b.date ?? null, b.timeSlot ?? null, b.status, b.notes ?? null, b.createdAt,
     b.siteId ?? '', b.siteName ?? '', b.payload ? JSON.stringify(b.payload) : null]
  )
}

export async function getBookings(): Promise<Booking[]> {
  const db = await getDb()
  const rows = await db.getAllAsync<BookingRow>('SELECT * FROM bookings ORDER BY createdAt DESC')
  return rows.map(parseBooking)
}

export async function getBookingsForSites(siteIds: string[]): Promise<Booking[]> {
  if (siteIds.length === 0) return []
  const db = await getDb()
  const placeholders = siteIds.map(() => '?').join(',')
  const rows = await db.getAllAsync<BookingRow>(
    `SELECT * FROM bookings WHERE siteId IN (${placeholders}) ORDER BY createdAt DESC`,
    siteIds
  )
  return rows.map(parseBooking)
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
     (id, status, createdAt, lastMessage, lastMessageAt, lastSender, siteId, siteName)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [s.id, s.status, s.createdAt, s.lastMessage ?? null, s.lastMessageAt ?? null,
     s.lastSender ?? null, s.siteId ?? '', s.siteName ?? '']
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

// ── Mail ─────────────────────────────────────────────────────────────────────
type MailRow = {
  id: string; siteId: string; siteName: string; sender: string; recipient: string | null
  subject: string | null; snippet: string | null; body: string | null; date: string; read: number
}

function parseMail(row: MailRow): MailItem & { body: string | null } {
  return {
    id: row.id,
    from: row.sender,
    to: row.recipient,
    subject: row.subject,
    snippet: row.snippet,
    body: row.body,
    date: row.date,
    read: row.read === 1,
    siteId: row.siteId,
    siteName: row.siteName,
  }
}

// upsert не затирает read/body, если сервер их не прислал
export async function upsertMail(m: MailItem) {
  const db = await getDb()
  await db.runAsync(
    `INSERT INTO mail (id, siteId, siteName, sender, recipient, subject, snippet, date, read)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(siteId, id) DO UPDATE SET
       sender = excluded.sender,
       recipient = excluded.recipient,
       subject = excluded.subject,
       snippet = excluded.snippet,
       date = excluded.date`,
    [m.id, m.siteId, m.siteName, m.from, m.to ?? null, m.subject ?? null,
     m.snippet ?? null, m.date, m.read ? 1 : 0]
  )
}

export async function saveMailBody(siteId: string, id: string, body: string) {
  const db = await getDb()
  await db.runAsync('UPDATE mail SET body = ? WHERE siteId = ? AND id = ?', [body, siteId, id])
}

export async function getMail(): Promise<MailItem[]> {
  const db = await getDb()
  const rows = await db.getAllAsync<MailRow>('SELECT * FROM mail ORDER BY date DESC')
  return rows.map(parseMail)
}

export async function getMailById(siteId: string, id: string) {
  const db = await getDb()
  const row = await db.getFirstAsync<MailRow>(
    'SELECT * FROM mail WHERE siteId = ? AND id = ?', [siteId, id]
  )
  return row ? parseMail(row) : null
}

export async function markMailRead(siteId: string, id: string) {
  const db = await getDb()
  await db.runAsync('UPDATE mail SET read = 1 WHERE siteId = ? AND id = ?', [siteId, id])
}

export async function getUnreadMailCount(): Promise<number> {
  const db = await getDb()
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM mail WHERE read = 0')
  return row?.n ?? 0
}

// ── Call events ──────────────────────────────────────────────────────────────
type CallRow = { id: string; siteId: string; siteName: string; page: string | null; ts: string; read: number }

function parseCall(row: CallRow): CallEvent & { read: boolean } {
  return { id: row.id, siteId: row.siteId, siteName: row.siteName, page: row.page, ts: row.ts, read: row.read === 1 }
}

export async function upsertCallEvent(c: CallEvent) {
  const db = await getDb()
  await db.runAsync(
    `INSERT OR IGNORE INTO call_events (id, siteId, siteName, page, ts, read)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [c.id, c.siteId, c.siteName, c.page ?? null, c.ts]
  )
}

export async function getCallEvents(): Promise<(CallEvent & { read: boolean })[]> {
  const db = await getDb()
  const rows = await db.getAllAsync<CallRow>('SELECT * FROM call_events ORDER BY ts DESC')
  return rows.map(parseCall)
}

export async function markAllCallsRead() {
  const db = await getDb()
  await db.runAsync('UPDATE call_events SET read = 1')
}

export async function getUnreadCallsCount(): Promise<number> {
  const db = await getDb()
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM call_events WHERE read = 0')
  return row?.n ?? 0
}
