import { useMemo, useState } from 'react'
import { GlassCard, SectionHeader } from '@/design'
import { useData, useAsyncData } from '@/app/DataContext'
import { loadRange } from '@/data/queries/dayQuery'
import { dailyMetricValues } from '@/analysis/associations/coOccurrence'
import { deriveSleep } from '@/analysis/sleep/deriveSleep'
import { CORE_METRICS, CORE_STATE_META, type CoreMetric } from '@/domain/state/coreState'
import type { CycleRecord } from '@/domain/cycle/cycleRecord'
import { addDays, daysBetween, todayLocalDate, formatLocalDate } from '@/shared/time/time'
import './rhythm.css'

// 자주 보는 지표(기본 노출). 나머지는 "모든 지표"에서 선택.
const COMMON_METRICS: CoreMetric[] = ['moodLow', 'positiveAffect', 'anxiety', 'energy', 'craving', 'fatigueHeaviness', 'focus']
const REST_METRICS: CoreMetric[] = CORE_METRICS.filter((m) => !COMMON_METRICS.includes(m))
const DEFAULT_SELECTED: CoreMetric[] = ['moodLow', 'energy', 'anxiety']
const SERIES_COLORS = ['#a985e8', '#ff9576', '#46bbb0'] // 라벤더 · 코랄 · 틸
const MAX_SELECTED = 3

const RANGES = [
  { key: 14, label: '2주' },
  { key: 30, label: '1달' },
  { key: 60, label: '2달' },
]

/** 실제 관측된 출혈 기간 날짜 집합(예측 없음): flow/시작/종료 기록일 + 시작→종료 사이. */
function bleedingDateSet(cycle: CycleRecord[]): Set<string> {
  const set = new Set<string>()
  for (const c of cycle) {
    const hasFlow = !!c.flowLevel && c.flowLevel !== 'unknown'
    if (c.periodStart || c.periodEnd || hasFlow) set.add(c.localDate)
  }
  const starts = cycle.filter((c) => c.periodStart).map((c) => c.localDate).sort()
  const ends = cycle.filter((c) => c.periodEnd).map((c) => c.localDate).sort()
  for (const s of starts) {
    const end = ends.find((e) => e >= s && daysBetween(s, e) <= 12)
    if (end) for (let d = s; d <= end; d = addDays(d, 1)) set.add(d)
  }
  return set
}

const shortDate = (iso: string) => {
  const [, m, d] = iso.split('-')
  return `${Number(m)}/${Number(d)}`
}

export function RhythmScreen() {
  const { repos, version } = useData()
  const [days, setDays] = useState(30)
  const [selected, setSelected] = useState<CoreMetric[]>(DEFAULT_SELECTED)
  const [showAll, setShowAll] = useState(false)
  const to = todayLocalDate()
  const from = addDays(to, -(days - 1))

  const { data } = useAsyncData(async () => loadRange(repos, from, to), [repos, version, from, to])

  function toggle(m: CoreMetric) {
    setSelected((prev) => {
      if (prev.includes(m)) return prev.length === 1 ? prev : prev.filter((x) => x !== m)
      if (prev.length >= MAX_SELECTED) return [...prev.slice(1), m]
      return [...prev, m]
    })
  }
  const colorOf = (m: CoreMetric) => SERIES_COLORS[selected.indexOf(m) % SERIES_COLORS.length]

  const series = useMemo(() => {
    if (!data) return []
    return selected.map((metric) => ({
      metric,
      color: colorOf(metric),
      points: [...dailyMetricValues(data.state, metric).entries()].sort((a, b) => a[0].localeCompare(b[0])),
    }))
  }, [data, selected])

  const bleeding = useMemo(() => bleedingDateSet(data?.cycle ?? []), [data])
  const sleepByDate = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of data?.sleep ?? []) {
      const dur = deriveSleep(s).sleepDuration // timestamp 기반, 없으면 duration fallback
      if (dur != null) m.set(s.localDate, dur)
    }
    return m
  }, [data])

  // ── 차트 좌표계 (viewBox, 컨테이너 폭에 맞춤) ──
  const W = 340, padL = 22, padR = 10, padTop = 12
  const stateH = 116, gap = 14, sleepH = 44, xAxisH = 18
  const stateTop = padTop, stateBottom = stateTop + stateH
  const sleepTop = stateBottom + gap, sleepBottom = sleepTop + sleepH
  const H = sleepBottom + xAxisH
  const innerW = W - padL - padR
  const n = Math.max(1, days)
  const cell = innerW / Math.max(1, n - 1)
  const xOf = (iso: string) => padL + (daysBetween(from, iso) / Math.max(1, n - 1)) * innerW
  const stateY = (v: number) => stateTop + (1 - v / 10) * stateH
  const SLEEP_MAX = 720 // 12h
  const sleepBarTop = (mins: number) => sleepBottom - (Math.min(mins, SLEEP_MAX) / SLEEP_MAX) * sleepH

  const xTicks = useMemo(() => {
    const count = Math.min(6, n)
    const out: { iso: string; x: number }[] = []
    for (let i = 0; i < count; i++) {
      const di = Math.round((i * (n - 1)) / Math.max(1, count - 1))
      const iso = addDays(from, di)
      out.push({ iso, x: xOf(iso) })
    }
    return out
  }, [from, n])

  const hasAnyState = series.some((s) => s.points.length > 0)

  return (
    <div className="screen">
      <header className="screen-head">
        <h1 className="screen-head__title">리듬</h1>
        <p className="screen-head__sub">고른 지표가 수면·생리와 어떻게 같이 움직였는지 봐.</p>
      </header>

      {/* 기간 */}
      <div className="rhythm-tabs" role="tablist" aria-label="기간 선택">
        {RANGES.map((r) => (
          <button key={r.key} role="tab" aria-selected={r.key === days}
            className={`rhythm-tab${r.key === days ? ' rhythm-tab--on' : ''}`} onClick={() => setDays(r.key)}>
            {r.label}
          </button>
        ))}
      </div>

      <GlassCard>
        {!data ? (
          <p className="rhythm-empty">불러오는 중…</p>
        ) : !hasAnyState && bleeding.size === 0 && sleepByDate.size === 0 ? (
          <p className="rhythm-empty">아직 흐름을 그리기엔 기록이 부족해. 며칠 더 쌓이면 여기 선으로 보여줄게.</p>
        ) : (
          <>
            <div className="rhythm-wrap">
              <svg className="rhythm" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="상태·수면·생리 리듬">
                {/* 생리 출혈 밴드 (두 lane 관통) */}
                {[...bleeding].filter((d) => d >= from && d <= to).map((d) => (
                  <rect key={`b-${d}`} x={xOf(d) - cell / 2} y={stateTop} width={cell} height={sleepBottom - stateTop}
                    fill="#e58bbe" opacity={0.16} />
                ))}

                {/* 상태 lane: 0/5/10 격자 */}
                {[0, 5, 10].map((g) => (
                  <g key={g}>
                    <line x1={padL} x2={W - padR} y1={stateY(g)} y2={stateY(g)} stroke="var(--line)" strokeWidth={1} />
                    <text x={padL - 4} y={stateY(g) + 3} textAnchor="end" className="rhythm-y-t">{g}</text>
                  </g>
                ))}
                <text x={padL} y={stateTop - 3} className="rhythm-lane-t">상태 0~10</text>

                {/* 상태 지표: 점+선 (측정한 날만) */}
                {series.map((s) => {
                  const path = s.points.map(([d, v], i) => `${i === 0 ? 'M' : 'L'}${xOf(d).toFixed(1)},${stateY(v).toFixed(1)}`).join(' ')
                  return (
                    <g key={s.metric}>
                      {s.points.length > 1 && <path d={path} fill="none" stroke={s.color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />}
                      {s.points.map(([d, v]) => <circle key={d} cx={xOf(d)} cy={stateY(v)} r={2.6} fill={s.color} />)}
                    </g>
                  )
                })}

                {/* 수면 lane: 시간 막대 (0~12h) */}
                <line x1={padL} x2={W - padR} y1={sleepBottom} y2={sleepBottom} stroke="var(--line)" strokeWidth={1} />
                <line x1={padL} x2={W - padR} y1={sleepTop} y2={sleepTop} stroke="var(--line)" strokeWidth={1} strokeDasharray="2 3" opacity={0.6} />
                <text x={padL} y={sleepTop - 3} className="rhythm-lane-t">수면 시간</text>
                <text x={padL - 4} y={sleepTop + 4} textAnchor="end" className="rhythm-y-t">12h</text>
                <text x={padL - 4} y={sleepBottom + 1} textAnchor="end" className="rhythm-y-t">0</text>
                {[...sleepByDate].filter(([d]) => d >= from && d <= to).map(([d, mins]) => {
                  const top = sleepBarTop(mins)
                  const w = Math.max(2.5, cell * 0.6)
                  return <rect key={`s-${d}`} x={xOf(d) - w / 2} y={top} width={w} height={sleepBottom - top} rx={1.3} fill="#74a8ec" opacity={0.8} />
                })}

                {/* x축 날짜 */}
                {xTicks.map((t) => (
                  <text key={`x-${t.iso}`} x={t.x} y={H - 5} textAnchor="middle" className="rhythm-x-t">{shortDate(t.iso)}</text>
                ))}
              </svg>
            </div>

            <div className="rhythm-legend">
              {series.map((s) => (
                <span key={s.metric}><i className="dot" style={{ background: s.color }} />{CORE_STATE_META[s.metric].label}</span>
              ))}
              {sleepByDate.size > 0 && <span><i className="bar" />수면 시간</span>}
              {bleeding.size > 0 && <span><i className="band" />생리(출혈 기간)</span>}
            </div>
            <p className="rhythm-range-note">{formatLocalDate(from)} ~ {formatLocalDate(to)} · 측정한 날만 표시</p>
          </>
        )}
      </GlassCard>

      {/* 지표 고르기 */}
      <GlassCard>
        <SectionHeader title="지표 고르기" subtitle={`한 번에 최대 ${MAX_SELECTED}개까지 겹쳐 봐`} />
        <p className="rhythm-pick-label">자주 보는 지표</p>
        <div className="rhythm-metrics" role="group" aria-label="자주 보는 지표">
          {COMMON_METRICS.map((m) => {
            const on = selected.includes(m)
            return (
              <button key={m} aria-pressed={on}
                className={`rhythm-metric${on ? ' rhythm-metric--on' : ''}`}
                style={on ? { borderColor: colorOf(m), color: colorOf(m) } : undefined}
                onClick={() => toggle(m)}>
                <span className="rhythm-metric__dot" style={{ background: on ? colorOf(m) : 'var(--ink-3)' }} />
                {CORE_STATE_META[m].label}
              </button>
            )
          })}
        </div>

        {!showAll ? (
          <button className="rhythm-allmetrics-toggle" onClick={() => setShowAll(true)}>모든 지표 ▾</button>
        ) : (
          <>
            <p className="rhythm-pick-label">모든 지표</p>
            <div className="rhythm-metrics" role="group" aria-label="모든 지표">
              {REST_METRICS.map((m) => {
                const on = selected.includes(m)
                return (
                  <button key={m} aria-pressed={on}
                    className={`rhythm-metric${on ? ' rhythm-metric--on' : ''}`}
                    style={on ? { borderColor: colorOf(m), color: colorOf(m) } : undefined}
                    onClick={() => toggle(m)}>
                    <span className="rhythm-metric__dot" style={{ background: on ? colorOf(m) : 'var(--ink-3)' }} />
                    {CORE_STATE_META[m].label}
                  </button>
                )
              })}
            </div>
            <button className="rhythm-allmetrics-toggle" onClick={() => setShowAll(false)}>접기 ▴</button>
          </>
        )}
      </GlassCard>
    </div>
  )
}
