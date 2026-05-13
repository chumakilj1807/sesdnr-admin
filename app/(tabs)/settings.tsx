import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert,
} from 'react-native'
import { C } from '@/constants/Colors'
import { useStore } from '@/lib/store'
import type { Site } from '@/lib/types'

// Row component OUTSIDE to avoid remount on every keystroke
function InputRow({
  label, value, onChangeText, hint, keyboard = 'default', secure = false,
}: {
  label: string; value: string; onChangeText: (v: string) => void
  hint?: string; keyboard?: any; secure?: boolean
}) {
  return (
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
}

function SiteForm({
  initial, onSave, onCancel,
}: {
  initial?: Partial<Site>
  onSave: (s: Omit<Site, 'id'>) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [serverUrl, setServerUrl] = useState(initial?.serverUrl ?? 'http://192.168.1.100:3001')
  const [token, setToken] = useState(initial?.token ?? 'sesdnr-app-2026')

  return (
    <View style={s.siteForm}>
      <InputRow label="Название" value={name} onChangeText={setName} />
      <InputRow label="Адрес сервера" value={serverUrl} onChangeText={setServerUrl} keyboard="url" hint="http://IP:3001" />
      <InputRow label="Токен" value={token} onChangeText={setToken} />
      <View style={s.siteFormBtns}>
        <TouchableOpacity style={s.btnCancel} onPress={onCancel}>
          <Text style={s.btnCancelText}>Отмена</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.btnSave}
          onPress={() => {
            if (!name.trim() || !serverUrl.trim()) return
            onSave({ name: name.trim(), serverUrl: serverUrl.trim(), token: token.trim() })
          }}
        >
          <Text style={s.btnSaveText}>Сохранить</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default function SettingsScreen() {
  const { settings, saveSettings, addSite, updateSite, removeSite, switchSite } = useStore()
  const [adminName, setAdminName] = useState(settings.adminName)
  const [nameSaved, setNameSaved] = useState(false)
  const [addingNew, setAddingNew] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const handleSaveName = async () => {
    if (!adminName.trim()) return
    await saveSettings({ adminName: adminName.trim() })
    setNameSaved(true)
    setTimeout(() => setNameSaved(false), 2000)
  }

  const handleAddSite = async (data: Omit<Site, 'id'>) => {
    const site: Site = { id: `site_${Date.now()}`, ...data }
    await addSite(site)
    setAddingNew(false)
  }

  const handleUpdateSite = async (id: string, data: Omit<Site, 'id'>) => {
    await updateSite(id, data)
    setEditingId(null)
  }

  const handleDeleteSite = (site: Site) => {
    Alert.alert('Удалить сайт', `Удалить "${site.name}"?`, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: () => removeSite(site.id) },
    ])
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={s.container}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLogoWrap}>
          <Text style={s.headerX}>X</Text>
        </View>
        <View>
          <Text style={s.appName}>Xenom Manager</Text>
          <Text style={s.headerTitle}>Настройки</Text>
        </View>
      </View>

      {/* Admin name */}
      <View style={s.card}>
        <Text style={s.section}>👤 ПРОФИЛЬ</Text>
        <InputRow
          label="Ваше имя (видно в чате)"
          value={adminName}
          onChangeText={setAdminName}
          hint="Клиент видит это имя когда вы пишете"
        />
        <TouchableOpacity
          style={[s.saveBtn, nameSaved && s.saveBtnOk]}
          onPress={handleSaveName}
        >
          <Text style={s.saveBtnText}>{nameSaved ? '✓ Сохранено' : 'Сохранить имя'}</Text>
        </TouchableOpacity>
      </View>

      {/* Sites */}
      <View style={s.card}>
        <Text style={s.section}>🌐 САЙТЫ</Text>

        {settings.sites.map((site) => (
          <View key={site.id}>
            {editingId === site.id ? (
              <SiteForm
                initial={site}
                onSave={(data) => handleUpdateSite(site.id, data)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <TouchableOpacity
                style={[s.siteRow, site.id === settings.currentSiteId && s.siteRowActive]}
                onPress={() => switchSite(site.id)}
                activeOpacity={0.7}
              >
                <View style={[s.siteIndicator, { backgroundColor: site.id === settings.currentSiteId ? '#7C3AED' : C.border }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.siteName, site.id === settings.currentSiteId && s.siteNameActive]}>
                    {site.name}
                    {site.id === settings.currentSiteId ? '  ●' : ''}
                  </Text>
                  <Text style={s.siteUrl} numberOfLines={1}>{site.serverUrl}</Text>
                </View>
                <TouchableOpacity onPress={() => setEditingId(site.id)} style={s.siteBtn}>
                  <Text style={s.siteBtnText}>✎</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteSite(site)} style={s.siteBtn}>
                  <Text style={[s.siteBtnText, { color: C.error }]}>✕</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {settings.sites.length === 0 && !addingNew && (
          <Text style={s.noSites}>Нет добавленных сайтов</Text>
        )}

        {addingNew ? (
          <SiteForm onSave={handleAddSite} onCancel={() => setAddingNew(false)} />
        ) : (
          <TouchableOpacity style={s.addSiteBtn} onPress={() => setAddingNew(true)}>
            <Text style={s.addSiteBtnText}>+ Добавить сайт</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Info */}
      <View style={s.card}>
        <Text style={s.section}>ℹ️ О ПРИЛОЖЕНИИ</Text>
        <Text style={s.infoRow}>Администратор: <Text style={s.infoVal}>{settings.adminName}</Text></Text>
        <Text style={s.infoRow}>Активный сайт: <Text style={s.infoVal}>{settings.sites.find(s => s.id === settings.currentSiteId)?.name ?? '—'}</Text></Text>
        <Text style={s.infoRow}>Версия: <Text style={s.infoVal}>1.0.0</Text></Text>
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 52, paddingBottom: 20 },
  headerLogoWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center',
    elevation: 6,
  },
  headerX: { fontSize: 26, fontWeight: '900', color: '#fff' },
  appName: { fontSize: 11, fontWeight: '700', color: '#7C3AED', letterSpacing: 1, textTransform: 'uppercase' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: C.textMuted },
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
  saveBtn: {
    backgroundColor: C.primary, borderRadius: 10, paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnOk: { backgroundColor: C.success },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  siteRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#0d1420', borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: C.border,
  },
  siteRowActive: { borderColor: '#7C3AED' },
  siteIndicator: { width: 4, height: 36, borderRadius: 2 },
  siteName: { fontSize: 15, fontWeight: '600', color: C.textSecondary },
  siteNameActive: { color: C.text },
  siteUrl: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  siteBtn: { padding: 6 },
  siteBtnText: { fontSize: 18, color: C.textSecondary },
  noSites: { color: C.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 16 },
  addSiteBtn: {
    borderWidth: 1, borderColor: '#7C3AED', borderRadius: 10, borderStyle: 'dashed',
    paddingVertical: 12, alignItems: 'center', marginTop: 4,
  },
  addSiteBtnText: { color: '#7C3AED', fontSize: 14, fontWeight: '600' },
  siteForm: {
    backgroundColor: '#0d1420', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#7C3AED', marginBottom: 8,
  },
  siteFormBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnCancel: {
    flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  btnCancelText: { color: C.textSecondary, fontSize: 14 },
  btnSave: { flex: 1, backgroundColor: '#7C3AED', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  btnSaveText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  infoRow: { fontSize: 14, color: C.textSecondary, marginBottom: 8 },
  infoVal: { color: C.text, fontWeight: '500' },
})
