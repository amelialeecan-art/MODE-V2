/* =====================================================================
   Analysis 3-질문 리포트 — raw 에서 계산.
   내부 taxonomy 를 UI 제목으로 노출하지 않는다. 인과 문장 금지.
   ===================================================================== */
import type { RangeRecords } from '@/data/queries/dayQuery'
import { CORE_METRICS, CORE_STATE_META, type CoreMetric } from '@/domain/state/coreState'
import { compareToBaseline } from '@/analysis/day/daySummary'
import { morningEveningSummary } from '@/analysis/temporal/morningEvening'
import { coOccurrence, type CoOccurrenceResult } from '@/analysis/associations/coOccurrence'
import type { MetricDelta } from '@/analysis/baseline/baseline'
import { addDays } from '@/shared/time/time'

export interface RecentChange {
  deltas: MetricDelta[]
  morningEvening: { metric: CoreMetric; avgChange: number; n: number }[]
}

export interface AssociationFinding {
  exposureLabel: string
  metric: CoreMetric
  result: CoOccurrenceResult
}

export interface RecoveryFinding {
  label: string
  betterCount: number
  worseCount: number
  total: number
}

export interface AnalysisReport {
  totalStateDays: number
  recentChange: RecentChange
  associations: AssociationFinding[]
  recovery: RecoveryFinding[]
}

/** exposure 날짜집합이 최소 이 정도는 돼야 비교. */
const MIN_EXPOSURE_DAYS = 3

export function buildAnalysisReport(range: RangeRecords, today: string): AnalysisReport {
  const state = range.state
  const stateDays = new Set(state.map((s) => s.localDate))

  // Q1 — 요즘 뭐가 달라졌지
  const recentFrom = addDays(today, -7)
  const recent = state.filter((s) => s.localDate >= recentFrom)
  const history = state.filter((s) => s.localDate < recentFrom)
  const cmp = compareToBaseline(history, recent)
  const morningEvening = CORE_METRICS
    .map((m) => morningEveningSummary(state, m))
    .filter((s): s is NonNullable<typeof s> => !!s && Math.abs(s.avgChange) >= 0.8)
    .map((s) => ({ metric: s.metric, avgChange: s.avgChange, n: s.n }))
    .sort((a, b) => Math.abs(b.avgChange) - Math.abs(a.avgChange))

  // Q2 — 무엇과 같이 나타났지 (context code 별 co-occurrence, top metric)
  const associations: AssociationFinding[] = []
  const contextByCode = new Map<string, { label: string; dates: Set<string> }>()
  for (const c of range.context) {
    const e = contextByCode.get(c.code) ?? { label: c.label, dates: new Set<string>() }
    e.dates.add(c.localDate)
    contextByCode.set(c.code, e)
  }
  // 수면 부족 노출: durationMinutes < 360(6h)
  const shortSleepDates = new Set(range.sleep.filter((s) => (s.durationMinutes ?? 999) < 360).map((s) => s.localDate))
  const exposures: { label: string; dates: Set<string> }[] = [
    ...[...contextByCode.values()],
    { label: '수면이 짧았던 날(6시간 미만)', dates: shortSleepDates },
  ]

  for (const exp of exposures) {
    if (exp.dates.size < MIN_EXPOSURE_DAYS) continue
    let best: AssociationFinding | null = null
    for (const metric of CORE_METRICS) {
      const r = coOccurrence(state, metric, exp.dates)
      if (!r || r.effect === null || r.effect === 'negligible') continue
      if (!best || Math.abs(r.diff) > Math.abs(best.result.diff)) {
        best = { exposureLabel: exp.label, metric, result: r }
      }
    }
    if (best) associations.push(best)
  }
  associations.sort((a, b) => Math.abs(b.result.diff) - Math.abs(a.result.diff))

  // Q3 — 무엇을 했을 때 달랐지 (회복 행동 효과 집계)
  const recByLabel = new Map<string, RecoveryFinding>()
  for (const r of range.recovery) {
    const f = recByLabel.get(r.label) ?? { label: r.label, betterCount: 0, worseCount: 0, total: 0 }
    f.total += 1
    if (r.effect === 'much_better' || r.effect === 'little_better') f.betterCount += 1
    if (r.effect === 'worse') f.worseCount += 1
    recByLabel.set(r.label, f)
  }
  const recovery = [...recByLabel.values()].filter((f) => f.total >= 3).sort((a, b) => b.total - a.total)

  return {
    totalStateDays: stateDays.size,
    recentChange: { deltas: cmp.deltas.slice(0, 6), morningEvening: morningEvening.slice(0, 4) },
    associations: associations.slice(0, 6),
    recovery: recovery.slice(0, 6),
  }
}

export { CORE_STATE_META }
