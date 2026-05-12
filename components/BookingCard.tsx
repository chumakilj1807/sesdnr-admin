import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { C, STATUS_COLOR, STATUS_LABEL } from '@/constants/Colors'
import type { Booking } from '@/lib/types'

const OBJ_LABEL: Record<string, string> = {
  apartment: 'Квартира', house: 'Дом', commercial: 'Коммерческое', land: 'Участок',
}

interface Props {
  booking: Booking
  onStatusChange: (id: string, status: string) => void
}

export default function BookingCard({ booking: b, onStatusChange }: Props) {
  const [expanded, setExpanded] = useState(false)

  const statusColor = STATUS_COLOR[b.status] ?? C.textMuted
  const isNew = b.status === 'new'
  const isDone = b.status === 'done' || b.status === 'cancelled'

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('ru', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      })
    } catch { return iso }
  }

  const changeStatus = (status: string, label: string) => {
    Alert.alert(`Статус: ${label}`, `Установить статус "${label}" для заявки?`, [
      { text: 'Отмена', style: 'cancel' },
      { text: label, onPress: () => onStatusChange(b.id, status) },
    ])
  }

  return (
    <TouchableOpacity
      style={[s.card, isNew && s.cardNew]}
      onPress={() => setExpanded((v) => !v)}
      activeOpacity={0.85}
    >
      {/* Status bar */}
      <View style={[s.statusBar, { backgroundColor: statusColor }]} />

      <View style={s.body}>
        {/* Top row */}
        <View style={s.topRow}>
          <View style={s.typeTag}>
            <Text style={s.typeText}>{b.type === 'callback' ? '📞 Звонок' : '📋 Заявка'}</Text>
          </View>
          <View style={[s.statusTag, { backgroundColor: `${statusColor}22`, borderColor: `${statusColor}55` }]}>
            <Text style={[s.statusText, { color: statusColor }]}>{STATUS_LABEL[b.status]}</Text>
          </View>
        </View>

        {/* Name & phone */}
        <Text style={s.name}>{b.name ?? '—'}</Text>
        <Text style={s.phone}>{b.phone}</Text>

        {/* Date */}
        <Text style={s.date}>{formatDate(b.createdAt)}</Text>

        {/* Expanded info */}
        {expanded && (
          <View style={s.expanded}>
            {b.objectType && (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>🏠 Объект</Text>
                <Text style={s.infoVal}>{OBJ_LABEL[b.objectType] ?? b.objectType}</Text>
              </View>
            )}
            {b.area && (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>📐 Площадь</Text>
                <Text style={s.infoVal}>{b.area} м²</Text>
              </View>
            )}
            {b.address && (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>📍 Адрес</Text>
                <Text style={s.infoVal}>{b.address}</Text>
              </View>
            )}
            {b.date && (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>📅 Дата</Text>
                <Text style={s.infoVal}>{b.date}{b.timeSlot ? ` ${b.timeSlot}` : ''}</Text>
              </View>
            )}
            {b.notes && (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>📝 Заметки</Text>
                <Text style={s.infoVal}>{b.notes}</Text>
              </View>
            )}

            {/* Actions */}
            {!isDone && (
              <View style={s.actions}>
                {b.status !== 'processing' && (
                  <TouchableOpacity
                    style={[s.actionBtn, { borderColor: C.warning }]}
                    onPress={() => changeStatus('processing', 'В работе')}
                  >
                    <Text style={[s.actionText, { color: C.warning }]}>⚙️ В работе</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[s.actionBtn, { borderColor: C.success }]}
                  onPress={() => changeStatus('done', 'Готово')}
                >
                  <Text style={[s.actionText, { color: C.success }]}>✅ Готово</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.actionBtn, { borderColor: C.error }]}
                  onPress={() => changeStatus('cancelled', 'Отмена')}
                >
                  <Text style={[s.actionText, { color: C.error }]}>✕ Отмена</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Expand hint */}
        <Text style={s.expandHint}>{expanded ? '▲ свернуть' : '▼ подробнее'}</Text>
      </View>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  card: {
    backgroundColor: C.card, borderRadius: 14, marginBottom: 12,
    borderWidth: 1, borderColor: C.border, flexDirection: 'row', overflow: 'hidden',
  },
  cardNew: { borderColor: `${C.primary}50` },
  statusBar: { width: 4 },
  body: { flex: 1, padding: 14 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  typeTag: { backgroundColor: C.primaryDim, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  typeText: { color: C.primary, fontSize: 12, fontWeight: '600' },
  statusTag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  statusText: { fontSize: 12, fontWeight: '600' },
  name: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 2 },
  phone: { fontSize: 14, color: C.cyan, marginBottom: 4, fontWeight: '500' },
  date: { fontSize: 12, color: C.textMuted },
  expanded: { marginTop: 12, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 },
  infoRow: { flexDirection: 'row', marginBottom: 8, gap: 8 },
  infoLabel: { fontSize: 13, color: C.textMuted, width: 90 },
  infoVal: { fontSize: 13, color: C.text, flex: 1 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  actionBtn: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  actionText: { fontSize: 13, fontWeight: '600' },
  expandHint: { fontSize: 11, color: C.textMuted, marginTop: 8 },
})
