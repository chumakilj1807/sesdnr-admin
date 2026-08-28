import { useEffect, useMemo, useRef, useState } from 'react'
import { LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Svg, { Circle, G, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import { Feather } from '@expo/vector-icons'
import { C } from '@/constants/Colors'
import { axisLabel, type Granularity, type SeriesId, type SeriesPoint } from '@/lib/statsSeries'

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
const MIN_DAY_WINDOW = 7 // минимум видимых дней при максимальном зуме
const DEFAULT_DAY_WINDOW = 14
const MARKER_LIMIT = 45 // больше точек в окне — маркеры не рисуем

interface Props {
  points: SeriesPoint[]
  granularity: Granularity
  visible: Record<SeriesId, boolean>
  selectedKey: string | null
  onSelect: (key: string) => void
  // В обзорном (месячном) режиме щипок на увеличение — просьба перейти на дни
  onZoomToDays?: () => void
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
  onZoomToDays,
}: Props) {
  const [width, setWidth] = useState(0)
  // Окно просмотра: count — сколько точек видно, end — индекс правой точки
  const [winCount, setWinCount] = useState(points.length)
  const [winEnd, setWinEnd] = useState(points.length - 1)

  const n = points.length

  // При смене набора данных — дефолтное окно
  useEffect(() => {
    if (granularity === 'month') {
      setWinCount(n)
      setWinEnd(n - 1)
    } else {
      setWinCount(Math.min(DEFAULT_DAY_WINDOW, n))
      setWinEnd(n - 1)
    }
  }, [granularity, n])

  // Рефы для колбэков жестов (worklets видят актуальные значения)
  const stateRef = useRef({ winCount, winEnd, n, granularity })
  stateRef.current = { winCount, winEnd, n, granularity }
  const baseCount = useRef(winCount)
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

  // ── Жесты ─────────────────────────────────────────────────────────────────
  const applyPinch = (scale: number) => {
    const st = stateRef.current
    if (st.granularity !== 'day') return // в месячном режиме зума окна нет — только переход на дни
    const next = Math.round(baseCount.current / scale)
    const clamped = Math.max(MIN_DAY_WINDOW, Math.min(st.n, next))
    setWinCount(clamped)
    setWinEnd(e => Math.min(st.n - 1, Math.max(clamped - 1, e)))
  }

  const applyPan = (tx: number) => {
    const st = stateRef.current
    if (st.granularity !== 'day' || spacing <= 0) return
    const shift = Math.round(-tx / spacing)
    const next = baseEnd.current + shift
    setWinEnd(Math.min(st.n - 1, Math.max(st.winCount - 1, next)))
  }

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .onStart(() => {
          baseCount.current = stateRef.current.winCount
        })
        .onUpdate(e => {
          runOnJS(applyPinch)(e.scale)
        })
        .onEnd(e => {
          if (
            stateRef.current.granularity === 'month' &&
            e.scale > 1.25 &&
            onZoomToDays
          ) {
            runOnJS(onZoomToDays)()
          }
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spacing, onZoomToDays]
  )

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

  const gesture = useMemo(() => Gesture.Simultaneous(pinch, pan, tap), [pinch, pan, tap])

  const resetWindow = () => {
    if (granularity === 'month') {
      setWinCount(n)
      setWinEnd(n - 1)
    } else {
      setWinCount(Math.min(DEFAULT_DAY_WINDOW, n))
      setWinEnd(n - 1)
    }
  }

  const isDefaultWindow =
    granularity === 'month'
      ? winCount === n && winEnd === n - 1
      : winCount === Math.min(DEFAULT_DAY_WINDOW, n) && winEnd === n - 1

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

  return (
    <View>
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
              {/* Прозрачная зона захвата жестов */}
              <Rect x={0} y={0} width={width} height={HEIGHT} fill="transparent" />
            </Svg>
          )}
        </View>
      </GestureDetector>

      {/* Подсказка + сброс масштаба */}
      <View style={st.hintRow}>
        <Text style={st.hint}>
          {granularity === 'month'
            ? 'Разведите пальцы — переход к дням · тап по точке — детали'
            : 'Щипок — масштаб · свайп — прокрутка · тап по точке — детали'}
        </Text>
        {!isDefaultWindow && (
          <TouchableOpacity style={st.resetBtn} onPress={resetWindow} activeOpacity={0.7}>
            <Feather name="maximize" size={11} color={C.textSecondary} />
            <Text style={st.resetText}>Сброс</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const st = StyleSheet.create({
  hintRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
  hint: { flex: 1, fontSize: 10, color: C.textMuted },
  resetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
    backgroundColor: '#0d1420', borderWidth: 1, borderColor: C.border,
  },
  resetText: { fontSize: 10, fontWeight: '600', color: C.textSecondary },
})
