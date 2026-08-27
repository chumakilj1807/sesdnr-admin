import { useCallback, useMemo, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useFocusEffect } from 'expo-router'
import { C, STATUS_LABEL } from '@/constants/Colors'
import { useStore } from '@/lib/store'
import { getBookings, getCallEvents, getMail, getSessions } from '@/lib/db'
import type { Booking } from '@/lib/types'

// Тестовая заявка: подстрока «тест» (регистронезависимо) в имени,
// заметках или в любом строковом значении произвольных полей формы.
// Из статистики исключаем, но из БД не удаляем.
export function isTestBooking(b: Booking): boolean {
  const values: unknown[] = [b.name, b.notes]
  if (b.payload) values.push(...Object.values(b.payload))
  return values.some(v => typeof v === 'string' && v.toLowerCase().includes('тест'))
}

// Ключ месяца YYYY-MM из ISO-даты
const monthKey = (iso: string) => (iso ?? '').slice(0, 7)

function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number)
  if (!y || !m) return key
  return new Date(y, m - 1, 1).toLocaleString('ru', { month: 'short' })
}

// Последние N месяцев включая текущий, ключи YYYY-MM
function lastMonths(n: number): string[] {
  const out: string[] = []
  const d = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const t = new Date(d.getFullYear(), d.getMonth() - i, 1)
    out.push(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

export default function StatsScreen() {
  const sites = useStore(s => s.settings.sites)
  const [bookings, setBookings] = useState<Awaited<ReturnType<typeof getBookings>>>([])
  const [sessions, setSessions] = useState<Awaited<ReturnType<typeof getSessions>>>([])
  const [mails, setMails] = useState<Awaited<ReturnType<typeof getMail>>>([])
  const [calls, setCalls] = useState<Awaited<ReturnType<typeof getCallEvents>>>([])
  const [siteFilter, setSiteFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('all')

  const load = async () => {
    const [b, sess, m, c] = await Promise.all([getBookings(), getSessions(), getMail(), getCallEvents()])
    setBookings(b)
    setSessions(sess)
    setMails(m)
    setCalls(c)
  }

  useFocusEffect(
    useCallback(() => {
      load()
      const t = setInterval(load, 30000)
      return () => clearInterval(t)
    }, [])
  )

  // Тестовые заявки не участвуют ни в одном счётчике статистики
  const realBookings = useMemo(() => bookings.filter(b => !isTestBooking(b)), [bookings])

  // Месяцы, в которых есть хоть какие-то данные (для чипов фильтра)
  const availableMonths = useMemo(() => {
    const keys = new Set<string>()
    for (const b of realBookings) keys.add(monthKey(b.createdAt))
    for (const s of sessions) keys.add(monthKey(s.createdAt))
    for (const m of mails) keys.add(monthKey(m.date))
    for (const c of calls) keys.add(monthKey(c.ts))
    keys.delete('')
    return [...keys].sort().reverse().slice(0, 6)
  }, [realBookings, sessions, mails, calls])

  const inSite = (siteId: string) => siteFilter === 'all' || siteId === siteFilter
  const inMonth = (iso: string) => monthFilter === 'all' || monthKey(iso) === monthFilter

  const fBookings = realBookings.filter(b => inSite(b.siteId) && inMonth(b.createdAt))
  const fSessions = sessions.filter(s => inSite(s.siteId) && inMonth(s.createdAt))
  const fMails = mails.filter(m => inSite(m.siteId) && inMonth(m.date))
  const fCalls = calls.filter(c => inSite(c.siteId) && inMonth(c.ts))

  const byStatus = {
    new: fBookings.filter(b => b.status === 'new').length,
    processing: fBookings.filter(b => b.status === 'processing').length,
    done: fBookings.filter(b => b.status === 'done').length,
    cancelled: fBookings.filter(b => b.status === 'cancelled').length,
  }

  // График: заявки по месяцам — последние 6 месяцев плюс ВСЕ месяцы,
  // в которых есть заявки (по возрастанию, максимум 12 колонок)
  const chartMonths = useMemo(() => {
    const keys = new Set(lastMonths(6))
    for (const b of realBookings) {
      const k = monthKey(b.createdAt)
      if (k) keys.add(k)
    }
    return [...keys].sort().slice(-12)
  }, [realBookings])
  const chartData = chartMonths.map(k => ({
    key: k,
    label: monthLabel(k),
    count: realBookings.filter(b => inSite(b.siteId) && monthKey(b.createdAt) === k).length,
  }))
  const chartMax = Math.max(1, ...chartData.map(d => d.count))

  // Сводка по каждому сайту (без учёта фильтров)
  const perSite = sites.map(site => ({
    site,
    bookings: realBookings.filter(b => b.siteId === site.id),
    mails: mails.filter(m => m.siteId === site.id).length,
    calls: calls.filter(c => c.siteId === site.id).length,
    chats: sessions.filter(x => x.siteId === site.id).length,
  }))

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={s.container}>
      <View style={s.header}>
        <View style={s.logoWrap}>
          <Text style={s.logoX}>X</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.appName}>Xenom Manager</Text>
          <Text style={s.title}>Статистика</Text>
        </View>
      </View>

      {/* Фильтр по сайту */}
      {sites.length > 1 && (
        <View style={s.chips}>
          <TouchableOpacity
            style={[s.chip, siteFilter === 'all' && s.chipActive]}
            onPress={() => setSiteFilter('all')}
            activeOpacity={0.7}
          >
            <Text style={[s.chipText, siteFilter === 'all' && s.chipTextActive]}>Все сайты</Text>
          </TouchableOpacity>
          {sites.map(site => (
            <TouchableOpacity
              key={site.id}
              style={[s.chip, siteFilter === site.id && s.chipActive]}
              onPress={() => setSiteFilter(site.id)}
              activeOpacity={0.7}
            >
              <Text style={[s.chipText, siteFilter === site.id && s.chipTextActive]} numberOfLines={1}>
                {site.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Фильтр по месяцу */}
      {availableMonths.length > 0 && (
        <View style={s.chips}>
          <TouchableOpacity
            style={[s.chip, monthFilter === 'all' && s.chipActive]}
            onPress={() => setMonthFilter('all')}
            activeOpacity={0.7}
          >
            <Text style={[s.chipText, monthFilter === 'all' && s.chipTextActive]}>Всё время</Text>
          </TouchableOpacity>
          {availableMonths.map(k => (
            <TouchableOpacity
              key={k}
              style={[s.chip, monthFilter === k && s.chipActive]}
              onPress={() => setMonthFilter(k)}
              activeOpacity={0.7}
            >
              <Text style={[s.chipText, monthFilter === k && s.chipTextActive]}>
                {monthLabel(k)} {k.slice(2, 4)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Общая сводка */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Заявки</Text>
        <Text style={s.bigNumber}>{fBookings.length}</Text>
        <View style={s.statusGrid}>
          {(['new', 'processing', 'done', 'cancelled'] as const).map(st => (
            <View key={st} style={s.statusCell}>
              <Text style={s.statusNum}>{byStatus[st]}</Text>
              <Text style={s.statusLbl}>{STATUS_LABEL[st]}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={s.rowCards}>
        <View style={[s.card, s.halfCard]}>
          <Feather name="message-circle" size={14} color={C.primary} />
          <Text style={s.midNumber}>{fSessions.length}</Text>
          <Text style={s.cardSub}>Чаты</Text>
        </View>
        <View style={[s.card, s.halfCard]}>
          <Feather name="phone" size={14} color={C.cyan} />
          <Text style={s.midNumber}>{fCalls.length}</Text>
          <Text style={s.cardSub}>Звонки</Text>
        </View>
        <View style={[s.card, s.halfCard]}>
          <Feather name="mail" size={14} color={C.warning} />
          <Text style={s.midNumber}>{fMails.length}</Text>
          <Text style={s.cardSub}>Письма</Text>
        </View>
      </View>

      {/* График заявок по месяцам */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Заявки по месяцам</Text>
        <View style={s.chart}>
          {chartData.map(d => (
            <View key={d.key} style={s.chartCol}>
              <Text style={s.chartVal}>{d.count > 0 ? d.count : ''}</Text>
              <View style={s.chartBarTrack}>
                <View
                  style={[
                    s.chartBar,
                    { height: Math.max(4, Math.round((d.count / chartMax) * 120)) },
                  ]}
                />
              </View>
              <Text style={s.chartLbl}>{d.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* По сайтам */}
      {siteFilter === 'all' && perSite.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>По сайтам</Text>
          {perSite.map(({ site, bookings: sb, mails: sm, calls: sc, chats }) => (
            <View key={site.id} style={s.siteRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.siteName} numberOfLines={1}>{site.name}</Text>
              </View>
              <View style={s.siteStat}>
                <Feather name="clipboard" size={11} color={C.textMuted} />
                <Text style={s.siteStatText}>{sb.length}</Text>
              </View>
              <View style={s.siteStat}>
                <Feather name="message-circle" size={11} color={C.textMuted} />
                <Text style={s.siteStatText}>{chats}</Text>
              </View>
              <View style={s.siteStat}>
                <Feather name="phone" size={11} color={C.textMuted} />
                <Text style={s.siteStatText}>{sc}</Text>
              </View>
              <View style={s.siteStat}>
                <Feather name="mail" size={11} color={C.textMuted} />
                <Text style={s.siteStatText}>{sm}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {bookings.length === 0 && mails.length === 0 && calls.length === 0 && (
        <View style={s.empty}>
          <Feather name="bar-chart-2" size={28} color={C.textMuted} />
          <Text style={s.emptyText}>Данных пока нет</Text>
          <Text style={s.emptySub}>Статистика появится после первых заявок, писем и звонков</Text>
        </View>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingTop: 32, paddingBottom: 16,
  },
  logoWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center',
    elevation: 6,
    shadowColor: '#7C3AED', shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  logoX: { fontSize: 22, fontWeight: '900', color: '#fff' },
  appName: { fontSize: 10, fontWeight: '700', color: '#7C3AED', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.5 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  chipActive: { backgroundColor: '#7C3AED22', borderColor: '#7C3AED88' },
  chipText: { fontSize: 12, color: C.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#7C3AED' },

  card: {
    backgroundColor: C.card, borderRadius: 16,
    borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 12,
  },
  cardTitle: { fontSize: 11, color: C.textMuted, letterSpacing: 1, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  bigNumber: { fontSize: 34, fontWeight: '800', color: C.text, marginBottom: 10 },
  midNumber: { fontSize: 24, fontWeight: '800', color: C.text, marginTop: 6 },
  cardSub: { fontSize: 12, color: C.textMuted, marginTop: 2 },

  statusGrid: { flexDirection: 'row', gap: 8 },
  statusCell: {
    flex: 1, backgroundColor: '#0d1420', borderRadius: 10, borderWidth: 1, borderColor: C.border,
    paddingVertical: 10, alignItems: 'center',
  },
  statusNum: { fontSize: 16, fontWeight: '800', color: C.text },
  statusLbl: { fontSize: 10, color: C.textMuted, marginTop: 2 },

  rowCards: { flexDirection: 'row', gap: 10 },
  halfCard: { flex: 1, alignItems: 'flex-start' },

  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 8 },
  chartCol: { flex: 1, alignItems: 'center' },
  chartVal: { fontSize: 10, fontWeight: '700', color: C.textSecondary, marginBottom: 4, height: 14 },
  chartBarTrack: { height: 120, justifyContent: 'flex-end' },
  chartBar: {
    width: '100%', maxWidth: 34, borderRadius: 6,
    backgroundColor: '#7C3AED',
  },
  chartLbl: { fontSize: 10, color: C.textMuted, marginTop: 6 },

  siteRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  siteName: { fontSize: 14, fontWeight: '600', color: C.text },
  siteStat: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 36, justifyContent: 'flex-end' },
  siteStatText: { fontSize: 13, fontWeight: '700', color: C.textSecondary },

  empty: { alignItems: 'center', paddingTop: 40, gap: 8 },
  emptyText: { color: C.text, fontSize: 16, fontWeight: '600' },
  emptySub: { color: C.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 32 },
})
