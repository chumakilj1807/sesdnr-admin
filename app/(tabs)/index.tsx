import { useCallback, useRef, useState } from 'react'
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TouchableOpacity, TextInput,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useFocusEffect } from 'expo-router'
import { C } from '@/constants/Colors'
import { useStore } from '@/lib/store'
import { fetchAllBookings, patchBookingFor } from '@/lib/api'
import { getBookings, upsertBooking, updateBookingLocal } from '@/lib/db'
import BookingCard from '@/components/BookingCard'
import { notifyNewBooking } from '@/lib/notifications'

const FILTERS = [
  { key: 'all', label: 'Все' },
  { key: 'new', label: 'Новые' },
  { key: 'processing', label: 'В работе' },
  { key: 'done', label: 'Готово' },
]

export default function BookingsScreen() {
  const { bookings, setBookings, updateBooking, clearNewBookings, incrementNewBookings } = useStore()
  const sites = useStore(s => s.settings.sites)
  const notifyOn = useStore(s => s.settings.notify?.bookings ?? true)
  const siteById = useStore(s => s.siteById)
  const [filter, setFilter] = useState('all')
  const [siteFilter, setSiteFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const knownIds = useRef<Set<string>>(new Set())
  const initialized = useRef(false)

  const loadFromDb = async () => {
    const local = await getBookings()
    setBookings(local)
    for (const b of local) knownIds.current.add(b.id)
  }

  const syncFromServer = async () => {
    if (sites.length === 0) return
    try {
      const { bookings: remote, errors } = await fetchAllBookings(sites)
      for (const b of remote) await upsertBooking(b)
      setBookings(await getBookings())

      if (errors.length > 0 && errors.length === sites.length) {
        setError('Нет связи ни с одним сервером · показан кэш')
      } else if (errors.length > 0) {
        setError(`Ошибка с ${errors.length} из ${sites.length} сайтов`)
      } else {
        setError('')
      }

      if (initialized.current) {
        const newOnes = remote.filter((b) => !knownIds.current.has(b.id) && b.status === 'new')
        if (newOnes.length > 0) {
          for (let i = 0; i < newOnes.length; i++) incrementNewBookings()
          if (notifyOn) await notifyNewBooking(newOnes.length)
        }
      }

      for (const b of remote) knownIds.current.add(b.id)
      initialized.current = true
    } catch {
      setError('Нет связи · показан кэш')
    }
  }

  useFocusEffect(
    useCallback(() => {
      clearNewBookings()
      loadFromDb().then(() => {
        initialized.current = true
        syncFromServer()
      })
      const interval = setInterval(syncFromServer, 8000)
      return () => clearInterval(interval)
    }, [sites.length, notifyOn])
  )

  const onRefresh = async () => {
    setRefreshing(true)
    await syncFromServer()
    setRefreshing(false)
  }

  const handleStatusChange = async (id: string, status: string) => {
    const b = bookings.find(x => x.id === id)
    if (!b) return
    const site = siteById(b.siteId)
    if (!site) return
    updateBooking(id, status)
    await updateBookingLocal(id, status)
    try { await patchBookingFor(site, id, status) } catch {}
  }

  const filtered = bookings
    .filter((b) => filter === 'all' || b.status === filter)
    .filter((b) => siteFilter === 'all' || b.siteId === siteFilter)
    .filter((b) => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        b.phone.includes(q) ||
        (b.name ?? '').toLowerCase().includes(q) ||
        (b.address ?? '').toLowerCase().includes(q) ||
        (b.siteName ?? '').toLowerCase().includes(q)
      )
    })

  const newCount = bookings.filter((b) => b.status === 'new').length

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.logoWrap}>
          <Text style={s.logoX}>X</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.appName}>Xenom Manager</Text>
          <Text style={s.title}>Заявки</Text>
          <View style={s.subRow}>
            <Text style={s.sub}>{bookings.length} всего</Text>
            <View style={s.dot} />
            <Text style={s.sub}>{newCount} новых</Text>
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

      {/* Поиск */}
      <View style={s.searchWrap}>
        <Feather name="search" size={15} color={C.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Телефон, имя, адрес, сайт…"
          placeholderTextColor={C.textMuted}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={10}>
            <Feather name="x" size={15} color={C.textMuted} />
          </TouchableOpacity>
        )}
      </View>

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
            const count = bookings.filter(b => b.siteId === site.id).length
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

      {/* Фильтры по статусу */}
      <View style={s.filters}>
        {FILTERS.map((f) => {
          const base = bookings.filter(b => siteFilter === 'all' || b.siteId === siteFilter)
          const count = f.key === 'all' ? base.length : base.filter((b) => b.status === f.key).length
          const active = filter === f.key
          return (
            <TouchableOpacity
              key={f.key}
              style={[s.filterBtn, active && s.filterActive]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.7}
            >
              <Text style={[s.filterText, active && s.filterTextActive]}>{f.label}</Text>
              {count > 0 && (
                <View style={[s.filterCount, active && s.filterCountActive]}>
                  <Text style={[s.filterCountText, active && s.filterCountTextActive]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          )
        })}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => `${item.siteId}:${item.id}`}
        renderItem={({ item }) => (
          <BookingCard booking={item} onStatusChange={handleStatusChange} />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <View style={s.emptyIconWrap}>
              <Feather name="inbox" size={28} color={C.textMuted} />
            </View>
            <Text style={s.emptyText}>
              {sites.length === 0 ? 'Не добавлен ни один сайт' : 'Заявок нет'}
            </Text>
            <Text style={s.emptySub}>
              {sites.length === 0
                ? 'Откройте «Настройки» и добавьте сайт'
                : 'Новые заявки появятся здесь автоматически'}
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
  logoWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center',
    elevation: 6,
    shadowColor: '#7C3AED', shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  logoX: { fontSize: 22, fontWeight: '900', color: '#fff' },
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

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, marginHorizontal: 16, borderRadius: 12,
    borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, marginBottom: 12,
  },
  searchInput: { flex: 1, height: 44, color: C.text, fontSize: 14 },

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

  filters: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 4, flexWrap: 'wrap' },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  filterActive: { backgroundColor: C.primaryDim, borderColor: `${C.primary}88` },
  filterText: { fontSize: 13, color: C.textSecondary, fontWeight: '500' },
  filterTextActive: { color: C.primary, fontWeight: '700' },
  filterCount: {
    backgroundColor: C.border, borderRadius: 10,
    paddingHorizontal: 6, minWidth: 18, alignItems: 'center',
  },
  filterCountActive: { backgroundColor: C.primary },
  filterCountText: { fontSize: 10, fontWeight: '700', color: C.textSecondary },
  filterCountTextActive: { color: '#fff' },

  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyText: { color: C.text, fontSize: 16, fontWeight: '600', marginBottom: 4 },
  emptySub: { color: C.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 32 },
})
