import { describe, it, expect } from 'vitest'
import { dayCycleInfo, cycleContext, bleedingSpans } from '@/analysis/cycle/cyclePhase'
import type { CycleRecord } from '@/domain/cycle/cycleRecord'

function rec(localDate: string, extra: Partial<CycleRecord> = {}): CycleRecord {
  return {
    localDate, timezoneOffsetMinutes: 540, source: 'manual', schemaVersion: 1,
    createdAt: '', updatedAt: '', ...extra,
  }
}

// 실측: 시작 07-17, 종료 07-22, 다음 시작 08-20 → 관측 주기 34일
const records: CycleRecord[] = [
  rec('2026-07-17', { periodStart: true, flowLevel: 'normal' }),
  rec('2026-07-20', { flowLevel: 'light' }),
  rec('2026-07-22', { periodEnd: true }),
  rec('2026-08-20', { periodStart: true, flowLevel: 'normal' }),
]

describe('cycle phase — retrospective, 28일 가정 없음', () => {
  it('관측 주기 길이만 사용한다(34일)', () => {
    const ctx = cycleContext(records)
    expect(ctx.startDates).toEqual(['2026-07-17', '2026-08-20'])
    expect(ctx.observedLengths).toEqual([34])
    expect(ctx.medianLength).toBe(34)
  })

  it('출혈 구간을 실제 기록에서 만든다', () => {
    const spans = bleedingSpans(records)
    expect(spans[0]).toEqual({ start: '2026-07-17', end: '2026-07-22' })
  })

  it('생리 첫날은 menstrual, cycleDay=1', () => {
    const info = dayCycleInfo(records, '2026-07-17')
    expect(info.phase).toBe('menstrual')
    expect(info.cycleDay).toBe(1)
  })

  it('완결 주기 안에서 후반부는 luteal, 초반은 follicular', () => {
    // 08-20 이 다음 start → 배란 추정 = 08-06. 08-10 은 luteal, 07-28 은 follicular
    expect(dayCycleInfo(records, '2026-08-10').phase).toBe('luteal')
    expect(dayCycleInfo(records, '2026-07-28').phase).toBe('follicular')
  })

  it('start 기록이 없으면 phase=unknown (억지 분류 안 함)', () => {
    const info = dayCycleInfo([], '2026-07-17')
    expect(info.phase).toBe('unknown')
    expect(info.cycleDay).toBeNull()
  })

  it('진행 중 주기에서 다음 예상 생리까지 일수를 계산한다', () => {
    // 08-20 이후, 관측 34일 → 다음 예상 09-23
    const info = dayCycleInfo(records, '2026-08-25')
    expect(info.cycleDay).toBe(6)
    expect(info.daysUntilNextPredicted).toBe(29) // 09-23 - 08-25
  })
})
