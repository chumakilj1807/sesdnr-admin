import { useCallback, useRef, useState } from 'react'
import {
  View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import { C } from '@/constants/Colors'
import { useStore } from '@/lib/store'
import { fetchAllMail } from '@/lib/api'
import { getMail, upsertMail } from '@/lib/db'
import { notifyNewMail } from '@/lib/notifications'
import type { MailItem, Site } from '@/lib/types'

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

export default function MailScreen() {
  const sites = useStore(s => s.settings.sites)
  const notifyOn = useStore(s => s.settings.notify.mail)
  const clearNewMail = useStore(s => s.clearNewMail)
  const incrementNewMail = useStore(s => s.incrementNewMail)
  const [mails, setMails] = useState<MailItem[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [unsupported, setUnsupported] = useState<Site[]>([])
  const knownIds = useRef<Set<string>>(new Set())
  const initialized = useRef(false)

  const loadFromDb = async () => {
    const local = await getMail()
    setMails(local)
    for (const m of local) knownIds.current.add(`${m.siteId}:${m.id}`)
  }

  const sync = async () => {
    if (sites.length === 0) return
    try {
      const { items, errors, unsupported: uns } = await fetchAllMail(sites)
      for (const m of items) await upsertMail(m)
      setMails(await getMail())
      setUnsupported(uns)

      if (errors.length > 0 && items.length === 0 && uns.length < sites.length) {
        setError('Нет связи · показан кэш')
      } else if (errors.length > 0) {
        setError(`Ошибка с ${errors.length} из ${sites.length} сайтов`)
      } else {
        setError('')
      }

      if (initialized.current) {
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
      loadFromDb().then(() => {
        initialized.current = true
        sync()
      })
      const t = setInterval(sync, 30000)
      return () => clearInterval(t)
    }, [sites.length, notifyOn])
  )

  const onRefresh = async () => {
    setRefreshing(true)
    await sync()
    setRefreshing(false)
  }

  const openMail = (m: MailItem) => {
    router.push({
      pathname: '/mail/[id]',
      params: { id: m.id, siteId: m.siteId },
    } as any)
  }

  // Почтовый эндпоинт отсутствует на всех подключённых сайтах
  const allUnsupported =
    sites.length > 0 && unsupported.length === sites.length && mails.length === 0

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
        data={mails}
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
                {item.from || 'Неизвестный отправитель'}
              </Text>
              <Text style={s.mailDate}>{formatDate(item.date)}</Text>
            </View>
            <Text style={[s.mailSubject, !item.read && s.mailFromUnread]} numberOfLines={1}>
              {item.subject || '(без темы)'}
            </Text>
            {item.snippet ? (
              <Text style={s.mailSnippet} numberOfLines={2}>{item.snippet}</Text>
            ) : null}
            <View style={s.siteTag}>
              <Feather name="globe" size={10} color={C.textSecondary} />
              <Text style={s.siteText} numberOfLines={1}>{item.siteName}</Text>
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
                  : 'Писем пока нет'}
            </Text>
            <Text style={s.emptySub}>
              {sites.length === 0
                ? 'Откройте «Настройки» и добавьте сайт'
                : allUnsupported
                  ? 'Добавьте эндпоинт /api/app/mail на сайт, чтобы читать почту здесь'
                  : 'Новые письма появятся здесь автоматически'}
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

  siteTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3, marginTop: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', maxWidth: 200,
  },
  siteText: { color: C.textSecondary, fontSize: 10, fontWeight: '600' },

  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyText: { color: C.text, fontSize: 16, fontWeight: '600', marginBottom: 4, textAlign: 'center', paddingHorizontal: 24 },
  emptySub: { color: C.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 32 },
})
