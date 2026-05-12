export const C = {
  bg: '#0B0F1A',
  card: '#111827',
  cardHover: '#1a2235',
  border: '#1F2937',
  primary: '#1E6FFF',
  primaryDim: 'rgba(30,111,255,0.15)',
  cyan: '#00D4AA',
  cyanDim: 'rgba(0,212,170,0.15)',
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
