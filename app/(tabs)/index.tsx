import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TouchableOpacity, TextInput,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import { C, STATUS_COLOR, STATUS_LABEL } from '@/constants/Colors'
import { useStore } from '@/lib/store'
import { fetchBookings, patchBooking } from '@/lib/api'
import { getBookings, upsertBooking, updateBookingLocal } from '@/lib/db'
import BookingCard from '@/components/BookingCard'
import type { Booking } from '@/lib/types'

const FILTERS = [
  { key: 'all', label: 'Все' },
  { key: 'new', label: 'Новые' },
  { key: 'processing', label: 'В работе' },
  { key: 'done', label: 'Готово' },
]

export default function BookingsScreen() {
  const { bookings, setBookings, updateBooking, clearNewBookings, settings } = useStore()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const loadFromDb = async () => {
    const local = await getBookings()
    setBookings(local)
  }

  const syncFromServer = async () => {
    try {
      const remote = await fetchBookings()
      for (const b of remote) await upsertBooking(b)
      setBookings(await getBookings())
      setError('')
    } catch (e) {
      setError('Нет связи с сервером. Данные из кэша.')
    }
  }

  useFocusEffect(
    useCallback(() => {
      clearNewBookings()
      loadFromDb().then(() => syncFromServer())
      const interval = setInterval(syncFromServer, 8000)
      return () => clearInterval(interval)
    }, [])
  )

  const onRefresh = async () => {
    setRefreshing(true)
    await syncFromServer()
    setRefreshing(false)
  }

  const handleStatusChange = async (id: string, status: string) => {
    updateBooking(id, status)
    await updateBookingLocal(id, status)
    try { await patchBooking(id, status) } catch {}
  }

  const filtered = bookings
    .filter((b) => filter === 'all' || b.status === filter)
    .filter((b) => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        b.phone.includes(q) ||
        (b.name ?? '').toLowerCase().includes(q) ||
        (b.address ?? '').toLowerCase().includes(q)
      )
    })

  const newCount = bookings.filter((b) => b.status === 'new').length

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.logoX}>X</Text>
        <View>
          <Text style={s.title}>Заявки</Text>
          <Text style={s.sub}>{bookings.length} всего · {newCount} новых</Text>
        </View>
      </View>

      {error ? (
        <View style={s.errorBanner}>
          <Text style={s.errorText}>⚠️ {error}</Text>
        </View>
      ) : null}

      {/* Search */}
      <View style={s.searchWrap}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Телефон, имя, адрес..."
          placeholderTextColor={C.textMuted}
        />
      </View>

      {/* Filter tabs */}
      <View style={s.filters}>
        {FILTERS.map((f) => {
          const count = f.key === 'all' ? bookings.length : bookings.filter((b) => b.status === f.key).length
          const active = filter === f.key
          return (
            <TouchableOpacity
              key={f.key}
              style={[s.filterBtn, active && s.filterActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[s.filterText, active && s.filterTextActive]}>
                {f.label}
                {count > 0 ? ` ${count}` : ''}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <BookingCard booking={item} onStatusChange={handleStatusChange} />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyIcon}>📋</Text>
            <Text style={s.emptyText}>Заявок нет</Text>
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
  logoX: { width: 40, height: 40, lineHeight: 40, textAlign: 'center', fontSize: 22, fontWeight: '900', color: '#fff', backgroundColor: '#7C3AED', borderRadius: 10, overflow: 'hidden' },
  title: { fontSize: 24, fontWeight: '800', color: C.text },
  sub: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  errorBanner: { backgroundColor: C.errorDim, marginHorizontal: 16, borderRadius: 10, padding: 10, marginBottom: 4 },
  errorText: { color: C.error, fontSize: 13 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, marginHorizontal: 16, borderRadius: 12,
    borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, marginBottom: 12,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, height: 44, color: C.text, fontSize: 14 },
  filters: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 4 },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  filterActive: { backgroundColor: C.primaryDim, borderColor: C.primary },
  filterText: { fontSize: 13, color: C.textSecondary, fontWeight: '500' },
  filterTextActive: { color: C.primary, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: C.textMuted, fontSize: 16 },
})
