export const C = {
  // Фон экрана — вертикальный монотонный градиент (см. ScreenGradient в _layout).
  // bg — базовый тон сплошной заливкой (шторки, модалки, сплэш, заполнители).
  bgTop: '#0E1524',
  bgBottom: '#080B13',
  bgSolid: '#0B0F1A',
  bg: '#0B0F1A',
  card: '#131A29',
  cardHover: '#1B2438',
  border: 'rgba(148,163,184,0.14)',
  borderStrong: 'rgba(148,163,184,0.25)',
  primary: '#3D8BFF',
  primaryDim: 'rgba(61,139,255,0.15)',
  cyan: '#00D4AA',
  cyanDim: 'rgba(0,212,170,0.15)',
  accent: '#38BDF8',
  accentDim: 'rgba(56,189,248,0.14)',
  text: '#F9FAFB',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  success: '#10B981',
  successDim: 'rgba(16,185,129,0.15)',
  warning: '#F59E0B',
  warningDim: 'rgba(245,158,11,0.15)',
  error: '#EF4444',
  errorDim: 'rgba(239,68,68,0.15)',
  white: '#FFFFFF',
  shadow: 'rgba(0,0,0,0.4)',
} as const

export const STATUS_COLOR: Record<string, string> = {
  new: C.primary,
  processing: C.warning,
  done: C.success,
  cancelled: C.error,
}

export const STATUS_LABEL: Record<string, string> = {
  new: 'Новая',
  processing: 'В работе',
  done: 'Готово',
  cancelled: 'Отмена',
}
