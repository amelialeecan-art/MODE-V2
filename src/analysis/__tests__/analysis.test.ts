import { describe, it, expect } from 'vitest'
import { deltaFromBaseline } from '@/analysis/baseline/baseline'
import { morningEveningSummary } from '@/analysis/temporal/morningEvening'
import { coOccurrence } from '@/analysis/associations/coOccurrence'
import { deriveSleep } from '@/analysis/sleep/deriveSleep'
import type { StateMeasurement } from '@/domain/state/stateMeasurement'
import type { SleepEpisode } from '@/domain/sleep/sleepEpisode'
import type { CoreMetricValues } from '@/domain/state/stateMeasurement'

let seq = 0
function sm(localDate: string, metrics: CoreMetricValues, opts: Partial<StateMeasurement> = {}): StateMeasurement {
  return {
    localDate, timezoneOffsetMinutes: 540, source: 'manual', schemaVersion: 1,
    recordedAt: `${localDate}T21:00:00+09:00`, checkInType: 'evening',
    promptedMetrics: Object.keys(metrics) as never, metrics,
    createdAt: '', updatedAt: '', id: ++seq, ...opts,
  }
}

describe('baseline delta — 평소보다 +/-', () => {
  it('과거 대비 최근 값의 delta 를 계산', () => {
    const history = [sm('2026-07-01', { energy: 5 }), sm('2026-07-02', { energy: 5 }), sm('2026-07-03', { energy: 5 })]
    const recent = [sm('2026-07-10', { energy: 8 })]
    const d = deltaFromBaseline(history, recent, 'energy')!
    expect(d.baselineMean).toBe(5)
    expect(d.value).toBe(8)
    expect(d.delta).toBe(3)
  })

  it("'unknown'/missing 은 baseline 에서 제외(0 으로 안 채움)", () => {
    const history = [sm('a', { energy: 6 }), sm('b', { energy: 'unknown' }), sm('c', {})]
    // 수치 표본이 1개뿐 → baseline 불가(n<2)
    expect(deltaFromBaseline(history, [sm('d', { energy: 8 })], 'energy')).toBeNull()
  })
})

describe('morning→evening — legacy 제외(시각 신뢰 불가)', () => {
  it('시각 있는 manual 쌍만 사용', () => {
    const ms = [
      sm('2026-07-01', { anxiety: 2 }, { checkInType: 'morning' }),
      sm('2026-07-01', { anxiety: 6 }, { checkInType: 'evening' }),
      sm('2026-07-02', { anxiety: 3 }, { checkInType: 'morning' }),
      sm('2026-07-02', { anxiety: 5 }, { checkInType: 'evening' }),
      // legacy 는 무시돼야 함
      sm('2026-07-03', { anxiety: 9 }, { checkInType: 'morning', source: 'legacy_import' }),
      sm('2026-07-03', { anxiety: 0 }, { checkInType: 'evening', source: 'legacy_import' }),
    ]
    const s = morningEveningSummary(ms, 'anxiety')!
    expect(s.n).toBe(2) // legacy 쌍 제외
    expect(s.avgChange).toBe(3) // (+4, +2) 평균
  })
})

describe('co-occurrence — 같은 날 비교(순서 없음)', () => {
  it('노출 있던 날 vs 없던 날 metric 평균차', () => {
    const ms = [
      sm('2026-07-01', { moodLow: 8 }), sm('2026-07-02', { moodLow: 7 }),
      sm('2026-07-03', { moodLow: 2 }), sm('2026-07-04', { moodLow: 3 }),
    ]
    const exposure = new Set(['2026-07-01', '2026-07-02'])
    const r = coOccurrence(ms, 'moodLow', exposure)!
    expect(r.presentMean).toBe(7.5)
    expect(r.absentMean).toBe(2.5)
    expect(r.diff).toBe(5)
  })
})

describe('sleep derive — 가짜 timestamp 안 만듦', () => {
  const base = { localDate: '2026-07-01', timezoneOffsetMinutes: 540, source: 'legacy_import' as const, schemaVersion: 1, createdAt: '', updatedAt: '' }
  it('legacy duration 만 있으면 duration 만 반환', () => {
    const ep: SleepEpisode = { ...base, wentToBedAt: null, sleepOnsetAt: null, wakeAt: null, durationMinutes: 480 }
    const d = deriveSleep(ep)
    expect(d.sleepDuration).toBe(480)
    expect(d.timeInBed).toBeNull()
    expect(d.sleepLatency).toBeNull()
  })
  it('timestamp 있으면 파생 계산', () => {
    const ep: SleepEpisode = {
      ...base, source: 'manual',
      wentToBedAt: '2026-06-30T23:00:00+09:00',
      sleepOnsetAt: '2026-06-30T23:30:00+09:00',
      wakeAt: '2026-07-01T07:00:00+09:00',
    }
    const d = deriveSleep(ep)
    expect(d.timeInBed).toBe(480)
    expect(d.sleepLatency).toBe(30)
    expect(d.sleepDuration).toBe(450)
  })
})
