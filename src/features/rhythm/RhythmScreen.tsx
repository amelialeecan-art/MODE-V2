import { useMemo, useState } from 'react'
import { Card, Chip, Segmented } from '@/shared/ui/primitives'
import { useData, useAsyncData } from '@/app/DataContext'
import { loadRange } from '@/data/queries/dayQuery'
import { dailyMetricValues } from '@/analysis/associations/coOccurrence'
import { CORE_METRICS, CORE_STATE_META, type CoreMetric } from '@/domain/state/coreState'
import { addDays, daysBetween, todayLocalDate, formatLocalDate } from '@/shared/time/time'

// V1 파스텔 팔레트(라벤더·코랄·민트·스카이)
const SERIES_COLORS = ['#a985e8', '#ff9576', '#5bc79e', '#74a8ec']
const DEFAULT_METRICS: CoreMetric[] = ['craving', 'energy', 'anxiety']

export function RhythmScreen() {
  const { repos, version } = useData()
  const [days, setDays] = useState(30)
  const [selected, setSelected] = useState<CoreMetric[]>(DEFAULT_METRICS)
  const to = todayLocalDate()
  const from = addDays(to, -(days - 1))

  const { data } = useAsyncData(async () => {
    const range = await loadRange(repos, from, to)
    return range
  }, [repos, version, from, to])

  function toggle(m: CoreMetric) {
    setSelected((prev) => {
      if (prev.includes(m)) return prev.filter((x) => x !== m)
      if (prev.length >= 3) return [...prev.slice(1), m]
      return [...prev, m]
    })
  }

  const series = useMemo(() => {
    if (!data) return []
    return selected.map((metric, i) => ({
      metric,
      color: SERIES_COLORS[i % SERIES_COLORS.length],
      points: dailyMetricValues(data.state, metric),
    }))
  }, [data, selected])

  const periodStarts = useMemo(
    () => new Set((data?.cycle ?? []).filter((c) => c.periodStart).map((c) => c.localDate)),
    [data],
  )
  const sleepByDate = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of data?.sleep ?? []) {
      const dur = s.durationMinutes ?? null
      if (dur != null) m.set(s.localDate, dur)
    }
    return m
  }, [data])

  const W = Math.max(320, days * 11)
  const H = 200
  const PAD = { l: 26, r: 8, t: 10, b: 18 }
  const innerW = W - PAD.l - PAD.r
  const innerH = H - PAD.t - PAD.b
  const xOf = (date: string) => PAD.l + (daysBetween(from, date) / Math.max(1, days - 1)) * innerW
  const yOf = (v: number) => PAD.t + (1 - v / 10) * innerH

  return (
    <div className="screen">
      <h1 className="screen__title">〰 리듬</h1>
      <p className="screen__subtitle">고른 지표가 어떻게 같이 움직였는지 봐.</p>

      <div style={{ marginTop: 14, marginBottom: 12 }}>
        <Segmented<string>
          options={[{ value: '14', label: '2주' }, { value: '30', label: '1달' }, { value: '60', label: '2달' }]}
          value={String(days)}
          onChange={(v) => setDays(Number(v))}
        />
      </div>

      <Card>
        <div className="chart-wrap">
          <svg width={W} height={H} role="img" aria-label="지표 시계열">
            {[0, 5, 10].map((g) => (
              <g key={g}>
                <line x1={PAD.l} x2={W - PAD.r} y1={yOf(g)} y2={yOf(g)} stroke="var(--line)" />
                <text x={2} y={yOf(g) + 4} fontSize="10" fill="var(--ink-3)">{g}</text>
              </g>
            ))}
            {/* 생리 시작 세로선 */}
            {[...periodStarts].map((d) => (
              <line key={d} x1={xOf(d)} x2={xOf(d)} y1={PAD.t} y2={H - PAD.b} stroke="#e58bbe" strokeDasharray="3 3" opacity={0.6} />
            ))}
            {/* 수면시간 바(하단, 0~600분 정규화) */}
            {[...sleepByDate].map(([d, mins]) => {
              const h = Math.min(1, mins / 600) * 22
              return <rect key={d} x={xOf(d) - 2} y={H - PAD.b - h} width={4} height={h} fill="#74a8ec" opacity={0.35} />
            })}
            {/* 지표 라인 */}
            {series.map((s) => {
              const pts = [...s.points.entries()].sort((a, b) => a[0].localeCompare(b[0]))
              const path = pts.map(([d, v], idx) => `${idx === 0 ? 'M' : 'L'}${xOf(d).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ')
              return (
                <g key={s.metric}>
                  <path d={path} fill="none" stroke={s.color} strokeWidth={2} />
                  {pts.map(([d, v]) => <circle key={d} cx={xOf(d)} cy={yOf(v)} r={2.5} fill={s.color} />)}
                </g>
              )
            })}
          </svg>
        </div>
        <div className="legend">
          {series.map((s) => (
            <span key={s.metric}><i style={{ background: s.color }} />{CORE_STATE_META[s.metric].label}</span>
          ))}
          {periodStarts.size > 0 && <span><i style={{ background: '#e58bbe' }} />생리 시작</span>}
          {sleepByDate.size > 0 && <span><i style={{ background: '#74a8ec', height: 8 }} />수면시간</span>}
        </div>
        <p className="tiny dim" style={{ marginTop: 6 }}>{formatLocalDate(from)} ~ {formatLocalDate(to)} · 측정한 날만 점으로 표시</p>
      </Card>

      <div className="section-label">지표 고르기 (최대 3개)</div>
      <div className="chips">
        {CORE_METRICS.map((m) => (
          <Chip key={m} active={selected.includes(m)} onClick={() => toggle(m)}>{CORE_STATE_META[m].label}</Chip>
        ))}
      </div>
    </div>
  )
}
