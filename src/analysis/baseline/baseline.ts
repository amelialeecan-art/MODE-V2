/* =====================================================================
   개인 baseline — metric 별 평균/표준편차. "평소보다 +2.1" 의 근거.
   - 오직 실제 수치(number)만 사용. 'unknown'/missing 은 제외(0 으로 안 채움).
   - 합성점수를 만들지 않는다: metric 단위로만.
   ===================================================================== */
import type { CoreMetric } from '@/domain/state/coreState'
import type { RatingValue } from '@/domain/common/types'
import type { StateMeasurement } from '@/domain/state/stateMeasurement'
import { isNumericRating } from '@/domain/common/types'
import { mean, stdev, round1 } from '@/shared/statistics/stats'
import { directSamplesFor } from '@/analysis/provenance/measurementCohort'

export interface MetricBaseline {
  metric: CoreMetric
  mean: number
  sd: number
  n: number
}

/** measurements 에서 metric 의 실제 수치만 뽑는다(provenance 무관, 값 추출용). */
export function numericSamples(measurements: StateMeasurement[], metric: CoreMetric): number[] {
  const out: number[] = []
  for (const m of measurements) {
    const v: RatingValue | undefined = m.metrics[metric]
    if (isNumericRating(v)) out.push(v)
  }
  return out
}

/**
 * personal baseline — 현재 통계 코호트는 **직접 측정만** 사용한다.
 * legacy 파생 근사값(B: craving/fatigueHeaviness/painDiscomfort 의 max 변환)은
 * 직접측정과 하나의 측정계열로 섞지 않는다(§분석 규칙 5).
 */
export function metricBaseline(measurements: StateMeasurement[], metric: CoreMetric): MetricBaseline | null {
  const xs = numericSamples(directSamplesFor(measurements, metric), metric)
  if (xs.length < 2) return null
  return { metric, mean: mean(xs), sd: stdev(xs), n: xs.length }
}

export interface MetricDelta {
  metric: CoreMetric
  value: number
  baselineMean: number
  delta: number // value - baselineMean
  n: number
}

/**
 * 최근 값이 baseline 대비 얼마나 벗어났는지.
 * baseline 은 recent 를 제외한 과거로 계산(자기 자신에 회귀 방지).
 */
export function deltaFromBaseline(
  history: StateMeasurement[],
  recent: StateMeasurement[],
  metric: CoreMetric,
): MetricDelta | null {
  const base = metricBaseline(history, metric)
  if (!base) return null
  // 최근값도 직접측정만 — 파생 근사값을 현재값으로 쓰지 않는다.
  const recentXs = numericSamples(directSamplesFor(recent, metric), metric)
  if (recentXs.length === 0) return null
  const value = mean(recentXs)
  return {
    metric,
    value: round1(value),
    baselineMean: round1(base.mean),
    delta: round1(value - base.mean),
    n: base.n,
  }
}
