import { describe, it, expect } from 'vitest'
import legacyExport from '../__fixtures__/legacyExport.json'
import { migrateLegacyExport } from '../legacyImport'
import type { LegacyExport } from '../legacyTypes'

const result = migrateLegacyExport(legacyExport as LegacyExport)

describe('legacy migration — 실제 2개월 export', () => {
  it('state/sleep/cycle/context/recovery 를 생성한다', () => {
    const c = result.report.counts
    expect(c.state).toBe(53) // dailyLogs 53행 전부 상태값 존재
    expect(c.sleep).toBe(34) // lastNightSleep 있는 34행만
    expect(c.cycle).toBe(7)
    expect(c.recovery).toBe(140)
    expect(c.context).toBeGreaterThan(0)
  })

  it('파생 결과(dailyScores/patternInsights)를 절대 넣지 않는다', () => {
    // bundle 에는 그런 store 자체가 없다.
    expect(Object.keys(result.bundle).sort()).toEqual(
      ['context', 'cycle', 'recovery', 'sleep', 'state'].sort(),
    )
    expect(result.report.droppedTables).toContain('dailyScores')
    expect(result.report.droppedTables).toContain('patternInsights')
    // 어떤 record 에도 dayType/rhythmLoad/recoveryScore 흔적이 없다.
    const asText = JSON.stringify(result.bundle)
    for (const banned of ['dayType', 'rhythmLoad', 'recoveryScore', 'emotionalLoad', 'appetiteLoad', 'patternInsight']) {
      expect(asText).not.toContain(banned)
    }
  })

  it('모든 record 에 legacy_import provenance 를 남긴다', () => {
    const all = [...result.bundle.state, ...result.bundle.sleep, ...result.bundle.cycle, ...result.bundle.context, ...result.bundle.recovery]
    for (const r of all) {
      expect(r.source).toBe('legacy_import')
      expect(r.conversionVersion).toBe(1)
      expect(r.schemaVersion).toBe(1)
    }
  })

  it('appetite 를 physicalHunger 로 변환하지 않는다', () => {
    for (const s of result.bundle.state) {
      expect(s.promptedMetrics).not.toContain('physicalHunger')
      expect('physicalHunger' in s.metrics).toBe(false)
    }
  })

  it('positiveAffect 는 legacy 에서 만들어내지 않는다(missing)', () => {
    for (const s of result.bundle.state) {
      expect(s.promptedMetrics).not.toContain('positiveAffect')
      expect('positiveAffect' in s.metrics).toBe(false)
    }
  })

  it('craving = max(sweet, salty, greasy) 명시적 변환', () => {
    // fixture 첫 dailyLog: 모두 0 → craving 0(측정됨)
    const first = result.bundle.state.find((s) => s.localDate === '2026-07-01')!
    expect(first.metrics.craving).toBe(0)
    // 큰 값 케이스: 어떤 날은 9
    const has9 = result.bundle.state.some((s) => s.metrics.craving === 9)
    expect(has9).toBe(true)
  })

  it('legacy 수면은 duration 만 — 가짜 timestamp 를 만들지 않는다', () => {
    for (const s of result.bundle.sleep) {
      expect(s.wentToBedAt).toBeNull()
      expect(s.sleepOnsetAt).toBeNull()
      expect(s.wakeAt).toBeNull()
      expect(typeof s.durationMinutes === 'number' || s.satisfaction != null).toBe(true)
    }
    // hours=8 → 480분
    const eight = result.bundle.sleep.find((s) => s.durationMinutes === 480)
    expect(eight).toBeDefined()
  })

  it('생리 시작 기록을 사실 그대로 보존한다', () => {
    const starts = result.bundle.cycle.filter((c) => c.periodStart)
    expect(starts.map((c) => c.localDate).sort()).toEqual(['2026-07-17', '2026-08-20'])
  })

  it('event 는 allowlist 만 선별(수면/음식/디지털 이벤트는 버린다)', () => {
    const kept = new Set(result.bundle.context.map((c) => c.code))
    expect(kept.has('work_heavy')).toBe(true)
    expect(kept.has('conflict')).toBe(true)
    // 버려야 하는 것들
    expect(result.report.droppedEventCodes['ate_ultraprocessed']).toBeGreaterThan(0)
    expect(result.report.droppedEventCodes['irregular_sleep']).toBeGreaterThan(0)
    for (const c of result.bundle.context) {
      expect(c.occurredAt).toBeNull() // 시각 불명 → 전후관계 금지
    }
  })

  it('0 은 측정된 값으로 보존된다 (0 !== missing)', () => {
    const first = result.bundle.state.find((s) => s.localDate === '2026-07-01')!
    expect(first.metrics.moodLow).toBe(0)
    expect(first.promptedMetrics).toContain('moodLow') // 물어봤고 0
  })
})
