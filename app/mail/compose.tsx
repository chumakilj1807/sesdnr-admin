import { useState } from 'react'
import {
  View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { C } from '@/constants/Colors'
import { useStore } from '@/lib/store'
import { sendMail } from '@/lib/api'
import type { Site } from '@/lib/types'

export default function MailComposeScreen() {
  const params = useLocalSearchParams<{
    siteId?: string; to?: string; subject?: string; inReplyTo?: string
  }>()
  const sites = useStore(s => s.settings.sites)
  const [siteId, setSiteId] = useState(params.siteId ?? sites[0]?.id ?? '')
  const [to, setTo] = useState(params.to ?? '')
  const [subject, setSubject] = useState(params.subject ?? '')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  const isReply = !!params.inReplyTo
  const selectedSite: Site | null = sites.find(x => x.id === siteId) ?? null

  const handleSend = async () => {
    if (!selectedSite) {
      Alert.alert('Не выбран сайт', 'Выберите, от какого сайта отправить письмо')
      return
    }
    if (!to.trim()) {
      Alert.alert('Пустой адрес', 'Укажите получателя')
      return
    }
    if (!body.trim() && !subject.trim()) {
      Alert.alert('Пустое письмо', 'Напишите тему или текст письма')
      return
    }
    setSending(true)
    try {
      await sendMail(selectedSite, {
        to: to.trim(),
        subject: subject.trim(),
        body: body.trim(),
        inReplyTo: params.inReplyTo,
      })
      Alert.alert('Отправлено', `Письмо отправлено через ${selectedSite.name}`)
      router.back()
    } catch (e: any) {
      Alert.alert(
        'Ошибка отправки',
        e?.message?.includes('404')
          ? 'Почтовый сервер этого сайта не настроен'
          : `Сервер ответил: ${e?.message ?? 'неизвестная ошибка'}`
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={s.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <Feather name="x" size={20} color={C.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{isReply ? 'Ответ' : 'Новое письмо'}</Text>
      </View>

      {/* От какого сайта отправить */}
      <Text style={s.label}>Отправить от сайта</Text>
      {sites.length === 0 ? (
        <Text style={s.hint}>Нет добавленных сайтов — сначала добавьте сайт в настройках</Text>
      ) : (
        <View style={s.chips}>
          {sites.map(site => {
            const active = site.id === siteId
            return (
              <TouchableOpacity
                key={site.id}
                style={[s.chip, active && s.chipActive]}
                onPress={() => setSiteId(site.id)}
                activeOpacity={0.7}
              >
                <Feather name="globe" size={11} color={active ? '#7C3AED' : C.textSecondary} />
                <Text style={[s.chipText, active && s.chipTextActive]} numberOfLines={1}>
                  {site.name}
                </Text>
                {active && <Feather name="check" size={11} color="#7C3AED" />}
              </TouchableOpacity>
            )
          })}
        </View>
      )}
      {selectedSite ? (
        <Text style={s.hint}>
          Письмо уйдёт с адреса сайта {selectedSite.serverUrl.replace(/^https?:\/\//, '')}
        </Text>
      ) : null}

      <Text style={s.label}>Кому</Text>
      <TextInput
        style={s.input}
        value={to}
        onChangeText={setTo}
        placeholder="client@example.com"
        placeholderTextColor={C.textMuted}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text style={s.label}>Тема</Text>
      <TextInput
        style={s.input}
        value={subject}
        onChangeText={setSubject}
        placeholder="Тема письма"
        placeholderTextColor={C.textMuted}
      />

      <Text style={s.label}>Текст</Text>
      <TextInput
        style={[s.input, s.bodyInput]}
        value={body}
        onChangeText={setBody}
        placeholder="Текст письма…"
        placeholderTextColor={C.textMuted}
        multiline
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={[s.sendBtn, (sending || sites.length === 0) && { opacity: 0.6 }]}
        onPress={handleSend}
        disabled={sending || sites.length === 0}
        activeOpacity={0.85}
      >
        {sending ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Feather name="send" size={14} color="#fff" />
            <Text style={s.sendBtnText}>Отправить</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: 32, paddingBottom: 20,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: C.text, letterSpacing: -0.3 },

  label: { fontSize: 13, color: C.textSecondary, marginBottom: 8, fontWeight: '500' },
  hint: { fontSize: 12, color: C.textMuted, marginTop: 8, marginBottom: 4, lineHeight: 16 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border, maxWidth: 220,
  },
  chipActive: { backgroundColor: '#7C3AED22', borderColor: '#7C3AED88' },
  chipText: { fontSize: 13, color: C.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#7C3AED' },

  input: {
    backgroundColor: '#0d1420', borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, color: C.text, marginBottom: 16,
  },
  bodyInput: { minHeight: 160 },

  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: C.primary, borderRadius: 10, paddingVertical: 13, marginTop: 4,
  },
  sendBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
})
