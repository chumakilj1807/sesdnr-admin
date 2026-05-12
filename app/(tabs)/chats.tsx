import { useCallback, useState } from 'react'
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { C } from '@/constants/Colors'
import { useStore } from '@/lib/store'
import { fetchChats } from '@/lib/api'
import { getSessions, upsertSession } from '@/lib/db'
import ChatItem from '@/components/ChatItem'

export default function ChatsScreen() {
  const { sessions, setSessions, clearNewMessages } = useStore()
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const sync = async () => {
    try {
      const remote = await fetchChats()
      for (const s of remote) await upsertSession(s)
      setSessions(await getSessions())
      setError('')
    } catch {
      setError('Нет связи · данные из кэша')
      setSessions(await getSessions())
    }
  }

  useFocusEffect(
    useCallback(() => {
      clearNewMessages()
      sync()
      const t = setInterval(sync, 6000)
      return () => clearInterval(t)
    }, [])
  )

  const onRefresh = async () => {
    setRefreshing(true)
    await sync()
    setRefreshing(false)
  }

  const active = sessions.filter((s) => s.status !== 'closed')
  const closed = sessions.filter((s) => s.status === 'closed')

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Чаты</Text>
        <Text style={s.sub}>
          {active.length} активных · {closed.length} закрытых
        </Text>
      </View>

      {error ? (
        <View style={s.errorBanner}>
          <Text style={s.errorText}>⚠️ {error}</Text>
        </View>
      ) : null}

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChatItem
            session={item}
            onPress={() => router.push(`/chat/${item.id}`)}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyIcon}>💬</Text>
            <Text style={s.emptyText}>Чатов пока нет</Text>
          </View>
        }
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', color: C.text },
  sub: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  errorBanner: { backgroundColor: C.errorDim, marginHorizontal: 16, borderRadius: 10, padding: 10, marginBottom: 4 },
  errorText: { color: C.error, fontSize: 13 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: C.textMuted, fontSize: 16 },
})
