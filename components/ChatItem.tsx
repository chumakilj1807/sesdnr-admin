import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { C } from '@/constants/Colors'
import type { ChatSession } from '@/lib/types'

interface Props {
  session: ChatSession
  onPress: () => void
}

export default function ChatItem({ session: s, onPress }: Props) {
  const isClosed = s.status === 'closed'
  const isUserLast = s.lastSender === 'user'

  const formatTime = (iso: string | null) => {
    if (!iso) return ''
    try {
      const d = new Date(iso)
      const now = new Date()
      const sameDay = d.toDateString() === now.toDateString()
      if (sameDay) return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
      return d.toLocaleDateString('ru', { day: '2-digit', month: '2-digit' })
    } catch { return '' }
  }

  const shortId = s.id.slice(-6).toUpperCase()

  return (
    <TouchableOpacity
      style={[st.card, isClosed ? st.cardClosed : st.cardActive]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Avatar */}
      <View style={[st.avatar, isClosed ? st.avatarClosed : st.avatarActive]}>
        <Feather name="user" size={22} color={isClosed ? '#FCA5A5' : '#86EFAC'} />
      </View>

      <View style={{ flex: 1 }}>
        <View style={st.topRow}>
          <Text style={[st.name, isClosed ? st.nameClosed : st.nameActive]}>
            Клиент #{shortId}
          </Text>
          <Text style={st.time}>{formatTime(s.lastMessageAt)}</Text>
        </View>
        <View style={st.bottomRow}>
          <Text
            style={[st.preview, isUserLast && !isClosed && st.previewUnread]}
            numberOfLines={1}
          >
            {s.lastMessage ?? 'Новый диалог'}
          </Text>
          {isUserLast && !isClosed && <View style={st.unreadDot} />}
        </View>
        <View style={st.statusRow}>
          <View style={[st.statusDot, { backgroundColor: isClosed ? '#EF4444' : '#22C55E' }]} />
          <Text style={[st.statusText, { color: isClosed ? '#EF4444' : '#22C55E' }]}>
            {isClosed ? 'Закрыт' : 'Активен'}
          </Text>
          {s.siteName ? (
            <>
              <View style={st.sep} />
              <Feather name="globe" size={10} color={C.textMuted} />
              <Text style={st.siteText} numberOfLines={1}>{s.siteName}</Text>
            </>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  )
}

const st = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.card, borderRadius: 14, padding: 14,
    borderWidth: 1, marginBottom: 10,
  },
  cardActive: { borderColor: '#166534', borderLeftWidth: 3, borderLeftColor: '#22C55E' },
  cardClosed: { borderColor: '#7F1D1D', borderLeftWidth: 3, borderLeftColor: '#EF4444', opacity: 0.75 },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarActive: { backgroundColor: '#14532D' },
  avatarClosed: { backgroundColor: '#3B0A0A' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  name: { fontSize: 15, fontWeight: '700' },
  nameActive: { color: '#86EFAC' },
  nameClosed: { color: '#FCA5A5' },
  time: { fontSize: 12, color: C.textMuted },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  preview: { fontSize: 13, color: C.textSecondary, flex: 1 },
  previewUnread: { color: C.text, fontWeight: '500' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, flexWrap: 'wrap' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11 },
  sep: { width: 2, height: 2, borderRadius: 1, backgroundColor: C.textMuted, marginHorizontal: 3 },
  siteText: { fontSize: 11, color: C.textMuted, fontWeight: '500', maxWidth: 140 },
})
