import { describe, it, expect } from 'vitest'
import sampleExport from '../__fixtures__/sampleExport.json'
import { migrateLegacyExport } from '../legacyImport'
import { isDirectlyMeasured } from '@/domain/state/stateMeasurement'
import type { LegacyExport } from '../legacyTypes'

const result = migrateLegacyExport(sampleExport as LegacyExport)
const { bundle, report } = result

describe('legacy migration — 합성 fixture', () => {
  it('V1 변환 + 기존 V2 보존을 합쳐 최종 record 수를 만든다', () => {
    // dailyLogs 4개 중 06-03 은 V2 evening 과 충돌 → 3, + 보존 V2 state 2 = 5
    expect(report.counts.state).toBe(5)
    // 수면 4개 중 06-03 충돌 → 3, + 보존 V2 sleep 1 = 4
    expect(report.counts.sleep).toBe(4)
    expect(report.counts.meal).toBe(1) // 보존 V2 meal
    expect(report.counts.cycle).toBe(1)
    expect(report.counts.context).toBe(2) // allowlist 2, 나머지 drop
    expect(report.counts.recovery).toBe(2)
  })

  it('기존 V2 raw 를 보존하고, 같은 날짜는 V2 직접입력이 우선(중복 없음)', () => {
    expect(report.preservedV2).toEqual({ state: 2, sleep: 1, meal: 1, cycle: 0 })
    expect(report.skippedByV2Conflict).toEqual({ state: 1, sleep: 1, cycle: 0 })

    // 06-03 evening state 는 정확히 1개, 그리고 V2 직접입력값(energy 7)이어야 한다.
    const evening0603 = bundle.state.filter((s) => s.localDate === '2026-06-03' && s.checkInType === 'evening')
    expect(evening0603).toHaveLength(1)
    expect(evening0603[0].source).toBe('manual') // V1 변환본(legacy_import) 아님
    expect(evening0603[0].metrics.energy).toBe(7) // V1 값 2 가 덮어쓰지 않음
    expect(evening0603[0].metrics.anxiety).toBe('unknown') // unknown 보존
    expect('bloating' in evening0603[0].metrics).toBe(false) // 물어봤지만 missing

    // 06-03 sleep 은 정확히 1개, V2 timestamp 를 유지(가짜 아님)
    const sleep0603 = bundle.sleep.filter((s) => s.localDate === '2026-06-03')
    expect(sleep0603).toHaveLength(1)
    expect(sleep0603[0].source).toBe('manual')
    expect(sleep0603[0].wakeAt).toBeTruthy()
    expect(sleep0603[0].durationMinutes ?? null).toBeNull()
  })

  it('파생 결과(dailyScores/patternInsights)를 절대 넣지 않는다', () => {
    expect(Object.keys(bundle).sort()).toEqual(['context', 'cycle', 'meal', 'recovery', 'sleep', 'state'])
    expect(report.droppedTables).toContain('dailyScores')
    expect(report.droppedTables).toContain('patternInsights')
    const asText = JSON.stringify(bundle)
    for (const banned of ['dayType', 'rhythmLoad', 'recoveryScore', 'emotionalLoad', 'appetiteLoad', 'patternInsight']) {
      expect(asText).not.toContain(banned)
    }
  })

  it('V1 변환본은 legacy_import + conversionVersion, 보존 V2 는 아님', () => {
    const legacy = bundle.state.filter((s) => s.source === 'legacy_import')
    for (const r of legacy) { expect(r.conversionVersion).toBe(1); expect(r.schemaVersion).toBe(1) }
    const v2 = bundle.state.filter((s) => s.source === 'manual')
    for (const r of v2) expect(r.conversionVersion).toBeUndefined()
  })

  it('appetite 를 physicalHunger 로 변환하지 않는다', () => {
    for (const s of bundle.state.filter((s) => s.source === 'legacy_import')) {
      expect('physicalHunger' in s.metrics).toBe(false)
    }
  })

  it('positiveAffect 는 legacy 에서 만들어내지 않는다(신 V2 직접입력은 정상)', () => {
    for (const s of bundle.state.filter((s) => s.source === 'legacy_import')) {
      expect('positiveAffect' in s.metrics).toBe(false)
    }
    // 보존한 V2 06-10 morning 은 실제로 positiveAffect 를 측정했다
    const v2morning = bundle.state.find((s) => s.localDate === '2026-06-10' && s.checkInType === 'morning')!
    expect(v2morning.metrics.positiveAffect).toBe(7)
  })

  it('craving/fatigueHeaviness/painDiscomfort 는 max() + metric 단위 provenance 를 남긴다', () => {
    const s0602 = bundle.state.find((s) => s.localDate === '2026-06-02' && s.source === 'legacy_import')!
    expect(s0602.metrics.craving).toBe(9) // max(9,3,5)
    expect(s0602.metrics.fatigueHeaviness).toBe(8) // max(8,6)
    expect(s0602.metrics.painDiscomfort).toBe(7) // max(7,4)
    // 변환값은 직접측정이 아니다
    expect(isDirectlyMeasured(s0602, 'craving')).toBe(false)
    expect(isDirectlyMeasured(s0602, 'fatigueHeaviness')).toBe(false)
    expect(isDirectlyMeasured(s0602, 'painDiscomfort')).toBe(false)
    // 직접 보존된 값은 직접측정이다
    expect(isDirectlyMeasured(s0602, 'moodLow')).toBe(true)
    expect(isDirectlyMeasured(s0602, 'anxiety')).toBe(true)
    expect(s0602.conversionRules?.craving).toContain('max(')
  })

  it('legacy 수면은 duration 만 — 가짜 timestamp 를 만들지 않는다', () => {
    for (const s of bundle.sleep.filter((s) => s.source === 'legacy_import')) {
      expect(s.wentToBedAt).toBeNull()
      expect(s.sleepOnsetAt).toBeNull()
      expect(s.wakeAt).toBeNull()
    }
    // 06-01 hours 8 → 480분
    const s0601 = bundle.sleep.find((s) => s.localDate === '2026-06-01')!
    expect(s0601.durationMinutes).toBe(480)
  })

  it('event 는 allowlist 만 선별(수면/음식 이벤트는 버린다)', () => {
    const kept = new Set(bundle.context.map((c) => c.code))
    expect(kept.has('work_heavy')).toBe(true)
    expect(kept.has('conflict')).toBe(true)
    expect(report.droppedEventCodes['ate_sweets']).toBeGreaterThan(0)
    expect(report.droppedEventCodes['irregular_sleep']).toBeGreaterThan(0)
    for (const c of bundle.context) expect(c.occurredAt).toBeNull()
  })

  it('생리 시작 기록을 사실 그대로 보존한다', () => {
    const starts = bundle.cycle.filter((c) => c.periodStart)
    expect(starts.map((c) => c.localDate)).toEqual(['2026-06-05'])
  })

  it('0 은 측정된 값으로 보존된다 (0 !== missing)', () => {
    const s0601 = bundle.state.find((s) => s.localDate === '2026-06-01' && s.source === 'legacy_import')!
    expect(s0601.metrics.moodLow).toBe(0)
    expect(s0601.promptedMetrics).toContain('moodLow')
  })

  it('구 V2 meal 의 alcoholAmount 를 신 alcohol 구조로 정규화(null 보존)', () => {
    const meal = bundle.meal[0]
    expect('alcoholAmount' in meal).toBe(false)
    expect(meal.alcohol ?? null).toBeNull() // 원본 null → 측정 안 함
    expect(meal.preCraving).toBe(2)
  })
})
