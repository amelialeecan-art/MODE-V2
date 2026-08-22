import { describe, it, expect } from 'vitest'
import type { StateMeasurement, CoreMetricValues } from '@/domain/state/stateMeasurement'
import type { CoreMetric } from '@/domain/state/coreState'
import {
  legacyMetricClass, isDirectSample, isDerivedLegacySample, directSamplesFor,
  derivedLegacySamplesFor, directDayCount, hasSufficientDirect, metricCohort,
  DIRECT_COHORT_MIN_DAYS,
} from '@/analysis/provenance/measurementCohort'
import { metricBaseline } from '@/analysis/baseline/baseline'
import { dailyMetricValues, coOccurrence } from '@/analysis/associations/coOccurrence'

/** 한 metric 짜리 측정치. kind: 'direct'(manual) | 'legacyA'(직접호환) | 'legacyB'(파생). */
function mk(localDate: string, metric: CoreMetric, value: number, kind: 'direct' | 'legacyA' | 'legacyB'): StateMeasurement {
  const metrics: CoreMetricValues = { [metric]: value }
  const base: StateMeasurement = {
    localDate, timezoneOffsetMinutes: 540, schemaVersion: 1,
    recordedAt: `${localDate}T12:00:00.000+09:00`, checkInType: 'evening',
    promptedMetrics: [metric], metrics, source: 'manual', createdAt: '', updatedAt: '',
  }
  if (kind === 'direct') return base
  if (kind === 'legacyA') return { ...base, source: 'legacy_import', conversionVersion: 1 }
  return { ...base, source: 'legacy_import', conversionVersion: 1, conversionRules: { [metric]: 'max(sweet,salty,greasy)' } }
}

function directDays(metric: CoreMetric, n: number, value: number): StateMeasurement[] {
  return Array.from({ length: n }, (_, i) => mk(`2026-07-${String(i + 1).padStart(2, '0')}`, metric, value, 'direct'))
}

describe('metric 3분류 (A direct-compatible / B derived / C incompatible)', () => {
  it('정적 분류가 migration 규칙과 일치한다', () => {
    for (const m of ['moodLow', 'anxiety', 'irritability', 'energy', 'focus', 'impulsivity', 'bingeUrge', 'bloating'] as CoreMetric[])
      expect(legacyMetricClass(m)).toBe('direct_compatible')
    for (const m of ['craving', 'fatigueHeaviness', 'painDiscomfort'] as CoreMetric[])
      expect(legacyMetricClass(m)).toBe('derived_legacy')
    for (const m of ['physicalHunger', 'positiveAffect'] as CoreMetric[])
      expect(legacyMetricClass(m)).toBe('incompatible')
  })

  it('런타임 판별은 conversionRules provenance 로 한다', () => {
    expect(isDerivedLegacySample(mk('2026-07-01', 'craving', 5, 'legacyB'), 'craving')).toBe(true)
    // A형 legacy 는 legacy_import 라도 direct 로 취급
    expect(isDirectSample(mk('2026-07-01', 'moodLow', 5, 'legacyA'), 'moodLow')).toBe(true)
    // 신규 manual 은 당연히 direct
    expect(isDirectSample(mk('2026-07-01', 'craving', 5, 'direct'), 'craving')).toBe(true)
  })
})

describe('direct-compatible legacy(A)는 허용된 분석에 계속 포함된다', () => {
  it('moodLow legacy(A) 8일이면 baseline 코호트에 포함', () => {
    const ms = Array.from({ length: 8 }, (_, i) => mk(`2026-07-${String(i + 1).padStart(2, '0')}`, 'moodLow', 4, 'legacyA'))
    expect(directDayCount(ms, 'moodLow')).toBe(8)
    expect(hasSufficientDirect(ms, 'moodLow')).toBe(true)
    expect(metricBaseline(ms, 'moodLow')?.n).toBe(8)
  })
})

describe('derived legacy(B)는 통계 코호트에서 제외, 그래프 history 엔 유지', () => {
  const derived = Array.from({ length: 5 }, (_, i) => mk(`2026-06-${String(i + 1).padStart(2, '0')}`, 'craving', 9, 'legacyB'))
  const direct = directDays('craving', 3, 2)
  const all = [...derived, ...direct]

  it('그래프 raw history(dailyMetricValues)에는 derived 값이 남는다', () => {
    const g = dailyMetricValues(all, 'craving')
    expect(g.get('2026-06-01')).toBe(9) // derived 값 살아있음
    expect(g.get('2026-07-01')).toBe(2)
    expect(g.size).toBe(8)
  })

  it('directSamplesFor 는 derived 를 제외한다', () => {
    expect(directSamplesFor(all, 'craving')).toHaveLength(3)
    expect(derivedLegacySamplesFor(all, 'craving')).toHaveLength(5)
  })

  it('baseline 은 derived 를 섞지 않고 direct 만으로 계산한다', () => {
    // direct 3개(값 2) → mean 2. derived(값 9)가 섞였다면 mean 이 올라갔을 것.
    expect(metricBaseline(all, 'craving')?.mean).toBe(2)
    expect(metricBaseline(all, 'craving')?.n).toBe(3)
  })

  it('association 도 derived 를 제외하고 계산한다', () => {
    // 노출일 = derived 날짜(6월). direct(7월)만 코호트이므로 present 표본이 없어 null.
    const exposure = new Set(derived.map((d) => d.localDate))
    expect(coOccurrence(all, 'craving', exposure)).toBeNull()
  })
})

describe('7일 임계 — reference vs current 코호트', () => {
  it('direct 6일이면 아직 불충분(참고값 정책), derived 는 reference 로 남는다', () => {
    const ms = [...directDays('craving', 6, 2), ...Array.from({ length: 4 }, (_, i) => mk(`2026-06-0${i + 1}`, 'craving', 8, 'legacyB'))]
    const c = metricCohort(ms, 'craving')
    expect(DIRECT_COHORT_MIN_DAYS).toBe(7)
    expect(c.directDays).toBe(6)
    expect(c.sufficientDirect).toBe(false) // 아직 current 코호트로 충분치 않음
    expect(c.derivedLegacy).toHaveLength(4) // 과거 참고값으로 이용 가능
    // 그래도 baseline 은 direct-only (derived 미포함)
    expect(metricBaseline(ms, 'craving')?.mean).toBe(2)
  })

  it('direct 7일 이상이면 충분, current baseline 은 direct-only', () => {
    const ms = [...directDays('craving', 7, 2), ...Array.from({ length: 4 }, (_, i) => mk(`2026-06-0${i + 1}`, 'craving', 8, 'legacyB'))]
    const c = metricCohort(ms, 'craving')
    expect(c.directDays).toBe(7)
    expect(c.sufficientDirect).toBe(true)
    // derived(값 8) 4개가 있어도 baseline 은 direct(값 2)만 → mean 2, n 7
    const base = metricBaseline(ms, 'craving')!
    expect(base.mean).toBe(2)
    expect(base.n).toBe(7)
  })
})
