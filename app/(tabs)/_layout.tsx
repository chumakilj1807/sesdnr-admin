import { Tabs } from 'expo-router'
import { Text, View } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useStore } from '@/lib/store'
import { C } from '@/constants/Colors'

function Badge({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <View style={{
      position: 'absolute', top: -4, right: -10, minWidth: 18, height: 18,
      backgroundColor: C.error, borderRadius: 9, paddingHorizontal: 4,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: '#0D1220',
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
          paddingTop: 6,
        },
        tabBarActiveTintColor: '#7C3AED',
        tabBarInactiveTintColor: C.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Заявки',
          tabBarIcon: ({ color }) => (
            <View>
              <Feather name="inbox" size={22} color={color} />
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
              <Feather name="message-circle" size={22} color={color} />
              <Badge count={newMessagesCount} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Настройки',
          tabBarIcon: ({ color }) => <Feather name="settings" size={22} color={color} />,
        }}
      />
    </Tabs>
  )
}
