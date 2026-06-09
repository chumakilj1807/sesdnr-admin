import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { C } from '@/constants/Colors'
import { useStore } from '@/lib/store'
import { sendTestNotification } from '@/lib/notifications'
import type { Site } from '@/lib/types'

// Преобразуем `дезинсек.рф` → `xn--d1acahfnt6a.xn--p1ai` (нужно для fetch)
function toAscii(host: string): string {
  try {
    // встроенный URL в Hermes делает IDN-преобразование автоматически
    const u = new URL(host)
    return u.toString().replace(/\/$/, '')
  } catch {
    return host
  }
}

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

function SectionHeader({ icon, title }: { icon: any; title: string }) {
  return (
    <View style={s.sectionHeader}>
      <View style={s.sectionIcon}>
        <Feather name={icon} size={13} color={C.textSecondary} />
      </View>
      <Text style={s.section}>{title}</Text>
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
  const [serverUrl, setServerUrl] = useState(initial?.serverUrl ?? 'https://')
  const [token, setToken] = useState(initial?.token ?? 'sesdnr-app-2026')

  return (
    <View style={s.siteForm}>
      <InputRow label="Название" value={name} onChangeText={setName} hint="Например: sesdnr.ru" />
      <InputRow
        label="Адрес сервера"
        value={serverUrl}
        onChangeText={setServerUrl}
        keyboard="url"
        hint="https://sesdnr.ru  ·  для .рф используйте punycode (xn--...)"
      />
      <InputRow label="Токен" value={token} onChangeText={setToken} />
      <View style={s.siteFormBtns}>
        <TouchableOpacity style={s.btnCancel} onPress={onCancel}>
          <Text style={s.btnCancelText}>Отмена</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.btnSave}
          onPress={() => {
            if (!name.trim() || !serverUrl.trim()) return
            onSave({
              name: name.trim(),
              serverUrl: toAscii(serverUrl.trim().replace(/\/$/, '')),
              token: token.trim(),
            })
          }}
        >
          <Feather name="check" size={14} color="#fff" />
          <Text style={s.btnSaveText}>Сохранить</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default function SettingsScreen() {
  const { settings, saveSettings, addSite, updateSite, removeSite } = useStore()
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
    Alert.alert('Удалить сайт', `Удалить «${site.name}»?`, [
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

      {/* Профиль */}
      <View style={s.card}>
        <SectionHeader icon="user" title="ПРОФИЛЬ" />
        <InputRow
          label="Ваше имя (видно в чате)"
          value={adminName}
          onChangeText={setAdminName}
          hint="Клиент видит это имя когда вы пишете"
        />
        <TouchableOpacity
          style={[s.saveBtn, nameSaved && s.saveBtnOk]}
          onPress={handleSaveName}
          activeOpacity={0.85}
        >
          <Feather name={nameSaved ? 'check' : 'save'} size={14} color="#fff" />
          <Text style={s.saveBtnText}>{nameSaved ? 'Сохранено' : 'Сохранить имя'}</Text>
        </TouchableOpacity>
      </View>

      {/* Сайты */}
      <View style={s.card}>
        <SectionHeader icon="globe" title="САЙТЫ" />

        {settings.sites.map((site) => (
          <View key={site.id}>
            {editingId === site.id ? (
              <SiteForm
                initial={site}
                onSave={(data) => handleUpdateSite(site.id, data)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <View style={s.siteRow}>
                <View style={[s.siteIndicator, { backgroundColor: '#7C3AED' }]} />
                <View style={{ flex: 1 }}>
                  <View style={s.siteNameRow}>
                    <Text style={[s.siteName, s.siteNameActive]} numberOfLines={1}>
                      {site.name}
                    </Text>
                  </View>
                  <Text style={s.siteUrl} numberOfLines={1}>{site.serverUrl}</Text>
                </View>
                <TouchableOpacity onPress={() => setEditingId(site.id)} style={s.siteBtn} hitSlop={8}>
                  <Feather name="edit-2" size={14} color={C.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteSite(site)} style={s.siteBtn} hitSlop={8}>
                  <Feather name="trash-2" size={14} color={C.error} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        {settings.sites.length === 0 && !addingNew && (
          <Text style={s.noSites}>Нет добавленных сайтов</Text>
        )}

        {addingNew ? (
          <SiteForm onSave={handleAddSite} onCancel={() => setAddingNew(false)} />
        ) : (
          <TouchableOpacity style={s.addSiteBtn} onPress={() => setAddingNew(true)} activeOpacity={0.7}>
            <Feather name="plus" size={15} color="#7C3AED" />
            <Text style={s.addSiteBtnText}>Добавить сайт</Text>
          </TouchableOpacity>
        )}

        <Text style={s.helpHint}>
          Заявки и чаты приходят со ВСЕХ добавленных сайтов в общий список. В шапке каждой заявки видно, с какого сайта она пришла. Домены .рф конвертируются в punycode автоматически.
        </Text>
      </View>

      {/* Уведомления */}
      <View style={s.card}>
        <SectionHeader icon="bell" title="УВЕДОМЛЕНИЯ" />
        <Text style={s.hint}>Проверьте, что push-уведомления работают</Text>
        <TouchableOpacity
          style={[s.saveBtn, { marginTop: 12 }]}
          activeOpacity={0.85}
          onPress={async () => {
            await sendTestNotification()
            Alert.alert('Отправлено', 'Уведомление придёт через ~1 секунду')
          }}
        >
          <Feather name="send" size={14} color="#fff" />
          <Text style={s.saveBtnText}>Тест уведомления</Text>
        </TouchableOpacity>
      </View>

      {/* Инфо */}
      <View style={s.card}>
        <SectionHeader icon="info" title="О ПРИЛОЖЕНИИ" />
        <View style={s.infoRow}>
          <Text style={s.infoLbl}>Администратор</Text>
          <Text style={s.infoVal}>{settings.adminName || '—'}</Text>
        </View>
        <View style={s.infoRow}>
          <Text style={s.infoLbl}>Подключено сайтов</Text>
          <Text style={s.infoVal}>{settings.sites.length}</Text>
        </View>
        <View style={s.infoRow}>
          <Text style={s.infoLbl}>Версия</Text>
          <Text style={s.infoVal}>1.1.0</Text>
        </View>
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
    shadowColor: '#7C3AED', shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  headerX: { fontSize: 26, fontWeight: '900', color: '#fff' },
  appName: { fontSize: 10, fontWeight: '700', color: '#7C3AED', letterSpacing: 1.4, textTransform: 'uppercase' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.5 },

  card: {
    backgroundColor: C.card, borderRadius: 16,
    borderWidth: 1, borderColor: C.border, padding: 20, marginBottom: 14,
  },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  sectionIcon: {
    width: 22, height: 22, borderRadius: 6,
    backgroundColor: '#0d1420', borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  section: { fontSize: 11, color: C.textMuted, letterSpacing: 1.2, fontWeight: '700' },

  row: { marginBottom: 16 },
  label: { fontSize: 13, color: C.textSecondary, marginBottom: 8, fontWeight: '500' },
  input: {
    backgroundColor: '#0d1420', borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, color: C.text,
  },
  hint: { fontSize: 12, color: C.textMuted, marginTop: 6, lineHeight: 16 },
  helpHint: { fontSize: 11, color: C.textMuted, marginTop: 12, textAlign: 'center', fontStyle: 'italic' },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: C.primary, borderRadius: 10, paddingVertical: 12,
  },
  saveBtnOk: { backgroundColor: C.success },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  siteRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#0d1420', borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: C.border,
  },
  siteRowActive: { borderColor: '#7C3AED55', backgroundColor: '#1a1530' },
  siteIndicator: { width: 3, height: 36, borderRadius: 1.5 },
  siteNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  siteName: { fontSize: 15, fontWeight: '600', color: C.textSecondary, flexShrink: 1 },
  siteNameActive: { color: C.text },
  siteUrl: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  siteBtn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: '#070b15', borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },

  activeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#7C3AED22', borderRadius: 5,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  activeDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#7C3AED' },
  activeChipText: { color: '#7C3AED', fontSize: 9, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },

  noSites: { color: C.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 16 },

  addSiteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: '#7C3AED88', borderRadius: 10, borderStyle: 'dashed',
    paddingVertical: 12, marginTop: 4,
  },
  addSiteBtnText: { color: '#7C3AED', fontSize: 14, fontWeight: '600' },

  siteForm: {
    backgroundColor: '#0d1420', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#7C3AED66', marginBottom: 8,
  },
  siteFormBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnCancel: {
    flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  btnCancelText: { color: C.textSecondary, fontSize: 14, fontWeight: '500' },
  btnSave: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#7C3AED', borderRadius: 10, paddingVertical: 10,
  },
  btnSaveText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  infoLbl: { fontSize: 13, color: C.textMuted },
  infoVal: { fontSize: 13, color: C.text, fontWeight: '600' },
})
