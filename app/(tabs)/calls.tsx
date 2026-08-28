import { useCallback, useRef, useState } from 'react'
import {
  View, Text, SectionList, StyleSheet, RefreshControl, TouchableOpacity,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useFocusEffect } from 'expo-router'
import { C } from '@/constants/Colors'
import { useStore } from '@/lib/store'
import { fetchAllCalls } from '@/lib/api'
import { getCallEvents, markAllCallsRead, upsertCallEvent } from '@/lib/db'
import { notifyNewCall } from '@/lib/notifications'
import type { CallEvent, Site } from '@/lib/types'
import AppLogo from '@/components/AppLogo'

type CallRow = CallEvent & { read: boolean }

function formatTs(iso: string) {
  try {
    return new Date(iso).toLocaleString('ru', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

export default function CallsScreen() {
  const sites = useStore(s => s.settings.sites)
  const notifyOn = useStore(s => s.settings.notify.calls)
  const clearNewCalls = useStore(s => s.clearNewCalls)
  const incrementNewCalls = useStore(s => s.incrementNewCalls)
  const [events, setEvents] = useState<CallRow[]>([])
  const [siteFilter, setSiteFilter] = useState<string>('all')
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [unsupported, setUnsupported] = useState<Site[]>([])
  const knownIds = useRef<Set<string>>(new Set())
  const initialized = useRef(false)

  const loadFromDb = async () => {
    const local = await getCallEvents()
    setEvents(local)
    for (const c of local) knownIds.current.add(`${c.siteId}:${c.id}`)
  }

  const sync = async () => {
    if (sites.length === 0) return
    try {
      const { items, errors, unsupported: uns } = await fetchAllCalls(sites)
      for (const c of items) await upsertCallEvent(c)
      setEvents(await getCallEvents())
      setUnsupported(uns)

      if (errors.length > 0 && items.length === 0 && uns.length < sites.length) {
        setError('Нет связи · показан кэш')
      } else if (errors.length > 0) {
        setError(`Ошибка с ${errors.length} из ${sites.length} сайтов`)
      } else {
        setError('')
      }

      if (initialized.current) {
        const fresh = items.filter((c) => !knownIds.current.has(`${c.siteId}:${c.id}`))
        if (fresh.length > 0) {
          incrementNewCalls(fresh.length)
          if (notifyOn) await notifyNewCall(fresh[0].siteName, fresh.length)
        }
      }
      for (const c of items) knownIds.current.add(`${c.siteId}:${c.id}`)
      initialized.current = true
    } catch {
      setError('Нет связи · показан кэш')
    }
  }

  useFocusEffect(
    useCallback(() => {
      // Открытие вкладки = прочитали всё: бейдж и точки сбрасываются
      clearNewCalls()
      markAllCallsRead().then(loadFromDb)
      loadFromDb().then(() => {
        initialized.current = true
        sync()
      })
      const t = setInterval(sync, 15000)
      return () => clearInterval(t)
    }, [sites.length, notifyOn])
  )

  const onRefresh = async () => {
    setRefreshing(true)
    await sync()
    setRefreshing(false)
  }

  // Список с учётом фильтра по сайту, дальше — группировка по сайтам, свежие сверху
  const visible = siteFilter === 'all' ? events : events.filter(e => e.siteId === siteFilter)
  const sections = sites
    .map(site => ({
      title: site.name,
      data: visible.filter(e => e.siteId === site.id),
    }))
    .filter(sec => sec.data.length > 0)
  // События с сайтов, которых уже нет в настройках
  const orphan = visible.filter(e => !sites.some(st => st.id === e.siteId))
  if (orphan.length > 0) sections.push({ title: 'Другие сайты', data: orphan })

  const unreadCount = events.filter(e => !e.read).length
  const allUnsupported =
    sites.length > 0 && unsupported.length === sites.length && events.length === 0

  return (
    <View style={s.container}>
      <View style={s.header}>
        <AppLogo />
        <View style={{ flex: 1 }}>
          <Text style={s.appName}>Xenom Manager</Text>
          <Text style={s.title}>Звонки</Text>
          <View style={s.subRow}>
            <Text style={s.sub}>{events.length} кликов</Text>
            <View style={s.dot} />
            <Text style={s.sub}>{unreadCount} новых</Text>
            <View style={s.dot} />
            <Text style={s.sub}>{sites.length} сайт{sites.length === 1 ? '' : sites.length < 5 ? 'а' : 'ов'}</Text>
          </View>
        </View>
      </View>

      {error ? (
        <View style={s.errorBanner}>
          <Feather name="wifi-off" size={14} color={C.error} />
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Фильтр по сайтам — только если их больше одного */}
      {sites.length > 1 && (
        <View style={s.siteFilters}>
          <TouchableOpacity
            style={[s.siteChip, siteFilter === 'all' && s.siteChipActive]}
            onPress={() => setSiteFilter('all')}
            activeOpacity={0.7}
          >
            <Feather name="layers" size={11} color={siteFilter === 'all' ? '#7C3AED' : C.textSecondary} />
            <Text style={[s.siteChipText, siteFilter === 'all' && s.siteChipTextActive]}>Все сайты</Text>
          </TouchableOpacity>
          {sites.map(site => {
            const count = events.filter(e => e.siteId === site.id).length
            const active = siteFilter === site.id
            return (
              <TouchableOpacity
                key={site.id}
                style={[s.siteChip, active && s.siteChipActive]}
                onPress={() => setSiteFilter(site.id)}
                activeOpacity={0.7}
              >
                <Feather name="globe" size={11} color={active ? '#7C3AED' : C.textSecondary} />
                <Text style={[s.siteChipText, active && s.siteChipTextActive]} numberOfLines={1}>
                  {site.name}
                </Text>
                {count > 0 && <Text style={[s.siteChipCount, active && s.siteChipCountActive]}>{count}</Text>}
              </TouchableOpacity>
            )
          })}
        </View>
      )}

      {unsupported.length > 0 && unsupported.length < sites.length && (
        <View style={s.warnBanner}>
          <Feather name="alert-circle" size={14} color={C.warning} />
          <Text style={s.warnText} numberOfLines={2}>
            События звонков не настроены: {unsupported.map(x => x.name).join(', ')}
          </Text>
        </View>
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item) => `${item.siteId}:${item.id}`}
        renderSectionHeader={({ section }) => (
          <View style={s.sectionHeader}>
            <Feather name="globe" size={12} color="#7C3AED" />
            <Text style={s.sectionTitle}>{section.title}</Text>
            <Text style={s.sectionCount}>{section.data.length}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={[s.callCard, !item.read && s.callCardUnread]}>
            <View style={s.callIconWrap}>
              <Feather name="phone-forwarded" size={15} color={C.cyan} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={s.callTop}>
                <Text style={[s.callTitle, !item.read && s.callTitleUnread]}>
                  Клик по номеру
                </Text>
                {!item.read && <View style={s.unreadDot} />}
              </View>
              {item.page ? (
                <Text style={s.callPage} numberOfLines={1}>{item.page}</Text>
              ) : null}
            </View>
            <Text style={s.callTs}>{formatTs(item.ts)}</Text>
          </View>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 32, flexGrow: 1 }}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <View style={s.empty}>
            <View style={s.emptyIconWrap}>
              <Feather name="phone" size={28} color={C.textMuted} />
            </View>
            <Text style={s.emptyText}>
              {sites.length === 0
                ? 'Не добавлен ни один сайт'
                : allUnsupported
                  ? 'События звонков не настроены'
                  : 'Кликов по номеру пока нет'}
            </Text>
            <Text style={s.emptySub}>
              {sites.length === 0
                ? 'Откройте «Настройки» и добавьте сайт'
                : allUnsupported
                  ? 'Добавьте эндпоинт /api/app/calls на сайт, чтобы видеть клики по номеру'
                  : 'Когда посетитель нажмёт на номер на сайте, событие появится здесь'}
            </Text>
          </View>
        }
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16,
  },
  appName: { fontSize: 10, fontWeight: '700', color: '#7C3AED', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' },
  sub: { fontSize: 12, color: C.textMuted },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: C.textMuted },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.errorDim, marginHorizontal: 16, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8,
    borderWidth: 1, borderColor: `${C.error}33`,
  },
  errorText: { color: C.error, fontSize: 13, flex: 1 },
  warnBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.warningDim, marginHorizontal: 16, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8,
    borderWidth: 1, borderColor: `${C.warning}33`,
  },
  warnText: { color: C.warning, fontSize: 13, flex: 1 },

  siteFilters: {
    flexDirection: 'row', paddingHorizontal: 16, gap: 6, marginBottom: 8, flexWrap: 'wrap',
  },
  siteChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border, maxWidth: 200,
  },
  siteChipActive: { backgroundColor: '#7C3AED22', borderColor: '#7C3AED88' },
  siteChipText: { fontSize: 12, color: C.textSecondary, fontWeight: '600' },
  siteChipTextActive: { color: '#7C3AED' },
  siteChipCount: {
    backgroundColor: C.border, borderRadius: 8, paddingHorizontal: 5,
    fontSize: 10, fontWeight: '700', color: C.textSecondary, marginLeft: 2,
  },
  siteChipCountActive: { backgroundColor: '#7C3AED', color: '#fff' },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, marginBottom: 8,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: C.text, flex: 1 },
  sectionCount: { fontSize: 11, fontWeight: '700', color: C.textMuted },

  callCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    padding: 12, marginBottom: 8,
  },
  callCardUnread: { borderColor: `${C.cyan}55`, backgroundColor: '#0f1a24' },
  callIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: C.cyanDim, borderWidth: 1, borderColor: `${C.cyan}44`,
    alignItems: 'center', justifyContent: 'center',
  },
  callTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  callTitle: { fontSize: 14, fontWeight: '500', color: C.textSecondary },
  callTitleUnread: { color: C.text, fontWeight: '700' },
  unreadDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.cyan },
  callPage: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  callTs: { fontSize: 11, color: C.textMuted },

  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyText: { color: C.text, fontSize: 16, fontWeight: '600', marginBottom: 4, textAlign: 'center', paddingHorizontal: 24 },
  emptySub: { color: C.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 32 },
})
