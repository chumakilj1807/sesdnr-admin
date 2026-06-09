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

function telHref(raw: string) {
  const clean = raw.replace(/[^\d+]/g, '')
  return `tel:${clean}`
}

// Цветовые наборы по статусу: фон карточки + цвет accent
const STATUS_THEME: Record<string, {
  bg: string; border: string; tint: string; tintBorder: string;
  phoneBg: string; phoneBorder: string; phoneText: string;
  phoneChipBg: string; phoneChipText: string;
}> = {
  new: {
    bg: C.card, border: C.border, tint: C.primary, tintBorder: `${C.primary}55`,
    phoneBg: `${C.cyan}15`, phoneBorder: `${C.cyan}55`, phoneText: C.cyan,
    phoneChipBg: C.cyan, phoneChipText: C.bg,
  },
  processing: {
    // Жёлтый
    bg: '#2a230a', border: '#5b4915', tint: C.warning, tintBorder: `${C.warning}88`,
    phoneBg: '#fde68a22', phoneBorder: '#fde68a55', phoneText: '#fde68a',
    phoneChipBg: '#fbbf24', phoneChipText: '#1f1300',
  },
  done: {
    // Зелёный
    bg: '#0e2017', border: '#125a37', tint: C.success, tintBorder: `${C.success}88`,
    phoneBg: '#34d39922', phoneBorder: '#34d39966', phoneText: '#a7f3d0',
    phoneChipBg: '#10b981', phoneChipText: '#02100b',
  },
  cancelled: {
    // Красный
    bg: '#241010', border: '#5b1e1e', tint: C.error, tintBorder: `${C.error}88`,
    phoneBg: '#f8717122', phoneBorder: '#f8717166', phoneText: '#fca5a5',
    phoneChipBg: '#ef4444', phoneChipText: '#fff',
  },
}

export default function BookingCard({ booking: b, onStatusChange }: Props) {
  const [expanded, setExpanded] = useState(false)

  const theme = STATUS_THEME[b.status] ?? STATUS_THEME.new
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
    Alert.alert(`Изменить статус`, `Установить статус «${label}» для заявки?`, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Подтвердить', onPress: () => onStatusChange(b.id, status) },
    ])
  }

  const callPhone = () => {
    Linking.openURL(telHref(b.phone)).catch(() => {
      Alert.alert('Ошибка', 'Не удалось открыть звонок')
    })
  }

  return (
    <View style={[
      s.card,
      { backgroundColor: theme.bg, borderColor: theme.border },
      isNew && s.cardNew,
    ]}>
      {/* Цветной accent слева */}
      <View style={[s.accent, { backgroundColor: theme.tint }]} />

      <View style={s.body}>
        {/* Верхняя строка: тип + сайт + статус */}
        <View style={s.topRow}>
          <View style={s.topLeft}>
            <View style={[s.typeTag, { backgroundColor: `${theme.tint}22`, borderColor: `${theme.tint}55` }]}>
              <Feather
                name={b.type === 'callback' ? 'phone-call' : 'clipboard'}
                size={12}
                color={theme.tint}
              />
              <Text style={[s.typeText, { color: theme.tint }]}>
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

          <View style={[s.statusTag, { borderColor: theme.tintBorder, backgroundColor: `${statusColor}22` }]}>
            <View style={[s.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[s.statusText, { color: statusColor }]}>{STATUS_LABEL[b.status]}</Text>
          </View>
        </View>

        {/* Имя */}
        <Text style={s.name}>{b.name ?? 'Без имени'}</Text>

        {/* Телефон — кликабельный */}
        <Pressable
          onPress={callPhone}
          style={({ pressed }) => [
            s.phoneBtn,
            { backgroundColor: theme.phoneBg, borderColor: theme.phoneBorder },
            pressed && s.phoneBtnPressed,
          ]}
          hitSlop={6}
        >
          <Feather name="phone" size={14} color={theme.phoneText} />
          <Text style={[s.phoneText, { color: theme.phoneText }]}>{b.phone}</Text>
          <View style={[s.phoneCallChip, { backgroundColor: theme.phoneChipBg }]}>
            <Feather name="phone-call" size={12} color={theme.phoneChipText} />
            <Text style={[s.phoneCallChipText, { color: theme.phoneChipText }]}>Позвонить</Text>
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
                    style={[s.actionBtn, { borderColor: `${C.warning}aa`, backgroundColor: `${C.warning}20` }]}
                    onPress={() => changeStatus('processing', 'В работе')}
                    activeOpacity={0.7}
                  >
                    <Feather name="activity" size={13} color={C.warning} />
                    <Text style={[s.actionText, { color: C.warning }]}>В работе</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[s.actionBtn, { borderColor: `${C.success}aa`, backgroundColor: `${C.success}20` }]}
                  onPress={() => changeStatus('done', 'Готово')}
                  activeOpacity={0.7}
                >
                  <Feather name="check" size={13} color={C.success} />
                  <Text style={[s.actionText, { color: C.success }]}>Готово</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.actionBtn, { borderColor: `${C.error}aa`, backgroundColor: `${C.error}20` }]}
                  onPress={() => changeStatus('cancelled', 'Отмена')}
                  activeOpacity={0.7}
                >
                  <Feather name="x" size={13} color={C.error} />
                  <Text style={[s.actionText, { color: C.error }]}>Отмена</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Для завершённых — кнопка вернуть в "новые" */}
            {isDone && (
              <View style={s.actions}>
                <TouchableOpacity
                  style={[s.actionBtn, { borderColor: `${C.primary}aa`, backgroundColor: `${C.primary}20` }]}
                  onPress={() => changeStatus('new', 'Новая')}
                  activeOpacity={0.7}
                >
                  <Feather name="rotate-ccw" size={13} color={C.primary} />
                  <Text style={[s.actionText, { color: C.primary }]}>Вернуть в новые</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Отдельная кнопка раскрытия — НЕ перекрывает action-кнопки */}
        <TouchableOpacity
          style={s.expandRow}
          onPress={() => setExpanded(v => !v)}
          activeOpacity={0.6}
          hitSlop={6}
        >
          <Feather
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={C.textMuted}
          />
          <Text style={s.expandHint}>{expanded ? 'свернуть' : 'подробнее'}</Text>
        </TouchableOpacity>
      </View>
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
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  cardNew: {
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
    borderRadius: 6, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  typeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },

  siteTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
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
    borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 10,
  },
  phoneBtnPressed: { opacity: 0.85 },
  phoneText: { fontSize: 15, fontWeight: '700', flex: 1 },
  phoneCallChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  phoneCallChipText: { fontSize: 11, fontWeight: '700' },

  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  date: { fontSize: 12, color: C.textMuted },

  expanded: { marginTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 12 },

  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  infoIconWrap: {
    width: 26, height: 26, borderRadius: 7,
    backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  infoLabel: { fontSize: 11, color: C.textMuted, marginBottom: 1, textTransform: 'uppercase', letterSpacing: 0.4 },
  infoVal: { fontSize: 14, color: C.text, lineHeight: 18 },

  actions: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  actionText: { fontSize: 13, fontWeight: '700' },

  expandRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    marginTop: 12, paddingVertical: 6,
  },
  expandHint: { fontSize: 11, color: C.textMuted, fontWeight: '600' },
})
