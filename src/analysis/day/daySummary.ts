/* =====================================================================
   하루 요약(파생) — raw 에서 계산. 저장하지 않는다.
   하나의 "오늘 점수/유형"으로 압축하지 않는다: metric 단위로 유지.
   ===================================================================== */
import { CORE_METRICS, CORE_STATE_META, type CoreMetric } from '@/domain/state/coreState'
import type { StateMeasurement } from '@/domain/state/stateMeasurement'
import type { RatingValue } from '@/domain/common/types'
import { isNumericRating } from '@/domain/common/types'
import type { DayRecords } from '@/data/queries/dayQuery'
import { deriveSleep } from '@/analysis/sleep/deriveSleep'
import type { SleepDerived } from '@/domain/sleep/sleepEpisode'
import { deltaFromBaseline, type MetricDelta } from '@/analysis/baseline/baseline'

export type Level = 'none' | 'low' | 'mid' | 'high' | 'veryHigh'

/** 0~10 → 정성 레벨(방향 무관 크기). */
export function levelOf(value: number): Level {
  if (value <= 1) return 'none'
  if (value <= 3) return 'low'
  if (value <= 6) return 'mid'
  if (value <= 8) return 'high'
  return 'veryHigh'
}

export interface DayMetricValue {
  metric: CoreMetric
  value: RatingValue
  level: Level | null // 수치일 때만
  from: 'evening' | 'morning' | 'adhoc'
}

/** 그날의 대표 상태값(evening 우선 → morning → 최근 adhoc). */
export function pickDayState(records: DayRecords): DayMetricValue[] {
  const evening = records.state.find((s) => s.checkInType === 'evening')
  const morning = records.state.find((s) => s.checkInType === 'morning')
  const adhoc = [...records.state].filter((s) => s.checkInType === 'adhoc').sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0]

  const out: DayMetricValue[] = []
  for (const metric of CORE_METRICS) {
    let value: RatingValue | undefined
    let from: DayMetricValue['from'] | undefined
    if (evening && metric in evening.metrics) { value = evening.metrics[metric]; from = 'evening' }
    else if (morning && metric in morning.metrics) { value = morning.metrics[metric]; from = 'morning' }
    else if (adhoc && metric in adhoc.metrics) { value = adhoc.metrics[metric]; from = 'adhoc' }
    if (from === undefined || value === undefined) continue // 안 물어봄(missing) → 스킵
    out.push({ metric, value, level: isNumericRating(value) ? levelOf(value) : null, from })
  }
  return out
}

export interface DaySummary {
  localDate: string
  hasAnyState: boolean
  metrics: DayMetricValue[]
  sleep: SleepDerived | null
  sleepSatisfaction: RatingValue | null
  mealCount: number
  contextLabels: string[]
  hadPeriod: boolean
}

export function summarizeDay(records: DayRecords): DaySummary {
  const metrics = pickDayState(records)
  const latestSleep = records.sleep[0] ?? null
  return {
    localDate: records.localDate,
    hasAnyState: metrics.length > 0,
    metrics,
    sleep: latestSleep ? deriveSleep(latestSleep) : null,
    sleepSatisfaction: latestSleep?.satisfaction ?? null,
    mealCount: records.meals.length,
    contextLabels: records.context.map((c) => c.label),
    hadPeriod: records.cycle.some((c) => c.periodStart || c.flowLevel),
  }
}

/** "평소와 비교" — 최근 N일 delta. 최근을 제외한 과거를 baseline 으로. */
export interface BaselineComparison {
  deltas: MetricDelta[]
}

export function compareToBaseline(
  history: StateMeasurement[],
  recent: StateMeasurement[],
  metrics: CoreMetric[] = [...CORE_METRICS],
): BaselineComparison {
  const deltas: MetricDelta[] = []
  for (const metric of metrics) {
    const d = deltaFromBaseline(history, recent, metric)
    if (d && Math.abs(d.delta) >= 0.1) deltas.push(d)
  }
  deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  return { deltas }
}

export { CORE_STATE_META }
