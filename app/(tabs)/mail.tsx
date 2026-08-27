import { useCallback, useRef, useState } from 'react'
import {
  View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity,
  Modal, ScrollView, Alert,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import { C } from '@/constants/Colors'
import { useStore } from '@/lib/store'
import {
  fetchAllMail, fetchAllMailBlocks, moveMail, setMailBlock,
  type MailBlock,
} from '@/lib/api'
import { getMail, setMailBoxLocal, upsertMail } from '@/lib/db'
import { notifyNewMail } from '@/lib/notifications'
import type { MailBox, MailItem, Site } from '@/lib/types'

const BOXES: { key: MailBox; label: string; icon: any }[] = [
  { key: 'inbox', label: 'Входящие', icon: 'inbox' },
  { key: 'sent', label: 'Исходящие', icon: 'send' },
  { key: 'drafts', label: 'Черновики', icon: 'file-text' },
  { key: 'spam', label: 'Спам', icon: 'slash' },
  { key: 'trash', label: 'Удалённые', icon: 'trash-2' },
]

function formatDate(iso: string) {
  try {
    const d = new Date(iso)
    const today = new Date()
    const sameDay = d.toDateString() === today.toDateString()
    return d.toLocaleString('ru', sameDay
      ? { hour: '2-digit', minute: '2-digit' }
      : { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

// Извлечь email из "Имя <email@site.ru>" → email@site.ru
function extractEmail(from: string): string {
  const m = from.match(/<([^>]+)>/)
  return (m ? m[1] : from).trim()
}

export default function MailScreen() {
  const sites = useStore(s => s.settings.sites)
  const siteById = useStore(s => s.siteById)
  const notifyOn = useStore(s => s.settings.notify.mail)
  const clearNewMail = useStore(s => s.clearNewMail)
  const incrementNewMail = useStore(s => s.incrementNewMail)
  const [box, setBox] = useState<MailBox>('inbox')
  const [mails, setMails] = useState<MailItem[]>([])
  const [siteFilter, setSiteFilter] = useState<string>('all')
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [unsupported, setUnsupported] = useState<Site[]>([])
  const [blocksVisible, setBlocksVisible] = useState(false)
  const [blocks, setBlocks] = useState<MailBlock[]>([])
  const [blocksLoading, setBlocksLoading] = useState(false)
  const knownIds = useRef<Set<string>>(new Set())
  const initialized = useRef(false)

  const loadFromDb = async (b: MailBox) => {
    const local = await getMail(b)
    setMails(local)
    for (const m of local) knownIds.current.add(`${m.siteId}:${m.id}`)
  }

  const sync = async (b: MailBox) => {
    if (sites.length === 0) return
    try {
      const { items, errors, unsupported: uns } = await fetchAllMail(sites, b)
      for (const m of items) await upsertMail(m, b)
      setMails(await getMail(b))
      setUnsupported(uns)

      if (errors.length > 0 && items.length === 0 && uns.length < sites.length) {
        setError('Нет связи · показан кэш')
      } else if (errors.length > 0) {
        setError(`Ошибка с ${errors.length} из ${sites.length} сайтов`)
      } else {
        setError('')
      }

      // Пушим только про входящие — остальные папки тихо синкаются
      if (b === 'inbox' && initialized.current) {
        const fresh = items.filter((m) => !knownIds.current.has(`${m.siteId}:${m.id}`))
        if (fresh.length > 0) {
          incrementNewMail(fresh.length)
          if (notifyOn) await notifyNewMail(fresh.length, fresh[0].siteName)
        }
      }
      for (const m of items) knownIds.current.add(`${m.siteId}:${m.id}`)
      initialized.current = true
    } catch {
      setError('Нет связи · показан кэш')
    }
  }

  useFocusEffect(
    useCallback(() => {
      clearNewMail()
      // смена папки — сбрасываем «что уже видели», чтобы не слать пуши про старое
      knownIds.current = new Set()
      initialized.current = false
      loadFromDb(box).then(() => {
        initialized.current = true
        sync(box)
      })
      const t = setInterval(() => sync(box), 30000)
      return () => clearInterval(t)
    }, [sites.length, notifyOn, box])
  )

  const onRefresh = async () => {
    setRefreshing(true)
    await sync(box)
    setRefreshing(false)
  }

  const openMail = (m: MailItem) => {
    if (box === 'drafts') {
      // Черновик открываем сразу в редакторе
      router.push({
        pathname: '/mail/compose',
        params: {
          siteId: m.siteId,
          to: m.to ?? '',
          subject: m.subject ?? '',
          body: m.body ?? m.snippet ?? '',
          draftId: m.id,
        },
      } as any)
      return
    }
    router.push({
      pathname: '/mail/[id]',
      params: { id: m.id, siteId: m.siteId },
    } as any)
  }

  // «Не спам»: вернуть во входящие + снять блокировку отправителя
  const notSpam = async (m: MailItem) => {
    const site = siteById(m.siteId)
    if (!site) return
    await setMailBoxLocal(m.siteId, m.id, 'inbox')
    setMails(await getMail(box))
    try {
      await moveMail(site, m.id, 'inbox')
      await setMailBlock(site, extractEmail(m.from), false)
    } catch {
      Alert.alert('Ошибка', 'Не удалось отправить команду на сервер — письмо вернётся при следующей синхронизации')
    }
  }

  const loadBlocks = async () => {
    setBlocksLoading(true)
    try {
      const { items } = await fetchAllMailBlocks(sites)
      setBlocks(items)
    } catch {
      setBlocks([])
    } finally {
      setBlocksLoading(false)
    }
  }

  const unblock = async (b: MailBlock) => {
    const site = siteById(b.siteId)
    if (!site) return
    try {
      await setMailBlock(site, b.email, false)
      setBlocks(prev => prev.filter(x => !(x.siteId === b.siteId && x.email === b.email)))
    } catch {
      Alert.alert('Ошибка', 'Не удалось разблокировать адрес')
    }
  }

  // Почтовый эндпоинт отсутствует на всех подключённых сайтах
  const allUnsupported =
    sites.length > 0 && unsupported.length === sites.length && mails.length === 0

  // Список с учётом фильтра по сайту
  const filteredMails = siteFilter === 'all' ? mails : mails.filter(m => m.siteId === siteFilter)

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.logoWrap}>
          <Text style={s.logoX}>X</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.appName}>Xenom Manager</Text>
          <Text style={s.title}>Почта</Text>
          <View style={s.subRow}>
            <Text style={s.sub}>{mails.length} писем</Text>
            <View style={s.dot} />
            <Text style={s.sub}>{mails.filter(m => !m.read).length} непрочитанных</Text>
          </View>
        </View>
        <TouchableOpacity
          style={s.composeBtn}
          onPress={() => router.push('/mail/compose' as any)}
          activeOpacity={0.8}
          hitSlop={8}
        >
          <Feather name="edit" size={16} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Переключатель папок */}
      <View style={s.boxes}>
        {BOXES.map(b => {
          const active = box === b.key
          return (
            <TouchableOpacity
              key={b.key}
              style={[s.boxChip, active && s.boxChipActive]}
              onPress={() => setBox(b.key)}
              activeOpacity={0.7}
            >
              <Feather name={b.icon} size={11} color={active ? '#7C3AED' : C.textSecondary} />
              <Text style={[s.boxChipText, active && s.boxChipTextActive]}>{b.label}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Фильтр по сайтам — только если их больше одного */}
      {sites.length > 1 && (
        <View style={s.siteFilters}>
          <TouchableOpacity
            style={[s.siteChip, siteFilter === 'all' && s.siteChipActive]}
            onPress={() => setSiteFilter('all')}
            activeOpacity={0.7}
          >
            <Feather name="layers" size={11} color={siteFilter === 'all' ? '#7C3AED' : C.textSecondary} />
            <Text style={[s.siteChipText, siteFilter === 'all' && s.siteChipTextActive]}>Все сайты</Text>
          </TouchableOpacity>
          {sites.map(site => {
            const count = mails.filter(m => m.siteId === site.id).length
            const active = siteFilter === site.id
            return (
              <TouchableOpacity
                key={site.id}
                style={[s.siteChip, active && s.siteChipActive]}
                onPress={() => setSiteFilter(site.id)}
                activeOpacity={0.7}
              >
                <Feather name="globe" size={11} color={active ? '#7C3AED' : C.textSecondary} />
                <Text style={[s.siteChipText, active && s.siteChipTextActive]} numberOfLines={1}>
                  {site.name}
                </Text>
                {count > 0 && <Text style={[s.siteChipCount, active && s.siteChipCountActive]}>{count}</Text>}
              </TouchableOpacity>
            )
          })}
        </View>
      )}

      {box === 'spam' && (
        <TouchableOpacity
          style={s.blocksBtn}
          onPress={() => { setBlocksVisible(true); loadBlocks() }}
          activeOpacity={0.7}
        >
          <Feather name="slash" size={13} color={C.warning} />
          <Text style={s.blocksBtnText}>Заблокированные адреса</Text>
          <Feather name="chevron-right" size={13} color={C.textMuted} />
        </TouchableOpacity>
      )}

      {error ? (
        <View style={s.errorBanner}>
          <Feather name="wifi-off" size={14} color={C.error} />
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}

      {unsupported.length > 0 && unsupported.length < sites.length && (
        <View style={s.warnBanner}>
          <Feather name="alert-circle" size={14} color={C.warning} />
          <Text style={s.warnText} numberOfLines={2}>
            Почта не настроена: {unsupported.map(x => x.name).join(', ')}
          </Text>
        </View>
      )}

      <FlatList
        data={filteredMails}
        keyExtractor={(item) => `${item.siteId}:${item.id}`}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[s.mailCard, !item.read && s.mailCardUnread]}
            onPress={() => openMail(item)}
            activeOpacity={0.75}
          >
            <View style={s.mailTop}>
              {!item.read && <View style={s.unreadDot} />}
              <Text style={[s.mailFrom, !item.read && s.mailFromUnread]} numberOfLines={1}>
                {box === 'sent' || box === 'drafts'
                  ? (item.to ? `Кому: ${item.to}` : 'Без получателя')
                  : (item.from || 'Неизвестный отправитель')}
              </Text>
              <Text style={s.mailDate}>{formatDate(item.date)}</Text>
            </View>
            <Text style={[s.mailSubject, !item.read && s.mailFromUnread]} numberOfLines={1}>
              {item.subject || '(без темы)'}
            </Text>
            {item.snippet ? (
              <Text style={s.mailSnippet} numberOfLines={2}>{item.snippet}</Text>
            ) : null}
            <View style={s.mailBottom}>
              <View style={s.siteTag}>
                <Feather name="globe" size={10} color={C.textSecondary} />
                <Text style={s.siteText} numberOfLines={1}>{item.siteName}</Text>
              </View>
              {box === 'spam' && (
                <TouchableOpacity
                  style={s.notSpamBtn}
                  onPress={() => notSpam(item)}
                  activeOpacity={0.7}
                  hitSlop={6}
                >
                  <Feather name="check-circle" size={12} color={C.success} />
                  <Text style={s.notSpamText}>Не спам</Text>
                </TouchableOpacity>
              )}
              {box === 'drafts' && (
                <View style={s.draftHint}>
                  <Feather name="edit" size={11} color={C.textMuted} />
                  <Text style={s.draftHintText}>открыть в редакторе</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <View style={s.emptyIconWrap}>
              <Feather name="mail" size={28} color={C.textMuted} />
            </View>
            <Text style={s.emptyText}>
              {sites.length === 0
                ? 'Не добавлен ни один сайт'
                : allUnsupported
                  ? 'Почтовый сервер этого сайта не настроен'
                  : `В папке «${BOXES.find(b => b.key === box)?.label}» пусто`}
            </Text>
            <Text style={s.emptySub}>
              {sites.length === 0
                ? 'Откройте «Настройки» и добавьте сайт'
                : allUnsupported
                  ? 'Добавьте эндпоинт /api/app/mail на сайт, чтобы читать почту здесь'
                  : box === 'inbox'
                    ? 'Новые письма появятся здесь автоматически'
                    : 'Письма появятся здесь после синхронизации'}
            </Text>
          </View>
        }
      />

      {/* Список заблокированных адресов */}
      <Modal
        visible={blocksVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setBlocksVisible(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Заблокированные адреса</Text>
              <TouchableOpacity onPress={() => setBlocksVisible(false)} hitSlop={8}>
                <Feather name="x" size={20} color={C.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {blocksLoading ? (
                <Text style={s.modalEmpty}>Загрузка…</Text>
              ) : blocks.length === 0 ? (
                <Text style={s.modalEmpty}>Нет заблокированных адресов</Text>
              ) : (
                blocks.map(b => (
                  <View key={`${b.siteId}:${b.email}`} style={s.blockRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.blockEmail} numberOfLines={1}>{b.email}</Text>
                      <Text style={s.blockSite}>{b.siteName}</Text>
                    </View>
                    <TouchableOpacity
                      style={s.unblockBtn}
                      onPress={() => unblock(b)}
                      activeOpacity={0.7}
                    >
                      <Feather name="unlock" size={12} color={C.primary} />
                      <Text style={s.unblockText}>Разблокировать</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingTop: 52, paddingBottom: 12,
  },
  logoWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center',
    elevation: 6,
    shadowColor: '#7C3AED', shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  logoX: { fontSize: 22, fontWeight: '900', color: '#fff' },
  appName: { fontSize: 10, fontWeight: '700', color: '#7C3AED', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' },
  sub: { fontSize: 12, color: C.textMuted },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: C.textMuted },

  composeBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center',
  },

  boxes: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: 16, marginBottom: 10,
  },
  boxChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 16,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  boxChipActive: { backgroundColor: '#7C3AED22', borderColor: '#7C3AED88' },
  boxChipText: { fontSize: 12, color: C.textSecondary, fontWeight: '600' },
  boxChipTextActive: { color: '#7C3AED' },

  siteFilters: {
    flexDirection: 'row', paddingHorizontal: 16, gap: 6, marginBottom: 8, flexWrap: 'wrap',
  },
  siteChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border, maxWidth: 200,
  },
  siteChipActive: { backgroundColor: '#7C3AED22', borderColor: '#7C3AED88' },
  siteChipText: { fontSize: 12, color: C.textSecondary, fontWeight: '600' },
  siteChipTextActive: { color: '#7C3AED' },
  siteChipCount: {
    backgroundColor: C.border, borderRadius: 8, paddingHorizontal: 5,
    fontSize: 10, fontWeight: '700', color: C.textSecondary, marginLeft: 2,
  },
  siteChipCountActive: { backgroundColor: '#7C3AED', color: '#fff' },

  blocksBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 8, borderRadius: 10,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  blocksBtnText: { flex: 1, fontSize: 13, color: C.textSecondary, fontWeight: '600' },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.errorDim, marginHorizontal: 16, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8,
    borderWidth: 1, borderColor: `${C.error}33`,
  },
  errorText: { color: C.error, fontSize: 13, flex: 1 },
  warnBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.warningDim, marginHorizontal: 16, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8,
    borderWidth: 1, borderColor: `${C.warning}33`,
  },
  warnText: { color: C.warning, fontSize: 13, flex: 1 },

  mailCard: {
    backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 14, marginBottom: 10,
  },
  mailCardUnread: { borderColor: '#7C3AED55', backgroundColor: '#141a2e' },
  mailTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7C3AED' },
  mailFrom: { flex: 1, fontSize: 14, color: C.textSecondary, fontWeight: '500' },
  mailFromUnread: { color: C.text, fontWeight: '700' },
  mailDate: { fontSize: 11, color: C.textMuted },
  mailSubject: { fontSize: 14, color: C.textSecondary, marginBottom: 2 },
  mailSnippet: { fontSize: 12, color: C.textMuted, lineHeight: 17, marginTop: 2 },

  mailBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  siteTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', maxWidth: 200,
  },
  siteText: { color: C.textSecondary, fontSize: 10, fontWeight: '600' },

  notSpamBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: `${C.success}66`, borderRadius: 8,
    backgroundColor: `${C.success}18`,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  notSpamText: { fontSize: 12, fontWeight: '700', color: C.success },

  draftHint: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  draftHintText: { fontSize: 11, color: C.textMuted },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderWidth: 1, borderColor: C.border, padding: 20, paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: C.text },
  modalEmpty: { color: C.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 24 },
  blockRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    padding: 12, marginBottom: 8,
  },
  blockEmail: { fontSize: 14, fontWeight: '600', color: C.text },
  blockSite: { fontSize: 11, color: C.textMuted, marginTop: 1 },
  unblockBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: `${C.primary}66`, borderRadius: 8,
    backgroundColor: C.primaryDim,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  unblockText: { fontSize: 12, fontWeight: '700', color: C.primary },

  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyText: { color: C.text, fontSize: 16, fontWeight: '600', marginBottom: 4, textAlign: 'center', paddingHorizontal: 24 },
  emptySub: { color: C.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 32 },
})
