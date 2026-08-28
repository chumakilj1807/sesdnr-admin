import { Image } from 'react-native'

// Логотип XENOM (assets/logo.png — серебристый на чёрном, квадрат).
// Используется в шапках всех экранов вместо старого фиолетового квадрата с «X».
export default function AppLogo({ size = 44, radius }: { size?: number; radius?: number }) {
  return (
    <Image
      source={require('@/assets/logo.png')}
      style={{ width: size, height: size, borderRadius: radius ?? Math.round(size * 0.28) }}
      resizeMode="cover"
    />
  )
}
