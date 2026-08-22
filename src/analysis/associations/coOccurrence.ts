/* =====================================================================
   함께 나타남(association) — "X 가 있던 날 Y 가 평소보다 높았음".
   - 관찰 데이터: 인과 문장("X 가 Y 를 만들었다") 금지. 함께 나타나는 경향만.
   - 시각이 없으면(legacy/occurredAt null) 전후관계를 만들지 않는다 → 같은 날 비교만.
   ===================================================================== */
import type { CoreMetric } from '@/domain/state/coreState'
import type { StateMeasurement } from '@/domain/state/stateMeasurement'
import { isNumericRating } from '@/domain/common/types'
import { mean, cohensD, effectSizeBand, round1 } from '@/shared/statistics/stats'
import { directSamplesFor } from '@/analysis/provenance/measurementCohort'

/**
 * 날짜별 대표 metric 값(그 날 측정 평균). provenance 무관 — **raw history 열람용**.
 * Rhythm 그래프가 이 함수를 쓰므로 derived legacy 값도 사라지지 않는다.
 * 통계(association 등)는 directSamplesFor 로 걸러 direct-only 로 계산한다.
 */
export function dailyMetricValues(measurements: StateMeasurement[], metric: CoreMetric): Map<string, number> {
  const byDate = new Map<string, number[]>()
  for (const m of measurements) {
    const v = m.metrics[metric]
    if (!isNumericRating(v)) continue
    const arr = byDate.get(m.localDate) ?? []
    arr.push(v)
    byDate.set(m.localDate, arr)
  }
  const out = new Map<string, number>()
  for (const [d, arr] of byDate) out.set(d, mean(arr))
  return out
}

export interface CoOccurrenceResult {
  metric: CoreMetric
  exposureDates: number
  presentMean: number // 노출 있던 날 평균
  absentMean: number // 없던 날 평균
  diff: number // present - absent
  effect: 'negligible' | 'small' | 'moderate' | 'large' | null
  nPresent: number
  nAbsent: number
}

/**
 * exposureDates(어떤 사건/노출이 있던 날짜 집합) 대비, metric 이 평소보다 높았는지.
 * 같은 날 비교만(순서 없음). 표본이 적으면 effect=null.
 */
export function coOccurrence(
  measurements: StateMeasurement[],
  metric: CoreMetric,
  exposureDates: Set<string>,
): CoOccurrenceResult | null {
  // 통계 코호트는 직접측정만 — 파생 근사값은 association 에 넣지 않는다.
  const daily = dailyMetricValues(directSamplesFor(measurements, metric), metric)
  const present: number[] = []
  const absent: number[] = []
  for (const [date, val] of daily) {
    if (exposureDates.has(date)) present.push(val)
    else absent.push(val)
  }
  if (present.length === 0 || absent.length === 0) return null
  const presentMean = mean(present)
  const absentMean = mean(absent)
  const d = cohensD(present, absent)
  return {
    metric,
    exposureDates: exposureDates.size,
    presentMean: round1(presentMean),
    absentMean: round1(absentMean),
    diff: round1(presentMean - absentMean),
    effect: d == null ? null : effectSizeBand(d),
    nPresent: present.length,
    nAbsent: absent.length,
  }
}
