import { Image } from 'react-native'

// Логотип XENOM (assets/logo-transparent.png — прозрачный фон, без чёрной подложки).
// Картинка широкая (~2.2:1), поэтому высота считается от заданного размера.
export default function AppLogo({ size = 64 }: { size?: number; radius?: number }) {
  const w = size
  const h = Math.round(size * (235 / 512))
  return (
    <Image
      source={require('@/assets/logo-transparent.png')}
      style={{ width: w, height: h }}
      resizeMode="contain"
    />
  )
}
