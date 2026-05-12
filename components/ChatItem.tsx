import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
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
    <TouchableOpacity style={[s.card, isClosed && s.cardClosed]} onPress={onPress} activeOpacity={0.85}>
      {/* Avatar */}
      <View style={[s.avatar, isClosed && s.avatarClosed]}>
        <Text style={s.avatarText}>👤</Text>
      </View>

      <View style={{ flex: 1 }}>
        <View style={s.topRow}>
          <Text style={s.name}>Клиент #{shortId}</Text>
          <Text style={s.time}>{formatTime(s.lastMessageAt)}</Text>
        </View>
        <View style={s.bottomRow}>
          <Text style={[s.preview, isUserLast && !isClosed && s.previewUnread]} numberOfLines={1}>
            {isUserLast ? '' : ''}
            {s.lastMessage ?? 'Новый диалог'}
          </Text>
          {isUserLast && !isClosed && (
            <View style={s.unreadDot} />
          )}
        </View>
        <View style={s.statusRow}>
          <View style={[s.statusDot, { backgroundColor: isClosed ? C.textMuted : C.success }]} />
          <Text style={[s.statusText, { color: isClosed ? C.textMuted : C.success }]}>
            {isClosed ? 'Закрыт' : 'Активен'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.border, marginBottom: 10,
  },
  cardClosed: { opacity: 0.6 },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: C.primaryDim, alignItems: 'center', justifyContent: 'center',
  },
  avatarClosed: { backgroundColor: C.border },
  avatarText: { fontSize: 22 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  name: { fontSize: 15, fontWeight: '700', color: C.text },
  time: { fontSize: 12, color: C.textMuted },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  preview: { fontSize: 13, color: C.textSecondary, flex: 1 },
  previewUnread: { color: C.text, fontWeight: '500' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11 },
})
