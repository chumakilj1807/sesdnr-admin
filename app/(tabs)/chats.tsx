import { useCallback, useRef, useState } from 'react'
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import { C } from '@/constants/Colors'
import { useStore } from '@/lib/store'
import { fetchAllChats } from '@/lib/api'
import { getSessions, upsertSession } from '@/lib/db'
import ChatItem from '@/components/ChatItem'
import AppLogo from '@/components/AppLogo'
import { notifyNewMessage } from '@/lib/notifications'
import { stopChatRing } from '@/lib/chatRing'

export default function ChatsScreen() {
  const { sessions, setSessions, clearNewMessages, incrementNewMessages } = useStore()
  const sites = useStore(s => s.settings.sites)
  const notifyOn = useStore(s => s.settings.notify?.chats ?? true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const lastSeenAt = useRef<Map<string, string | null>>(new Map())
  const initialized = useRef(false)

  const sync = async () => {
    if (sites.length === 0) return
    try {
      const { sessions: remote, errors } = await fetchAllChats(sites)
      for (const s of remote) await upsertSession(s)
      const local = await getSessions()
      setSessions(local)

      if (errors.length > 0 && errors.length === sites.length) {
        setError('Нет связи ни с одним сервером · кэш')
      } else if (errors.length > 0) {
        setError(`Ошибка с ${errors.length} из ${sites.length} сайтов`)
      } else {
        setError('')
      }

      for (const s of remote) {
        const prev = lastSeenAt.current.get(s.id)
        const isFirstSeen = !lastSeenAt.current.has(s.id)

        if (initialized.current) {
          const hasNewMsg =
            (isFirstSeen && s.lastSender === 'user') ||
            (!isFirstSeen && s.lastSender === 'user' && s.lastMessageAt !== prev)

          if (hasNewMsg) {
            incrementNewMessages()
            if (notifyOn) await notifyNewMessage(s.id, s.lastMessage ?? undefined)
          }
        }

        lastSeenAt.current.set(s.id, s.lastMessageAt)
      }

      initialized.current = true
    } catch {
      setError('Нет связи · кэш')
      setSessions(await getSessions())
    }
  }

  useFocusEffect(
    useCallback(() => {
      // Открыли список чатов — глушим «входящий звонок»
      stopChatRing()
      clearNewMessages()
      sync()
      const t = setInterval(sync, 6000)
      return () => clearInterval(t)
    }, [sites.length, notifyOn])
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
        <AppLogo />
        <View style={{ flex: 1 }}>
          <Text style={s.appName}>Xenom Manager</Text>
          <Text style={s.title}>Чаты</Text>
          <View style={s.subRow}>
            <Text style={s.sub}>{active.length} активных</Text>
            <View style={s.dot} />
            <Text style={s.sub}>{closed.length} закрытых</Text>
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

      <FlatList
        data={sessions}
        keyExtractor={(item) => `${item.siteId}:${item.id}`}
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
            <View style={s.emptyIconWrap}>
              <Feather name="message-circle" size={28} color={C.textMuted} />
            </View>
            <Text style={s.emptyText}>
              {sites.length === 0 ? 'Не добавлен ни один сайт' : 'Чатов пока нет'}
            </Text>
            <Text style={s.emptySub}>
              {sites.length === 0
                ? 'Откройте «Настройки» и добавьте сайт'
                : 'Когда клиент откроет чат на сайте, он появится здесь'}
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

  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyText: { color: C.text, fontSize: 16, fontWeight: '600', marginBottom: 4 },
  emptySub: { color: C.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 32 },
})
