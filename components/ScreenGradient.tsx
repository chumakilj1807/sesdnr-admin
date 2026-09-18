import { LinearGradient } from 'expo-linear-gradient'
import { StyleProp, ViewStyle } from 'react-native'
import { C } from '@/constants/Colors'

/**
 * Фон экрана: монотонный тёмный с плавным вертикальным переходом.
 * Оборачивает корневой элемент экрана; у корневого элемента экрана
 * backgroundColor должен быть 'transparent'.
 */
export default function ScreenGradient({
  children,
  style,
}: {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}) {
  return (
    <LinearGradient
      colors={[C.bgTop, C.bgBottom]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={[{ flex: 1 }, style]}
    >
      {children}
    </LinearGradient>
  )
}
