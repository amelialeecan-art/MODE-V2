/* =====================================================================
   측정 provenance 코호트 — 분석에서 "직접 측정" 과 "legacy 파생 근사값" 을 구분.
   화면마다 재구현하지 않도록 판별을 여기 한 곳에 모은다.

   metric 세 종류(§migration):
   - A. direct-compatible legacy : 기존 질문 = 신규 질문 의미 동일, 필드→필드 직접 변환.
        moodLow, anxiety, irritability, energy, focus, impulsivity, bingeUrge, bloating
        → 신규 직접측정과 같은 코호트로 사용 가능.
   - B. derived legacy approximation : 다른 legacy 변수에서 공식(max)으로 생성.
        craving, fatigueHeaviness, painDiscomfort
        → 현재 통계 코호트로 취급하지 않는다. 과거 그래프/참고값으로만.
   - C. incompatible : 애초에 migration 하지 않음(physicalHunger, positiveAffect).

   런타임 판별은 하드코딩 목록이 아니라 record 의 conversionRules provenance 로 한다:
   같은 measurement 라도 metric 별로 direct/derived 가 다를 수 있으므로 metric 단위로 본다.
   ===================================================================== */
import { isNumericRating } from '@/domain/common/types'
import type { CoreMetric } from '@/domain/state/coreState'
import type { StateMeasurement } from '@/domain/state/stateMeasurement'

/** 문서화/테스트용 — 런타임 판별은 conversionRules provenance 로 한다. */
export type MetricClass = 'direct_compatible' | 'derived_legacy' | 'incompatible'
export const DIRECT_COMPATIBLE_LEGACY_METRICS: CoreMetric[] = [
  'moodLow', 'anxiety', 'irritability', 'energy', 'focus', 'impulsivity', 'bingeUrge', 'bloating',
]
export const DERIVED_LEGACY_METRICS: CoreMetric[] = ['craving', 'fatigueHeaviness', 'painDiscomfort']
export const INCOMPATIBLE_LEGACY_METRICS: CoreMetric[] = ['physicalHunger', 'positiveAffect']

/** legacy 변환이 direct 였는지/파생이었는지 정적 분류(문서·표시용). */
export function legacyMetricClass(metric: CoreMetric): MetricClass {
  if (DERIVED_LEGACY_METRICS.includes(metric)) return 'derived_legacy'
  if (INCOMPATIBLE_LEGACY_METRICS.includes(metric)) return 'incompatible'
  return 'direct_compatible'
}

/** 신규 직접측정이 현재 분석에 충분하다고 볼 최소 '일수'. */
export const DIRECT_COHORT_MIN_DAYS = 7

/** 이 측정치의 metric 값이 legacy 파생 근사값(B)인가. */
export function isDerivedLegacySample(m: StateMeasurement, metric: CoreMetric): boolean {
  return m.source === 'legacy_import' && m.conversionRules?.[metric] !== undefined
}

/**
 * 이 측정치의 metric 값이 '직접 측정' 계열인가.
 * = 신규 직접측정(manual/import) 또는 A형 direct-compatible legacy.
 * derived legacy(B) 만 false.
 */
export function isDirectSample(m: StateMeasurement, metric: CoreMetric): boolean {
  return !isDerivedLegacySample(m, metric)
}

/** metric 에 대해 '직접 측정' 계열 측정치만. → current 통계 코호트. */
export function directSamplesFor(measurements: StateMeasurement[], metric: CoreMetric): StateMeasurement[] {
  return measurements.filter((m) => isDirectSample(m, metric))
}

/** metric 에 대해 derived-legacy(B) 측정치만. → 과거 참고값(그래프/reference). */
export function derivedLegacySamplesFor(measurements: StateMeasurement[], metric: CoreMetric): StateMeasurement[] {
  return measurements.filter((m) => isDerivedLegacySample(m, metric))
}

/** metric 에 실제 수치가 있는 '직접 측정' 고유 날짜 수. */
export function directDayCount(measurements: StateMeasurement[], metric: CoreMetric): number {
  const days = new Set<string>()
  for (const m of measurements) {
    if (isDirectSample(m, metric) && isNumericRating(m.metrics[metric])) days.add(m.localDate)
  }
  return days.size
}

/** 직접측정이 현재 분석 코호트로 쓰기에 충분한가(>= DIRECT_COHORT_MIN_DAYS 일). */
export function hasSufficientDirect(measurements: StateMeasurement[], metric: CoreMetric): boolean {
  return directDayCount(measurements, metric) >= DIRECT_COHORT_MIN_DAYS
}

export interface MetricCohort {
  metric: CoreMetric
  /** 현재 통계에 쓰는 직접측정 계열. */
  direct: StateMeasurement[]
  /** 과거 참고값(그래프/reference)으로만 쓰는 파생 legacy. 통계 병합 금지. */
  derivedLegacy: StateMeasurement[]
  directDays: number
  sufficientDirect: boolean
}

/**
 * metric 의 측정 코호트를 분리한다.
 * 규칙(§분석): derived legacy 는 direct 와 하나의 연속 측정계열로 통계 처리하지 않는다.
 * 직접측정이 7일 미만이면 derivedLegacy 를 '과거 참고값' 으로 별도 노출할 수 있다.
 */
export function metricCohort(measurements: StateMeasurement[], metric: CoreMetric): MetricCohort {
  const direct = directSamplesFor(measurements, metric)
  const derivedLegacy = derivedLegacySamplesFor(measurements, metric)
  const directDays = directDayCount(measurements, metric)
  return { metric, direct, derivedLegacy, directDays, sufficientDirect: directDays >= DIRECT_COHORT_MIN_DAYS }
}
