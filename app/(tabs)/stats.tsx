import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useFocusEffect } from 'expo-router'
import { C, STATUS_LABEL } from '@/constants/Colors'
import { useStore } from '@/lib/store'
import { getBookings, getCallEvents, getMail, getSessions } from '@/lib/db'
import type { Booking } from '@/lib/types'
import StatsLineChart, { SERIES_META } from '@/components/StatsLineChart'
import AppLogo from '@/components/AppLogo'
import {
  buildSeries,
  bucketDetail,
  dayKey,
  daysOfMonth,
  daysRange,
  lastMonths,
  localDayKey,
  monthKey,
  monthLabel,
  seriesTrend,
  timeOf,
  type Granularity,
  type SeriesId,
  type SeriesInput,
} from '@/lib/statsSeries'

// Тестовая заявка: подстрока «тест» (регистронезависимо) в имени,
// заметках или в любом строковом значении произвольных полей формы.
// Из статистики исключаем, но из БД не удаляем.
export function isTestBooking(b: Booking): boolean {
  const values: unknown[] = [b.name, b.notes]
  if (b.payload) values.push(...Object.values(b.payload))
  return values.some(v => typeof v === 'string' && v.toLowerCase().includes('тест'))
}

const SERIES_IDS: SeriesId[] = ['bookings', 'calls', 'mails', 'chats']

// Дневные окна (в днях) для уровней зума без фильтра по месяцу
const DAY_WINDOWS = [90, 30, 14, 7]

const KIND_ICON: Record<SeriesId, string> = {
  bookings: 'clipboard',
  calls: 'phone',
  mails: 'mail',
  chats: 'message-circle',
}

export default function StatsScreen() {
  const sites = useStore(s => s.settings.sites)
  const [bookings, setBookings] = useState<Awaited<ReturnType<typeof getBookings>>>([])
  const [sessions, setSessions] = useState<Awaited<ReturnType<typeof getSessions>>>([])
  const [mails, setMails] = useState<Awaited<ReturnType<typeof getMail>>>([])
  const [calls, setCalls] = useState<Awaited<ReturnType<typeof getCallEvents>>>([])
  const [siteFilter, setSiteFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('all')

  // График: дискретные уровни зума (кнопки-лупы).
  // Без фильтра по месяцу: 0 — все месяцы, 1..4 — окна 90/30/14/7 дней.
  // С фильтром по месяцу: 0 — весь месяц, 1 — 14 дней, 2 — 7 дней.
  const [zoomLevel, setZoomLevel] = useState(0)
  const [visibleSeries, setVisibleSeries] = useState<Record<SeriesId, boolean>>({
    bookings: true,
    calls: true,
    mails: true,
    chats: true,
  })
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

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

  // Данные графика: фильтр по сайту применяется, фильтр по месяцу —
  // переключает график на дневную гранулярность внутри этого месяца
  const chartInput: SeriesInput = useMemo(
    () => ({
      bookings: realBookings.filter(b => inSite(b.siteId)),
      calls: calls.filter(c => inSite(c.siteId)),
      mails: mails.filter(m => inSite(m.siteId)),
      sessions: sessions.filter(s => inSite(s.siteId)),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [realBookings, calls, mails, sessions, siteFilter]
  )

  // Гранулярность: обзорный уровень (0) без фильтра — месяцы, иначе дни
  const effGranularity: Granularity = monthFilter === 'all' && zoomLevel === 0 ? 'month' : 'day'

  // Дневные ключи от первой записи до сегодня (максимум 370 дней)
  const dayKeysAll = useMemo(() => {
    let min = ''
    const times = [
      ...chartInput.bookings.map(b => b.createdAt),
      ...chartInput.calls.map(c => c.ts),
      ...chartInput.mails.map(m => m.date),
      ...chartInput.sessions.map(s => s.createdAt),
    ]
    for (const t of times) if (t && (!min || t < min)) min = t
    const today = new Date()
    const todayK = localDayKey(today)
    const capK = localDayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 369))
    let startK = min ? dayKey(min) : todayK
    if (startK > todayK) startK = todayK
    if (startK < capK) startK = capK
    return daysRange(startK, todayK)
  }, [chartInput])

  const chartKeys = useMemo(() => {
    // Фильтр по месяцу — дневная гранулярность внутри этого месяца
    if (monthFilter !== 'all') return daysOfMonth(monthFilter)
    if (effGranularity === 'day') return dayKeysAll
    // Обзор: все месяцы с данными, минимум последние 12
    const keys = new Set(lastMonths(12))
    for (const b of chartInput.bookings) keys.add(monthKey(b.createdAt))
    for (const c of chartInput.calls) keys.add(monthKey(c.ts))
    for (const m of chartInput.mails) keys.add(monthKey(m.date))
    for (const s of chartInput.sessions) keys.add(monthKey(s.createdAt))
    keys.delete('')
    return [...keys].sort()
  }, [effGranularity, monthFilter, chartInput, dayKeysAll])

  // Размер окна в точках для текущего уровня зума
  const monthDays = monthFilter !== 'all' ? daysOfMonth(monthFilter).length : 0
  const dayWindows = monthFilter !== 'all' ? [monthDays, 14, 7] : DAY_WINDOWS
  const windowSize =
    effGranularity === 'month' ? undefined : dayWindows[Math.min(zoomLevel - (monthFilter !== 'all' ? 0 : 1), dayWindows.length - 1)]
  const canZoomIn = zoomLevel < dayWindows.length - (monthFilter !== 'all' ? 1 : 0)
  const canZoomOut = zoomLevel > 0

  const points = useMemo(
    () => buildSeries(chartInput, chartKeys, effGranularity),
    [chartInput, chartKeys, effGranularity]
  )
  const hasChartData = points.some(p => p.total > 0)

  // Детализация выбранной точки
  const detail = useMemo(
    () => (selectedKey ? bucketDetail(selectedKey, effGranularity, chartInput) : null),
    [selectedKey, effGranularity, chartInput]
  )

  // Смена фильтров/уровня зума сбрасывает выбранную точку
  useEffect(() => {
    setSelectedKey(null)
  }, [monthFilter, effGranularity, siteFilter, zoomLevel])

  // Смена сайта/месяца — зум обратно на обзорный уровень
  useEffect(() => {
    setZoomLevel(0)
  }, [monthFilter, siteFilter])

  const zoomIn = useCallback(() => {
    if (canZoomIn) setZoomLevel(l => l + 1)
  }, [canZoomIn])
  const zoomOut = useCallback(() => {
    if (canZoomOut) setZoomLevel(l => l - 1)
  }, [canZoomOut])
  const onSelectPoint = useCallback((key: string) => {
    setSelectedKey(prev => (prev === key ? null : key))
  }, [])

  const fmtEventTime = (ts: string) => {
    const d = new Date(ts)
    if (isNaN(+d)) return ''
    const hm = timeOf(ts)
    if (effGranularity === 'day') return hm
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} ${hm}`
  }

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
        <AppLogo />
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

      {/* Динамика: мультисерийный линейный график */}
      <View style={s.card}>
        <View style={s.chartHeader}>
          <Text style={s.cardTitle}>
            {effGranularity === 'month' ? 'Динамика по месяцам' : 'Динамика по дням'}
          </Text>
          {/* Лупы: шаг по дискретным уровням зума */}
          <View style={s.zoomBtns}>
            <TouchableOpacity
              onPress={zoomOut}
              disabled={!canZoomOut}
              style={[s.zoomBtn, !canZoomOut && s.zoomBtnOff]}
              activeOpacity={0.7}
            >
              <Feather name="zoom-out" size={14} color={canZoomOut ? C.primary : C.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={zoomIn}
              disabled={!canZoomIn}
              style={[s.zoomBtn, !canZoomIn && s.zoomBtnOff]}
              activeOpacity={0.7}
            >
              <Feather name="zoom-in" size={14} color={canZoomIn ? C.primary : C.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Легенда: тап по чипу скрывает/показывает серию */}
        <View style={s.chips}>
          {SERIES_IDS.map(id => {
            const on = visibleSeries[id]
            const trend = seriesTrend(points, id)
            return (
              <TouchableOpacity
                key={id}
                style={[s.chip, on && { borderColor: SERIES_META[id].color + '88', backgroundColor: SERIES_META[id].color + '22' }]}
                onPress={() => setVisibleSeries(v => ({ ...v, [id]: !v[id] }))}
                activeOpacity={0.7}
              >
                <View style={[s.legendDot, { backgroundColor: on ? SERIES_META[id].color : C.textMuted }]} />
                <Text style={[s.chipText, on && { color: SERIES_META[id].color }]}>
                  {SERIES_META[id].label}
                </Text>
                {trend !== null && on && (
                  <Text style={[s.trendText, { color: trend >= 0 ? C.success : C.error }]}>
                    {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
                  </Text>
                )}
              </TouchableOpacity>
            )
          })}
        </View>

        {hasChartData ? (
          <StatsLineChart
            points={points}
            granularity={effGranularity}
            visible={visibleSeries}
            selectedKey={selectedKey}
            onSelect={onSelectPoint}
            windowSize={windowSize}
          />
        ) : (
          <Text style={s.chartEmpty}>Нет данных за период</Text>
        )}
      </View>

      {/* Детализация выбранной точки */}
      {detail && (
        <View style={s.card}>
          <Text style={s.cardTitle}>{detail.title}</Text>
          <View style={s.detailCounts}>
            {SERIES_IDS.map(id => (
              <View key={id} style={s.detailCountCell}>
                <Feather name={KIND_ICON[id] as any} size={11} color={SERIES_META[id].color} />
                <Text style={[s.detailCountNum, { color: SERIES_META[id].color }]}>
                  {detail.counts[id]}
                </Text>
                <Text style={s.detailCountLbl}>{SERIES_META[id].label}</Text>
              </View>
            ))}
          </View>
          {detail.events.length === 0 ? (
            <Text style={s.chartEmpty}>Событий нет</Text>
          ) : (
            detail.events.map((e, i) => (
              <View key={`${e.ts}-${i}`} style={s.eventRow}>
                <View style={[s.eventDot, { backgroundColor: SERIES_META[e.kind].color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.eventText}>
                    <Text style={s.eventTime}>{fmtEventTime(e.ts)} · </Text>
                    {e.text}
                  </Text>
                  {e.sub ? (
                    <Text style={s.eventSub} numberOfLines={1}>
                      «{e.sub}»
                    </Text>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </View>
      )}

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
  appName: { fontSize: 10, fontWeight: '700', color: '#7C3AED', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.5 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
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

  chartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  zoomBtns: { flexDirection: 'row', gap: 6 },
  zoomBtn: {
    width: 30, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0d1420', borderWidth: 1, borderColor: C.border,
  },
  zoomBtnOff: { opacity: 0.45 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  trendText: { fontSize: 10, fontWeight: '800' },
  chartEmpty: { fontSize: 12, color: C.textMuted, textAlign: 'center', paddingVertical: 24 },

  detailCounts: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  detailCountCell: {
    flex: 1, backgroundColor: '#0d1420', borderRadius: 10, borderWidth: 1, borderColor: C.border,
    paddingVertical: 8, alignItems: 'center', gap: 2,
  },
  detailCountNum: { fontSize: 15, fontWeight: '800' },
  detailCountLbl: { fontSize: 9, color: C.textMuted },
  eventRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingVertical: 7, borderTopWidth: 1, borderTopColor: C.border,
  },
  eventDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  eventText: { fontSize: 12, color: C.text, lineHeight: 17 },
  eventTime: { color: C.textSecondary, fontWeight: '700' },
  eventSub: { fontSize: 11, color: C.textMuted, marginTop: 1 },

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
