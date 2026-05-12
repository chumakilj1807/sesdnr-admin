import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { router } from 'expo-router'
import { C } from '@/constants/Colors'
import { useStore } from '@/lib/store'

export default function SetupScreen() {
  const { saveSettings } = useStore()
  const [name, setName] = useState('')
  const [serverUrl, setServerUrl] = useState('http://192.168.1.100:3001')
  const [token, setToken] = useState('sesdnr-app-2026')
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!name.trim()) { setError('Введите имя администратора'); return }
    if (!serverUrl.trim()) { setError('Введите адрес сервера'); return }

    await saveSettings({
      adminName: name.trim(),
      serverUrl: serverUrl.trim(),
      token: token.trim(),
      setupDone: true,
    })

    router.replace('/(tabs)')
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        {/* Logo area */}
        <View style={s.logoArea}>
          <View style={s.logoCircle}>
            <Text style={s.logoIcon}>🛡️</Text>
          </View>
          <Text style={s.logoTitle}>СЭС Администратор</Text>
          <Text style={s.logoSub}>Настройте приложение для начала работы</Text>
        </View>

        {/* Form */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>ВАШ ПРОФИЛЬ</Text>

          <Text style={s.label}>Имя администратора</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="Например: Владислав"
            placeholderTextColor={C.textMuted}
            autoCapitalize="words"
          />
          <Text style={s.hint}>Будет отображаться в чате с клиентами</Text>

          <View style={s.divider} />
          <Text style={s.sectionLabel}>ПОДКЛЮЧЕНИЕ К СЕРВЕРУ</Text>

          <Text style={s.label}>IP и порт сервера</Text>
          <TextInput
            style={s.input}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="http://192.168.1.100:3001"
            placeholderTextColor={C.textMuted}
            autoCapitalize="none"
            keyboardType="url"
          />
          <Text style={s.hint}>Локальный IP вашего компьютера в сети WiFi</Text>

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
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, paddingTop: 60 },
  logoArea: { alignItems: 'center', marginBottom: 32 },
  logoCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: C.primaryDim, borderWidth: 1, borderColor: C.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  logoIcon: { fontSize: 32 },
  logoTitle: { fontSize: 22, fontWeight: '700', color: C.text, marginBottom: 8 },
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
  divider: { height: 1, backgroundColor: C.border, marginVertical: 16 },
  error: { color: C.error, textAlign: 'center', marginBottom: 12, fontSize: 14 },
  btn: {
    backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 8,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
