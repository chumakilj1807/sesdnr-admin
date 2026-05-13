import { Tabs } from 'expo-router'
import { Text, View } from 'react-native'
import { useStore } from '@/lib/store'
import { C } from '@/constants/Colors'

function Badge({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <View style={{
      position: 'absolute', top: -4, right: -8, minWidth: 18, height: 18,
      backgroundColor: C.error, borderRadius: 9, paddingHorizontal: 4,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  )
}

export default function TabLayout() {
  const { newBookingsCount, newMessagesCount } = useStore()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0D1220',
          borderTopColor: C.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: '#7C3AED',
        tabBarInactiveTintColor: C.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Заявки',
          tabBarIcon: ({ color }) => (
            <View>
              <Text style={{ fontSize: 22 }}>📋</Text>
              <Badge count={newBookingsCount} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Чаты',
          tabBarIcon: ({ color }) => (
            <View>
              <Text style={{ fontSize: 22 }}>💬</Text>
              <Badge count={newMessagesCount} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Настройки',
          tabBarIcon: () => <Text style={{ fontSize: 22 }}>⚙️</Text>,
        }}
      />
    </Tabs>
  )
}
