import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { C } from '@/constants/Colors'
import { useStore } from '@/lib/store'

export default function SettingsScreen() {
  const { settings, saveSettings } = useStore()
  const [name, setName] = useState(settings.adminName)
  const [serverUrl, setServerUrl] = useState(settings.serverUrl)
  const [token, setToken] = useState(settings.token)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Ошибка', 'Введите имя'); return }
    await saveSettings({ adminName: name.trim(), serverUrl: serverUrl.trim(), token: token.trim() })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const Row = ({ label, value, onChangeText, hint, keyboard = 'default', secure = false }: {
    label: string; value: string; onChangeText: (v: string) => void
    hint?: string; keyboard?: any; secure?: boolean
  }) => (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={C.textMuted}
        keyboardType={keyboard}
        autoCapitalize="none"
        secureTextEntry={secure}
      />
      {hint && <Text style={s.hint}>{hint}</Text>}
    </View>
  )

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={s.container}>
        <Text style={s.title}>Настройки</Text>

        <View style={s.card}>
          <Text style={s.section}>👤 ПРОФИЛЬ</Text>
          <Row
            label="Ваше имя (отображается в чате)"
            value={name}
            onChangeText={setName}
            hint="Клиент видит это имя когда вы пишете в чате"
          />
        </View>

        <View style={s.card}>
          <Text style={s.section}>🔌 ПОДКЛЮЧЕНИЕ</Text>
          <Row
            label="Адрес сервера"
            value={serverUrl}
            onChangeText={setServerUrl}
            hint="Пример: http://192.168.1.42:3001"
            keyboard="url"
          />
          <Row
            label="Токен доступа"
            value={token}
            onChangeText={setToken}
            hint="Значение APP_SECRET_TOKEN из .env.local"
          />
        </View>

        <View style={s.card}>
          <Text style={s.section}>ℹ️ О ПРИЛОЖЕНИИ</Text>
          <Text style={s.infoRow}>Администратор: <Text style={s.infoVal}>{settings.adminName}</Text></Text>
          <Text style={s.infoRow}>Сервер: <Text style={s.infoVal}>{settings.serverUrl}</Text></Text>
          <Text style={s.infoRow}>Версия приложения: <Text style={s.infoVal}>1.0.0</Text></Text>
        </View>

        <TouchableOpacity
          style={[s.btn, saved && s.btnSuccess]}
          onPress={handleSave}
          activeOpacity={0.8}
        >
          <Text style={s.btnText}>{saved ? '✓ Сохранено' : 'Сохранить настройки'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingTop: 56 },
  title: { fontSize: 28, fontWeight: '700', color: C.text, marginBottom: 20 },
  card: {
    backgroundColor: C.card, borderRadius: 16,
    borderWidth: 1, borderColor: C.border, padding: 20, marginBottom: 16,
  },
  section: { fontSize: 11, color: C.textMuted, letterSpacing: 1, fontWeight: '600', marginBottom: 16 },
  row: { marginBottom: 16 },
  label: { fontSize: 14, color: C.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: '#0d1420', borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 14, color: C.text,
  },
  hint: { fontSize: 12, color: C.textMuted, marginTop: 6 },
  infoRow: { fontSize: 14, color: C.textSecondary, marginBottom: 8 },
  infoVal: { color: C.text, fontWeight: '500' },
  btn: {
    backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 8,
  },
  btnSuccess: { backgroundColor: C.success },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
