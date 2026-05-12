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
  const { settings, messages: storeMessages, setMessages, addMessage, sessions } = useStore()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [lastId, setLastId] = useState<string | null>(null)
  const listRef = useRef<FlatList>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout>>()

  const msgs = storeMessages[sessionId] ?? []
  const session = sessions.find((s) => s.id === sessionId)

  const loadMessages = async () => {
    const local = await getMessages(sessionId)
    setMessages(sessionId, local)
    if (local.length > 0) setLastId(local[local.length - 1].id)
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
    loadMessages()
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
      addMessage(saved)
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
        renderItem={({ item }) => (
          <View style={[s.msgRow, item.sender === 'admin' ? s.msgRowAdmin : s.msgRowUser]}>
            <View style={[s.bubble, item.sender === 'admin' ? s.bubbleAdmin : s.bubbleUser]}>
              {item.sender === 'admin' && (
                <Text style={s.adminLabel}>{settings.adminName || 'Вы'}</Text>
              )}
              <Text style={s.msgText}>{item.text}</Text>
              <Text style={s.msgTime}>{formatTime(item.createdAt)}</Text>
            </View>
          </View>
        )}
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
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.text },
  headerSub: { fontSize: 12, color: C.success, marginTop: 1 },
  closeBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: C.errorDim, borderRadius: 10, borderWidth: 1, borderColor: C.error,
  },
  closeBtnText: { color: C.error, fontSize: 13, fontWeight: '600' },
  msgRow: { marginBottom: 10, flexDirection: 'row' },
  msgRowUser: { justifyContent: 'flex-start' },
  msgRowAdmin: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: C.card, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: C.border },
  bubbleAdmin: { backgroundColor: C.primary, borderBottomRightRadius: 4 },
  adminLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 2 },
  msgText: { color: C.text, fontSize: 15, lineHeight: 20 },
  msgTime: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 4, alignSelf: 'flex-end' },
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
