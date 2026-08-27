import { useEffect, useRef, useState } from 'react'
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { C } from '@/constants/Colors'
import { useStore } from '@/lib/store'
import { fetchMessages, sendMessage, sendTyping, closeChat } from '@/lib/api'
import { getMessages, upsertMessage, updateSessionStatus } from '@/lib/db'
import { stopChatRing } from '@/lib/chatRing'
import type { Message } from '@/lib/types'

export default function ChatScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const { settings, messages: storeMessages, setMessages, addMessage, replaceMessage, sessions } = useStore()
  const siteById = useStore(s => s.siteById)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connected, setConnected] = useState(false)
  const [lastId, setLastId] = useState<string | null>(null)
  const listRef = useRef<FlatList>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout>>()

  const msgs = storeMessages[sessionId] ?? []
  const session = sessions.find((s) => s.id === sessionId)
  const site = session ? siteById(session.siteId) : null

  // Открыли конкретный чат — глушим «входящий звонок»
  useEffect(() => {
    stopChatRing()
  }, [sessionId])

  // Если оператор уже отправлял join-сообщение в этой сессии — считаем подключённым
  useEffect(() => {
    const wasJoined = msgs.some(
      (m) => m.sender === 'admin' && m.text.startsWith('⚡ Оператор') && m.text.includes('подключился')
    )
    if (wasJoined) setConnected(true)
  }, [msgs.length])

  const loadMessages = async () => {
    const local = await getMessages(sessionId)
    setMessages(sessionId, local)
    if (local.length > 0) setLastId(local[local.length - 1].id)
  }

  const handleConnect = async () => {
    if (!site || connecting || connected) return
    setConnecting(true)
    try {
      const name = settings.adminName || 'Оператор'
      const saved = await sendMessage(site, sessionId, `⚡ Оператор ${name} подключился к чату`, name)
      await upsertMessage(saved)
      addMessage(saved)
      setLastId(saved.id)
      setConnected(true)
    } catch {
      Alert.alert('Ошибка', 'Не удалось подключиться к чату. Проверьте связь.')
    } finally {
      setConnecting(false)
    }
  }

  const pollMessages = async () => {
    if (!site) return
    try {
      const since = lastId
        ? msgs.find((m) => m.id === lastId)?.createdAt
        : undefined
      const remote = await fetchMessages(site, sessionId, since)
      for (const m of remote) {
        await upsertMessage(m)
        addMessage(m)
        setLastId(m.id)
      }
    } catch {}
  }

  useEffect(() => {
    loadMessages()
  }, [sessionId])

  useEffect(() => {
    if (!site) return
    const t = setInterval(pollMessages, 2000)
    return () => clearInterval(t)
  }, [sessionId, lastId, site?.id])

  useEffect(() => {
    if (msgs.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100)
    }
  }, [msgs.length])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending || session?.status === 'closed' || !site) return
    if (!connected) {
      Alert.alert('Сначала подключитесь', 'Нажмите «Подключиться к чату», чтобы клиент увидел, что вы на связи.')
      return
    }
    setInput('')
    setSending(true)

    const tempMsg: Message = {
      id: `temp_${Date.now()}`,
      sessionId,
      text,
      sender: 'admin',
      createdAt: new Date().toISOString(),
    }
    addMessage(tempMsg)

    try {
      const saved = await sendMessage(site, sessionId, text, settings.adminName)
      await upsertMessage(saved)
      replaceMessage(tempMsg.id, saved)
      setLastId(saved.id)
    } catch {
      Alert.alert('Ошибка', 'Не удалось отправить сообщение')
    }
    setSending(false)
  }

  const handleTyping = (text: string) => {
    setInput(text)
    clearTimeout(typingTimer.current)
    if (text && site && connected) {
      typingTimer.current = setTimeout(() => sendTyping(site, sessionId).catch(() => {}), 500)
    }
  }

  const handleClose = () => {
    if (!site) return
    Alert.alert('Закрыть чат', 'Диалог будет завершён и клиент увидит сообщение об окончании.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Закрыть',
        style: 'destructive',
        onPress: async () => {
          try {
            await closeChat(site, sessionId)
            await updateSessionStatus(sessionId, 'closed')
            router.back()
          } catch { Alert.alert('Ошибка', 'Не удалось закрыть чат') }
        },
      },
    ])
  }

  // Дата + время: «09.06 15:30» для прошлых дней, «15:30» для сегодняшних
  const formatStamp = (iso: string) => {
    try {
      const d = new Date(iso)
      const now = new Date()
      const sameDay = d.toDateString() === now.toDateString()
      const time = d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
      if (sameDay) return time
      const date = d.toLocaleDateString('ru', { day: '2-digit', month: '2-digit' })
      return `${date} · ${time}`
    } catch { return '' }
  }

  // Разделитель дат («Сегодня», «09.06», «Вчера»)
  const dateLabel = (iso: string) => {
    try {
      const d = new Date(iso)
      const now = new Date()
      const sameDay = d.toDateString() === now.toDateString()
      if (sameDay) return 'Сегодня'
      const yest = new Date(now); yest.setDate(now.getDate() - 1)
      if (d.toDateString() === yest.toDateString()) return 'Вчера'
      return d.toLocaleDateString('ru', { day: '2-digit', month: 'long', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' })
    } catch { return '' }
  }

  const adminInitials = (settings.adminName || 'ОП')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const isClosed = session?.status === 'closed'
  const shortId = sessionId.slice(-6).toUpperCase()

  // подставляем разделители дат между сообщениями
  const items: ({ type: 'sep'; label: string } | { type: 'msg'; msg: Message })[] = []
  let prevDay = ''
  for (const m of msgs) {
    const day = new Date(m.createdAt).toDateString()
    if (day !== prevDay) {
      items.push({ type: 'sep', label: dateLabel(m.createdAt) })
      prevDay = day
    }
    items.push({ type: 'msg', msg: m })
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <Feather name="arrow-left" size={22} color={C.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={s.headerTopRow}>
            <Text style={s.appLabel}>Xenom Manager</Text>
            {session?.siteName ? (
              <View style={s.siteBadge}>
                <Feather name="globe" size={10} color={C.textSecondary} />
                <Text style={s.siteBadgeText} numberOfLines={1}>{session.siteName}</Text>
              </View>
            ) : null}
          </View>
          <Text style={s.headerTitle}>Клиент #{shortId}</Text>
          <View style={s.headerSubRow}>
            <View style={[s.headerStatusDot, { backgroundColor: isClosed ? C.error : C.success }]} />
            <Text style={[s.headerSub, isClosed && { color: C.error }]}>
              {isClosed ? 'Закрыт' : 'Активен'}
            </Text>
            {connected && !isClosed && (
              <>
                <View style={s.headerSep} />
                <Feather name="wifi" size={11} color="#7C3AED" />
                <Text style={s.headerConnected}>вы подключены</Text>
              </>
            )}
          </View>
        </View>
        {!isClosed && (
          <TouchableOpacity onPress={handleClose} style={s.closeBtn}>
            <Feather name="x" size={14} color={C.error} />
            <Text style={s.closeBtnText}>Закрыть</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item, idx) => (item.type === 'msg' ? item.msg.id : `sep-${idx}`)}
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
        renderItem={({ item }) => {
          if (item.type === 'sep') {
            return (
              <View style={s.dateSepRow}>
                <View style={s.dateSepLine} />
                <Text style={s.dateSepText}>{item.label}</Text>
                <View style={s.dateSepLine} />
              </View>
            )
          }
          const m = item.msg
          const isAdmin = m.sender === 'admin'
          const isSystem = isAdmin && m.text.startsWith('⚡ Оператор') && m.text.includes('подключился')

          if (isSystem) {
            return (
              <View style={s.systemRow}>
                <View style={s.systemBubble}>
                  <Feather name="zap" size={12} color="#7C3AED" />
                  <Text style={s.systemText}>{m.text.replace(/^⚡\s*/, '')}</Text>
                  <Text style={s.systemTime}>{formatStamp(m.createdAt)}</Text>
                </View>
              </View>
            )
          }

          return (
            <View style={[s.msgRow, isAdmin ? s.msgRowAdmin : s.msgRowUser]}>
              {isAdmin && (
                <View style={s.adminAvatar}>
                  <Text style={s.adminAvatarText}>{adminInitials}</Text>
                </View>
              )}
              <View style={{ maxWidth: '74%' }}>
                {isAdmin && (
                  <Text style={s.adminName}>{settings.adminName || 'Оператор'}</Text>
                )}
                <View style={[s.bubble, isAdmin ? s.bubbleAdmin : s.bubbleUser]}>
                  <Text style={[s.msgText, isAdmin && s.msgTextAdmin]}>{m.text}</Text>
                  <Text style={[s.msgTime, isAdmin && s.msgTimeAdmin]}>{formatStamp(m.createdAt)}</Text>
                </View>
              </View>
            </View>
          )
        }}
        ListEmptyComponent={
          <View style={s.emptyChat}>
            <Text style={s.emptyChatText}>Сообщений пока нет</Text>
          </View>
        }
      />

      {/* Connect banner — пока не подключились */}
      {!connected && !isClosed && (
        <View style={s.connectBanner}>
          <View style={s.connectInfo}>
            <Feather name="eye-off" size={14} color={C.textSecondary} />
            <Text style={s.connectInfoText}>
              Клиент пока не знает, что вы открыли чат
            </Text>
          </View>
          <TouchableOpacity
            style={[s.connectBtn, connecting && s.connectBtnDisabled]}
            onPress={handleConnect}
            disabled={connecting}
            activeOpacity={0.85}
          >
            <Feather name={connecting ? 'loader' : 'zap'} size={15} color="#fff" />
            <Text style={s.connectBtnText}>
              {connecting ? 'Подключаюсь…' : 'Подключиться к чату'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input */}
      {isClosed ? (
        <View style={s.closedBanner}>
          <Text style={s.closedText}>Диалог завершён</Text>
        </View>
      ) : (
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={handleTyping}
            placeholder={connected ? 'Написать сообщение…' : 'Подключитесь, чтобы писать'}
            placeholderTextColor={C.textMuted}
            multiline
            maxLength={2000}
            editable={connected}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || sending || !connected) && s.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || sending || !connected}
          >
            <Feather name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 52, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { padding: 8, marginRight: 4 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  appLabel: { fontSize: 10, fontWeight: '700', color: '#7C3AED', letterSpacing: 1.2, textTransform: 'uppercase' },
  siteBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#0d1420', borderRadius: 5,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: C.border, maxWidth: 140,
  },
  siteBadgeText: { color: C.textSecondary, fontSize: 10, fontWeight: '600' },

  headerTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginTop: 1 },
  headerSubRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'wrap' },
  headerStatusDot: { width: 6, height: 6, borderRadius: 3 },
  headerSub: { fontSize: 12, color: C.success },
  headerSep: { width: 2, height: 2, borderRadius: 1, backgroundColor: C.textMuted, marginHorizontal: 3 },
  headerConnected: { fontSize: 11, color: '#7C3AED', fontWeight: '600' },

  closeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: C.errorDim, borderRadius: 10, borderWidth: 1, borderColor: `${C.error}66`,
  },
  closeBtnText: { color: C.error, fontSize: 12, fontWeight: '700' },

  msgRow: { marginBottom: 12, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowUser: { justifyContent: 'flex-start' },
  msgRowAdmin: { justifyContent: 'flex-end', flexDirection: 'row-reverse' },

  adminAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center',
    marginBottom: 18,
  },
  adminAvatarText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  adminName: { fontSize: 11, color: '#7C3AED', fontWeight: '600', marginBottom: 3, textAlign: 'right' },

  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: {
    backgroundColor: C.card, borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: C.border,
  },
  bubbleAdmin: { backgroundColor: '#7C3AED', borderBottomRightRadius: 4 },
  msgText: { color: C.text, fontSize: 15, lineHeight: 20 },
  msgTextAdmin: { color: '#fff' },
  msgTime: { fontSize: 10, color: C.textMuted, marginTop: 4, alignSelf: 'flex-end' },
  msgTimeAdmin: { color: 'rgba(255,255,255,0.7)' },

  // системное сообщение «оператор подключился»
  systemRow: { alignItems: 'center', marginVertical: 10 },
  systemBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#7C3AED15', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: '#7C3AED55',
  },
  systemText: { fontSize: 12, color: '#A78BFA', fontWeight: '500' },
  systemTime: { fontSize: 10, color: '#A78BFA88', marginLeft: 4 },

  // разделитель дат
  dateSepRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 14, paddingHorizontal: 4,
  },
  dateSepLine: { flex: 1, height: 1, backgroundColor: C.border },
  dateSepText: { fontSize: 11, color: C.textMuted, fontWeight: '600', letterSpacing: 0.3 },

  emptyChat: { alignItems: 'center', paddingTop: 40 },
  emptyChatText: { color: C.textMuted, fontSize: 14 },

  // connect banner
  connectBanner: {
    paddingHorizontal: 16, paddingVertical: 12, gap: 10,
    backgroundColor: '#16101f', borderTopWidth: 1, borderTopColor: '#7C3AED44',
  },
  connectInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  connectInfoText: { fontSize: 12, color: C.textSecondary, flex: 1 },
  connectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#7C3AED', borderRadius: 12, paddingVertical: 12,
    shadowColor: '#7C3AED', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  connectBtnDisabled: { backgroundColor: '#7C3AED66' },
  connectBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', padding: 12,
    backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border, gap: 10,
  },
  input: {
    flex: 1, backgroundColor: '#0d1420', borderWidth: 1, borderColor: C.border,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 15, color: C.text, maxHeight: 120,
  },
  sendBtn: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: C.border },
  closedBanner: {
    padding: 16, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border,
    alignItems: 'center',
  },
  closedText: { color: C.textMuted, fontSize: 14 },
})
