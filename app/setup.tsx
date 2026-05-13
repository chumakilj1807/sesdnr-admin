import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView,
} from 'react-native'
import { router } from 'expo-router'
import { C } from '@/constants/Colors'
import { useStore } from '@/lib/store'
import type { Site } from '@/lib/types'

export default function SetupScreen() {
  const { saveSettings, addSite } = useStore()
  const [adminName, setAdminName] = useState('')
  const [siteName, setSiteName] = useState('Основной сайт')
  const [serverUrl, setServerUrl] = useState('http://192.168.1.100:3001')
  const [token, setToken] = useState('sesdnr-app-2026')
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!adminName.trim()) { setError('Введите имя администратора'); return }
    if (!serverUrl.trim()) { setError('Введите адрес сервера'); return }

    const newSite: Site = {
      id: `site_${Date.now()}`,
      name: siteName.trim() || 'Основной сайт',
      serverUrl: serverUrl.trim(),
      token: token.trim(),
    }

    await saveSettings({ adminName: adminName.trim(), setupDone: true, sites: [newSite], currentSiteId: newSite.id })
    router.replace('/(tabs)')
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={s.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.logoArea}>
        <View style={s.logoCircle}>
          <Text style={s.logoX}>X</Text>
        </View>
        <Text style={s.logoTitle}>Xenom Manager</Text>
        <Text style={s.logoSub}>Настройте приложение для начала работы</Text>
      </View>

      <View style={s.card}>
        <Text style={s.sectionLabel}>ПРОФИЛЬ</Text>

        <Text style={s.label}>Имя администратора</Text>
        <TextInput
          style={s.input}
          value={adminName}
          onChangeText={setAdminName}
          placeholder="Например: Владислав"
          placeholderTextColor={C.textMuted}
          autoCapitalize="words"
        />
        <Text style={s.hint}>Отображается клиентам в чате</Text>
      </View>

      <View style={s.card}>
        <Text style={s.sectionLabel}>ПЕРВЫЙ САЙТ</Text>

        <Text style={s.label}>Название сайта</Text>
        <TextInput
          style={s.input}
          value={siteName}
          onChangeText={setSiteName}
          placeholder="Основной сайт"
          placeholderTextColor={C.textMuted}
          autoCapitalize="none"
        />

        <Text style={s.label}>Адрес сервера</Text>
        <TextInput
          style={s.input}
          value={serverUrl}
          onChangeText={setServerUrl}
          placeholder="http://192.168.1.100:3001"
          placeholderTextColor={C.textMuted}
          autoCapitalize="none"
          keyboardType="url"
        />
        <Text style={s.hint}>Локальный IP компьютера в сети WiFi</Text>

        <Text style={s.label}>Токен доступа</Text>
        <TextInput
          style={s.input}
          value={token}
          onChangeText={setToken}
          placeholder="sesdnr-app-2026"
          placeholderTextColor={C.textMuted}
          autoCapitalize="none"
        />
      </View>

      {error ? <Text style={s.error}>{error}</Text> : null}

      <TouchableOpacity style={s.btn} onPress={handleSave} activeOpacity={0.8}>
        <Text style={s.btnText}>Начать работу →</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, paddingTop: 60 },
  logoArea: { alignItems: 'center', marginBottom: 32 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  logoX: { fontSize: 42, fontWeight: '900', color: '#fff', letterSpacing: -2 },
  logoTitle: { fontSize: 26, fontWeight: '800', color: C.text, marginBottom: 6, letterSpacing: -0.5 },
  logoSub: { fontSize: 14, color: C.textSecondary, textAlign: 'center' },
  card: {
    backgroundColor: C.card, borderRadius: 16,
    borderWidth: 1, borderColor: C.border, padding: 20, marginBottom: 16,
  },
  sectionLabel: { fontSize: 11, color: C.textMuted, letterSpacing: 1, marginBottom: 16, fontWeight: '600' },
  label: { fontSize: 14, color: C.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: '#0d1420', borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: C.text, marginBottom: 8,
  },
  hint: { fontSize: 12, color: C.textMuted, marginBottom: 16 },
  error: { color: C.error, textAlign: 'center', marginBottom: 12, fontSize: 14 },
  btn: {
    backgroundColor: '#7C3AED', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 8, marginBottom: 40,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
