import { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { C } from '@/constants/Colors'
import { useStore } from '@/lib/store'
import { fetchMailDetail } from '@/lib/api'
import { getMailById, markMailRead, saveMailBody } from '@/lib/db'
import type { MailDetail } from '@/lib/types'

export default function MailDetailScreen() {
  const { id, siteId } = useLocalSearchParams<{ id: string; siteId: string }>()
  const siteById = useStore(s => s.siteById)
  const [mail, setMail] = useState<(MailDetail) | null>(null)
  const [loadingBody, setLoadingBody] = useState(false)
  const [error, setError] = useState('')

  useFocusEffect(
    useCallback(() => {
      if (!id || !siteId) return
      let cancelled = false
      ;(async () => {
        // 1) мгновенно из кэша
        const cached = await getMailById(siteId, id)
        if (cancelled) return
        if (cached) setMail(cached as MailDetail)
        await markMailRead(siteId, id)

        // 2) тело письма с сервера
        const site = siteById(siteId)
        if (!site) return
        setLoadingBody(true)
        try {
          const full = await fetchMailDetail(site, id)
          if (cancelled) return
          setMail(full)
          if (full.body) await saveMailBody(siteId, id, full.body)
          setError('')
        } catch {
          if (!cancelled) setError(cached?.body ? '' : 'Не удалось загрузить письмо с сервера')
        } finally {
          if (!cancelled) setLoadingBody(false)
        }
      })()
      return () => { cancelled = true }
    }, [id, siteId])
  )

  const reply = () => {
    if (!mail) return
    const subject = mail.subject && /^re:/i.test(mail.subject) ? mail.subject : `Re: ${mail.subject ?? ''}`
    router.push({
      pathname: '/mail/compose',
      params: { siteId: mail.siteId, to: mail.from, subject, inReplyTo: mail.id },
    } as any)
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={C.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>Письмо</Text>
        {mail ? (
          <TouchableOpacity onPress={reply} style={s.replyBtn} hitSlop={8} activeOpacity={0.8}>
            <Feather name="corner-up-left" size={14} color="#fff" />
            <Text style={s.replyBtnText}>Ответить</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? (
        <View style={s.errorBanner}>
          <Feather name="wifi-off" size={14} color={C.error} />
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={s.content}>
        {mail ? (
          <>
            <Text style={s.subject}>{mail.subject || '(без темы)'}</Text>
            <View style={s.metaCard}>
              <View style={s.metaRow}>
                <Text style={s.metaLbl}>От</Text>
                <Text style={s.metaVal} numberOfLines={1}>{mail.from}</Text>
              </View>
              {mail.to ? (
                <View style={s.metaRow}>
                  <Text style={s.metaLbl}>Кому</Text>
                  <Text style={s.metaVal} numberOfLines={1}>{mail.to}</Text>
                </View>
              ) : null}
              <View style={s.metaRow}>
                <Text style={s.metaLbl}>Сайт</Text>
                <View style={s.siteTag}>
                  <Feather name="globe" size={10} color={C.textSecondary} />
                  <Text style={s.siteText}>{mail.siteName}</Text>
                </View>
              </View>
              <View style={s.metaRow}>
                <Text style={s.metaLbl}>Дата</Text>
                <Text style={s.metaVal}>
                  {(() => { try { return new Date(mail.date).toLocaleString('ru') } catch { return mail.date } })()}
                </Text>
              </View>
            </View>

            {loadingBody && !mail.body ? (
              <View style={s.loadingWrap}>
                <ActivityIndicator color="#7C3AED" />
                <Text style={s.loadingText}>Загружаем письмо…</Text>
              </View>
            ) : (
              <Text style={s.body}>{mail.body || mail.snippet || '(пустое письмо)'}</Text>
            )}
          </>
        ) : (
          <View style={s.loadingWrap}>
            <ActivityIndicator color="#7C3AED" />
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: C.text },
  replyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#7C3AED', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  replyBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.errorDim, marginHorizontal: 16, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8,
    borderWidth: 1, borderColor: `${C.error}33`,
  },
  errorText: { color: C.error, fontSize: 13, flex: 1 },

  content: { padding: 20, paddingBottom: 40 },
  subject: { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 14, letterSpacing: -0.3 },

  metaCard: {
    backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 14, marginBottom: 16, gap: 8,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaLbl: { width: 44, fontSize: 12, color: C.textMuted },
  metaVal: { flex: 1, fontSize: 13, color: C.text, fontWeight: '500' },
  siteTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  siteText: { color: C.textSecondary, fontSize: 11, fontWeight: '600' },

  body: { fontSize: 15, color: C.text, lineHeight: 23 },
  loadingWrap: { alignItems: 'center', paddingTop: 40, gap: 10 },
  loadingText: { color: C.textMuted, fontSize: 13 },
})
