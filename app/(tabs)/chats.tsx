import { useCallback, useRef, useState } from 'react'
import { View, Text, FlatList, StyleSheet, RefreshControl, AppState } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { C } from '@/constants/Colors'
import { useStore } from '@/lib/store'
import { fetchChats } from '@/lib/api'
import { getSessions, upsertSession } from '@/lib/db'
import ChatItem from '@/components/ChatItem'
import { notifyNewMessage } from '@/lib/notifications'

export default function ChatsScreen() {
  const { sessions, setSessions, clearNewMessages } = useStore()
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const knownIds = useRef<Set<string>>(new Set())
  const appState = useRef(AppState.currentState)

  const sync = async () => {
    try {
      const remote = await fetchChats()
      for (const s of remote) await upsertSession(s)
      const local = await getSessions()
      setSessions(local)
      setError('')

      // Notify about truly new sessions (new user messages)
      const isBackground = appState.current !== 'active'
      for (const s of remote) {
        if (!knownIds.current.has(s.id) && s.lastSender === 'user') {
          if (isBackground) {
            await notifyNewMessage(s.id, s.lastMessage ?? undefined)
          }
          knownIds.current.add(s.id)
        } else if (knownIds.current.has(s.id) && s.lastSender === 'user') {
          // Existing session got a new user message - check via lastMessageAt
          const existing = sessions.find((x) => x.id === s.id)
          if (existing && existing.lastMessageAt !== s.lastMessageAt && isBackground) {
            await notifyNewMessage(s.id, s.lastMessage ?? undefined)
          }
        } else {
          knownIds.current.add(s.id)
        }
      }
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

      const sub = AppState.addEventListener('change', (next) => {
        appState.current = next
      })

      return () => {
        clearInterval(t)
        sub.remove()
      }
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
    shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 6,
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
