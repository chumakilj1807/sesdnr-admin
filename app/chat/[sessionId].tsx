import { useEffect, useRef, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { C } from '@/constants/Colors'
import { useStore } from '@/lib/store'
import { fetchMessages, sendMessage, sendTyping, closeChat } from '@/lib/api'
import { getMessages, upsertMessage, updateSessionStatus } from '@/lib/db'
import type { Message } from '@/lib/types'

export default function ChatScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const { settings, messages: storeMessages, setMessages, addMessage, replaceMessage, sessions } = useStore()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [lastId, setLastId] = useState<string | null>(null)
  const joinSent = useRef(false)
  const listRef = useRef<FlatList>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout>>()

  const msgs = storeMessages[sessionId] ?? []
  const session = sessions.find((s) => s.id === sessionId)

  const loadMessages = async () => {
    const local = await getMessages(sessionId)
    setMessages(sessionId, local)
    if (local.length > 0) setLastId(local[local.length - 1].id)
  }

  const sendJoinNotice = async () => {
    if (joinSent.current || session?.status === 'closed') return
    joinSent.current = true
    try {
      const name = settings.adminName || 'Оператор'
      await sendMessage(sessionId, `⚡ Оператор ${name} подключился к чату`, name)
    } catch {}
  }

  const pollMessages = async () => {
    try {
      const since = lastId
        ? msgs.find((m) => m.id === lastId)?.createdAt
        : undefined
      const remote = await fetchMessages(sessionId, since)
      for (const m of remote) {
        await upsertMessage(m)
        addMessage(m)
        setLastId(m.id)
      }
    } catch {}
  }

  useEffect(() => {
    loadMessages().then(() => sendJoinNotice())
  }, [sessionId])

  useEffect(() => {
    const t = setInterval(pollMessages, 2000)
    return () => clearInterval(t)
  }, [sessionId, lastId])

  useEffect(() => {
    if (msgs.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100)
    }
  }, [msgs.length])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending || session?.status === 'closed') return
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
      const saved = await sendMessage(sessionId, text, settings.adminName)
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
    if (text) typingTimer.current = setTimeout(() => sendTyping(sessionId).catch(() => {}), 500)
  }

  const handleClose = () => {
    Alert.alert('Закрыть чат', 'Диалог будет завершён и клиент увидит сообщение об окончании.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Закрыть',
        style: 'destructive',
        onPress: async () => {
          try {
            await closeChat(sessionId)
            await updateSessionStatus(sessionId, 'closed')
            router.back()
          } catch { Alert.alert('Ошибка', 'Не удалось закрыть чат') }
        },
      },
    ])
  }

  const formatTime = (iso: string) => {
    try { return new Date(iso).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }) }
    catch { return '' }
  }

  const adminInitials = (settings.adminName || 'ОП')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const isClosed = session?.status === 'closed'
  const shortId = sessionId.slice(-6).toUpperCase()

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.appLabel}>Xenom Manager</Text>
          <Text style={s.headerTitle}>Клиент #{shortId}</Text>
          <Text style={[s.headerSub, isClosed && { color: C.error }]}>
            {isClosed ? '🔴 Закрыт' : '🟢 Активен'}
          </Text>
        </View>
        {!isClosed && (
          <TouchableOpacity onPress={handleClose} style={s.closeBtn}>
            <Text style={s.closeBtnText}>Закрыть</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={msgs}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
        renderItem={({ item }) => {
          const isAdmin = item.sender === 'admin'
          const isSystem = isAdmin && item.text.startsWith('⚡ Оператор') && item.text.includes('подключился')

          if (isSystem) {
            return (
              <View style={s.systemRow}>
                <Text style={s.systemText}>{item.text}</Text>
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
              <View style={{ maxWidth: '72%' }}>
                {isAdmin && (
                  <Text style={s.adminName}>{settings.adminName || 'Оператор'}</Text>
                )}
                <View style={[s.bubble, isAdmin ? s.bubbleAdmin : s.bubbleUser]}>
                  <Text style={[s.msgText, isAdmin && s.msgTextAdmin]}>{item.text}</Text>
                  <Text style={[s.msgTime, isAdmin && s.msgTimeAdmin]}>{formatTime(item.createdAt)}</Text>
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
            placeholder="Написать сообщение..."
            placeholderTextColor={C.textMuted}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || sending) && s.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || sending}
          >
            <Text style={s.sendIcon}>➤</Text>
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
  backBtn: { padding: 8, marginRight: 8 },
  backArrow: { fontSize: 22, color: C.primary, fontWeight: '600' },
  appLabel: { fontSize: 10, fontWeight: '700', color: '#7C3AED', letterSpacing: 1, textTransform: 'uppercase' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.text },
  headerSub: { fontSize: 12, color: C.success, marginTop: 1 },
  closeBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: C.errorDim, borderRadius: 10, borderWidth: 1, borderColor: C.error,
  },
  closeBtnText: { color: C.error, fontSize: 13, fontWeight: '600' },

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
  msgTimeAdmin: { color: 'rgba(255,255,255,0.6)' },

  systemRow: { alignItems: 'center', marginVertical: 8 },
  systemText: {
    fontSize: 12, color: C.textMuted, backgroundColor: C.card,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: C.border,
  },

  emptyChat: { alignItems: 'center', paddingTop: 40 },
  emptyChatText: { color: C.textMuted, fontSize: 14 },
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
  sendIcon: { color: '#fff', fontSize: 18 },
  closedBanner: {
    padding: 16, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border,
    alignItems: 'center',
  },
  closedText: { color: C.textMuted, fontSize: 14 },
})
