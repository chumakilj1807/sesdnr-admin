import { useEffect, useMemo, useRef, useState } from 'react'
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, G, Line, Polyline, Text as SvgText } from 'react-native-svg'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import { C } from '@/constants/Colors'
import { axisLabel, rangeTitle, type Granularity, type SeriesId, type SeriesPoint } from '@/lib/statsSeries'

export const SERIES_META: Record<SeriesId, { label: string; color: string; icon: string }> = {
  bookings: { label: 'Заявки', color: C.primary, icon: 'clipboard' },
  calls: { label: 'Звонки', color: C.cyan, icon: 'phone' },
  mails: { label: 'Письма', color: C.warning, icon: 'mail' },
  chats: { label: 'Чаты', color: '#A855F7', icon: 'message-circle' },
}

const SERIES_IDS: SeriesId[] = ['bookings', 'calls', 'mails', 'chats']

const HEIGHT = 210
const PAD_L = 30 // подписи оси Y
const PAD_R = 10
const PAD_T = 12
const PAD_B = 24 // подписи оси X
const GRID_LINES = 4
const MARKER_LIMIT = 45 // больше точек в окне — маркеры не рисуем

interface Props {
  points: SeriesPoint[]
  granularity: Granularity
  visible: Record<SeriesId, boolean>
  selectedKey: string | null
  onSelect: (key: string) => void
  // Размер окна в точках для дневного режима (управляется кнопками-лупами).
  // Не задан — показываем всё.
  windowSize?: number
}

// «Красивый» максимум оси Y: 1, 2, 5 * 10^k не ниже реального максимума
function niceMax(v: number): number {
  if (v <= 1) return 1
  const pow = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / pow
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return nice * pow
}

export default function StatsLineChart({
  points,
  granularity,
  visible,
  selectedKey,
  onSelect,
  windowSize,
}: Props) {
  const [width, setWidth] = useState(0)
  // Окно просмотра: count — сколько точек видно, end — индекс правой точки
  const [winCount, setWinCount] = useState(points.length)
  const [winEnd, setWinEnd] = useState(points.length - 1)

  const n = points.length

  // Смена режима или набора данных — окно прижимаем к правому (свежему) краю
  useEffect(() => {
    setWinEnd(n - 1)
  }, [granularity, n])

  // Размер окна: месячный режим — все точки; дневной — windowSize (лупы)
  useEffect(() => {
    const target = Math.max(1, Math.min(granularity === 'month' ? n : windowSize ?? n, n))
    setWinCount(target)
    setWinEnd(e => Math.min(n - 1, Math.max(target - 1, e)))
  }, [granularity, n, windowSize])

  // Рефы для колбэков жестов (worklets видят актуальные значения)
  const stateRef = useRef({ winCount, winEnd, n })
  stateRef.current = { winCount, winEnd, n }
  const baseEnd = useRef(winEnd)

  const plotW = Math.max(0, width - PAD_L - PAD_R)
  const plotH = HEIGHT - PAD_T - PAD_B

  const sliceStart = Math.max(0, winEnd - winCount + 1)
  const window = useMemo(() => points.slice(sliceStart, winEnd + 1), [points, sliceStart, winEnd])

  const yMax = useMemo(() => {
    let m = 1
    for (const p of window) for (const id of SERIES_IDS) if (visible[id]) m = Math.max(m, p[id])
    return niceMax(m)
  }, [window, visible])

  const spacing = window.length > 1 ? plotW / (window.length - 1) : plotW
  const xOf = (i: number) => PAD_L + (window.length > 1 ? i * spacing : plotW / 2)
  const yOf = (v: number) => PAD_T + plotH - (v / yMax) * plotH

  const polylines = useMemo(() => {
    const out: Partial<Record<SeriesId, string>> = {}
    for (const id of SERIES_IDS) {
      if (!visible[id]) continue
      out[id] = window.map((p, i) => `${xOf(i).toFixed(1)},${yOf(p[id]).toFixed(1)}`).join(' ')
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [window, visible, yMax, plotW])

  // ── Жесты: свайп листает окно, тап выбирает точку ──────────────────────────
  const applyPan = (tx: number) => {
    const st = stateRef.current
    if (st.winCount >= st.n || spacing <= 0) return
    const shift = Math.round(-tx / spacing)
    const next = baseEnd.current + shift
    setWinEnd(Math.min(st.n - 1, Math.max(st.winCount - 1, next)))
  }

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-10, 10])
        .failOffsetY([-12, 12])
        .onStart(() => {
          baseEnd.current = stateRef.current.winEnd
        })
        .onUpdate(e => {
          runOnJS(applyPan)(e.translationX)
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spacing]
  )

  const tap = useMemo(
    () =>
      Gesture.Tap().onEnd(e => {
        const st = stateRef.current
        if (spacing <= 0) return
        const i = Math.round((e.x - PAD_L) / spacing)
        const clamped = Math.max(0, Math.min(st.winCount - 1, i))
        const p = points[Math.max(0, st.winEnd - st.winCount + 1) + clamped]
        if (p) runOnJS(onSelect)(p.key)
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spacing, points, onSelect]
  )

  const gesture = useMemo(() => Gesture.Simultaneous(pan, tap), [pan, tap])

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)

  // Подписи оси X — не больше ~7 штук, равномерно
  const xTicks = useMemo(() => {
    const maxTicks = 7
    const step = Math.max(1, Math.ceil(window.length / maxTicks))
    const out: { i: number; label: string }[] = []
    for (let i = 0; i < window.length; i += step) out.push({ i, label: axisLabel(window[i].key, granularity) })
    return out
  }, [window, granularity])

  const showMarkers = window.length <= MARKER_LIMIT
  const range = window.length > 0 ? rangeTitle(window[0].key, window[window.length - 1].key, granularity) : ''

  return (
    <View>
      {/* Текущий видимый диапазон */}
      <Text style={st.rangeLabel}>{range}</Text>

      <GestureDetector gesture={gesture}>
        <View onLayout={onLayout}>
          {width > 0 && (
            <Svg width={width} height={HEIGHT}>
              {/* Сетка и ось Y */}
              {Array.from({ length: GRID_LINES + 1 }, (_, i) => {
                const v = (yMax / GRID_LINES) * i
                const y = yOf(v)
                return (
                  <G key={i}>
                    <Line x1={PAD_L} y1={y} x2={width - PAD_R} y2={y} stroke={C.border} strokeWidth={1} />
                    <SvgText x={PAD_L - 6} y={y + 3} fontSize={9} fill={C.textMuted} textAnchor="end">
                      {Math.round(v)}
                    </SvgText>
                  </G>
                )
              })}
              {/* Подписи оси X */}
              {xTicks.map(t => (
                <SvgText
                  key={t.i}
                  x={xOf(t.i)}
                  y={HEIGHT - 6}
                  fontSize={9}
                  fill={C.textMuted}
                  textAnchor="middle"
                >
                  {t.label}
                </SvgText>
              ))}
              {/* Линии серий */}
              {SERIES_IDS.map(id =>
                polylines[id] ? (
                  <Polyline
                    key={id}
                    points={polylines[id]}
                    fill="none"
                    stroke={SERIES_META[id].color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                ) : null
              )}
              {/* Маркеры */}
              {showMarkers &&
                SERIES_IDS.map(id =>
                  visible[id]
                    ? window.map((p, i) => {
                        const sel = p.key === selectedKey
                        return (
                          <Circle
                            key={`${id}-${p.key}`}
                            cx={xOf(i)}
                            cy={yOf(p[id])}
                            r={sel ? 4.5 : 3}
                            fill={sel ? SERIES_META[id].color : C.card}
                            stroke={SERIES_META[id].color}
                            strokeWidth={1.5}
                          />
                        )
                      })
                    : null
                )}
              {/* Выделение выбранного бакета */}
              {selectedKey &&
                (() => {
                  const i = window.findIndex(p => p.key === selectedKey)
                  if (i < 0) return null
                  return (
                    <Line
                      x1={xOf(i)}
                      y1={PAD_T}
                      x2={xOf(i)}
                      y2={PAD_T + plotH}
                      stroke={C.textMuted}
                      strokeWidth={1}
                      strokeDasharray="3,3"
                    />
                  )
                })()}
            </Svg>
          )}
        </View>
      </GestureDetector>

      <Text style={st.hint}>
        {winCount < n ? 'Свайп влево/вправо — прокрутка по времени · тап по точке — детали' : 'Тап по точке — детали'}
      </Text>
    </View>
  )
}

const st = StyleSheet.create({
  rangeLabel: {
    fontSize: 12, fontWeight: '700', color: C.textSecondary,
    textAlign: 'center', marginBottom: 6, textTransform: 'capitalize',
  },
  hint: { fontSize: 10, color: C.textMuted, marginTop: 6 },
})
