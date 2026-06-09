import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, Linking, Pressable } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { C, STATUS_COLOR, STATUS_LABEL } from '@/constants/Colors'
import type { Booking } from '@/lib/types'

const OBJ_LABEL: Record<string, string> = {
  apartment: 'Квартира', house: 'Дом', commercial: 'Коммерческое', land: 'Участок',
}

interface Props {
  booking: Booking
  onStatusChange: (id: string, status: string) => void
}

function formatPhone(raw: string) {
  // оставляем как есть для отображения; для tel: чистим
  return raw
}

function telHref(raw: string) {
  const clean = raw.replace(/[^\d+]/g, '')
  return `tel:${clean}`
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
    Alert.alert(`Статус: ${label}`, `Установить статус «${label}» для заявки?`, [
      { text: 'Отмена', style: 'cancel' },
      { text: label, onPress: () => onStatusChange(b.id, status) },
    ])
  }

  const callPhone = () => {
    Linking.openURL(telHref(b.phone)).catch(() => {
      Alert.alert('Ошибка', 'Не удалось открыть звонок')
    })
  }

  return (
    <View style={[s.card, isNew && s.cardNew]}>
      {/* Цветной accent слева */}
      <View style={[s.accent, { backgroundColor: statusColor }]} />

      <TouchableOpacity
        style={s.body}
        onPress={() => setExpanded(v => !v)}
        activeOpacity={0.9}
      >
        {/* Верхняя строка: тип + сайт + статус */}
        <View style={s.topRow}>
          <View style={s.topLeft}>
            <View style={s.typeTag}>
              <Feather
                name={b.type === 'callback' ? 'phone-call' : 'clipboard'}
                size={12}
                color={C.primary}
              />
              <Text style={s.typeText}>
                {b.type === 'callback' ? 'Звонок' : 'Заявка'}
              </Text>
            </View>

            {b.siteName ? (
              <View style={s.siteTag}>
                <Feather name="globe" size={11} color={C.textSecondary} />
                <Text style={s.siteText} numberOfLines={1}>{b.siteName}</Text>
              </View>
            ) : null}
          </View>

          <View style={[s.statusTag, { borderColor: `${statusColor}66`, backgroundColor: `${statusColor}1f` }]}>
            <View style={[s.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[s.statusText, { color: statusColor }]}>{STATUS_LABEL[b.status]}</Text>
          </View>
        </View>

        {/* Имя */}
        <Text style={s.name}>{b.name ?? 'Без имени'}</Text>

        {/* Телефон — кликабельный */}
        <Pressable
          onPress={callPhone}
          style={({ pressed }) => [s.phoneBtn, pressed && s.phoneBtnPressed]}
          hitSlop={6}
        >
          <Feather name="phone" size={14} color={C.cyan} />
          <Text style={s.phoneText}>{formatPhone(b.phone)}</Text>
          <View style={s.phoneCallChip}>
            <Feather name="phone-call" size={12} color={C.bg} />
            <Text style={s.phoneCallChipText}>Позвонить</Text>
          </View>
        </Pressable>

        {/* Дата */}
        <View style={s.dateRow}>
          <Feather name="clock" size={11} color={C.textMuted} />
          <Text style={s.date}>{formatDate(b.createdAt)}</Text>
        </View>

        {/* Раскрытая часть */}
        {expanded && (
          <View style={s.expanded}>
            {b.objectType && (
              <InfoRow icon="home" label="Объект" value={OBJ_LABEL[b.objectType] ?? b.objectType} />
            )}
            {b.area != null && (
              <InfoRow icon="maximize-2" label="Площадь" value={`${b.area} м²`} />
            )}
            {b.address && (
              <InfoRow icon="map-pin" label="Адрес" value={b.address} />
            )}
            {b.date && (
              <InfoRow icon="calendar" label="Дата" value={`${b.date}${b.timeSlot ? ` · ${b.timeSlot}` : ''}`} />
            )}
            {b.notes && (
              <InfoRow icon="edit-3" label="Заметки" value={b.notes} />
            )}

            {!isDone && (
              <View style={s.actions}>
                {b.status !== 'processing' && (
                  <TouchableOpacity
                    style={[s.actionBtn, { borderColor: `${C.warning}80`, backgroundColor: `${C.warning}10` }]}
                    onPress={() => changeStatus('processing', 'В работе')}
                  >
                    <Feather name="activity" size={13} color={C.warning} />
                    <Text style={[s.actionText, { color: C.warning }]}>В работе</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[s.actionBtn, { borderColor: `${C.success}80`, backgroundColor: `${C.success}10` }]}
                  onPress={() => changeStatus('done', 'Готово')}
                >
                  <Feather name="check" size={13} color={C.success} />
                  <Text style={[s.actionText, { color: C.success }]}>Готово</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.actionBtn, { borderColor: `${C.error}80`, backgroundColor: `${C.error}10` }]}
                  onPress={() => changeStatus('cancelled', 'Отмена')}
                >
                  <Feather name="x" size={13} color={C.error} />
                  <Text style={[s.actionText, { color: C.error }]}>Отмена</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Hint раскрытия */}
        <View style={s.expandRow}>
          <Feather
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={C.textMuted}
          />
          <Text style={s.expandHint}>{expanded ? 'свернуть' : 'подробнее'}</Text>
        </View>
      </TouchableOpacity>
    </View>
  )
}

function InfoRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <View style={s.infoIconWrap}>
        <Feather name={icon} size={13} color={C.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoVal}>{value}</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  cardNew: {
    borderColor: `${C.primary}55`,
    backgroundColor: '#10182a',
    shadowColor: C.primary,
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  accent: { width: 3 },
  body: { flex: 1, padding: 16 },

  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 8 },
  topLeft: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  typeTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.primaryDim, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  typeText: { color: C.primary, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },

  siteTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#0d1420', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: C.border,
    maxWidth: 180,
  },
  siteText: { color: C.textSecondary, fontSize: 11, fontWeight: '600' },

  statusTag: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },

  name: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 8, letterSpacing: -0.2 },

  phoneBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: `${C.cyan}10`,
    borderWidth: 1, borderColor: `${C.cyan}33`,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 10,
  },
  phoneBtnPressed: { backgroundColor: `${C.cyan}1f`, borderColor: `${C.cyan}55` },
  phoneText: { color: C.cyan, fontSize: 15, fontWeight: '600', flex: 1 },
  phoneCallChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.cyan, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  phoneCallChipText: { color: C.bg, fontSize: 11, fontWeight: '700' },

  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  date: { fontSize: 12, color: C.textMuted },

  expanded: { marginTop: 14, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 },

  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  infoIconWrap: {
    width: 26, height: 26, borderRadius: 7,
    backgroundColor: '#0d1420', borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  infoLabel: { fontSize: 11, color: C.textMuted, marginBottom: 1, textTransform: 'uppercase', letterSpacing: 0.4 },
  infoVal: { fontSize: 14, color: C.text, lineHeight: 18 },

  actions: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  actionText: { fontSize: 13, fontWeight: '600' },

  expandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 10 },
  expandHint: { fontSize: 11, color: C.textMuted, fontWeight: '500' },
})
