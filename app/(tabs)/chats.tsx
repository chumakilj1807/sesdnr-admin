import { useCallback, useRef, useState } from 'react'
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { C } from '@/constants/Colors'
import { useStore } from '@/lib/store'
import { fetchChats } from '@/lib/api'
import { getSessions, upsertSession } from '@/lib/db'
import ChatItem from '@/components/ChatItem'
import { notifyNewMessage } from '@/lib/notifications'

export default function ChatsScreen() {
  const { sessions, setSessions, clearNewMessages, incrementNewMessages } = useStore()
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  // tracks lastMessageAt per sessionId so we detect new messages reliably
  const lastSeenAt = useRef<Map<string, string | null>>(new Map())
  const initialized = useRef(false)

  const sync = async () => {
    try {
      const remote = await fetchChats()
      for (const s of remote) await upsertSession(s)
      const local = await getSessions()
      setSessions(local)
      setError('')

      for (const s of remote) {
        const prev = lastSeenAt.current.get(s.id)
        const isNew = !lastSeenAt.current.has(s.id)

        if (initialized.current) {
          const hasNewMsg =
            (isNew && s.lastSender === 'user') ||
            (!isNew && s.lastSender === 'user' && s.lastMessageAt !== prev)

          if (hasNewMsg) {
            incrementNewMessages()
            await notifyNewMessage(s.id, s.lastMessage ?? undefined)
          }
        }

        lastSeenAt.current.set(s.id, s.lastMessageAt)
      }

      initialized.current = true
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
        <View style={s.logoWrap}>
          <Text style={s.logoX}>X</Text>
        </View>
        <View>
          <Text style={s.appName}>Xenom Manager</Text>
          <Text style={s.title}>Чаты</Text>
          <Text style={s.sub}>{active.length} активных · {closed.length} закрытых</Text>
        </View>
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
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16,
  },
  logoWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center',
    elevation: 6,
  },
  logoX: { fontSize: 22, fontWeight: '900', color: '#fff' },
  appName: { fontSize: 11, fontWeight: '700', color: '#7C3AED', letterSpacing: 1, textTransform: 'uppercase' },
  title: { fontSize: 22, fontWeight: '800', color: C.text },
  sub: { fontSize: 13, color: C.textMuted, marginTop: 1 },
  errorBanner: { backgroundColor: C.errorDim, marginHorizontal: 16, borderRadius: 10, padding: 10, marginBottom: 4 },
  errorText: { color: C.error, fontSize: 13 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: C.textMuted, fontSize: 16 },
})
