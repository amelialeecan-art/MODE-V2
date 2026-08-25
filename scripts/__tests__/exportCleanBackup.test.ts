import { describe, it, expect } from 'vitest'
import syntheticV1 from '../__fixtures__/syntheticV1Export.json'
import { convertToCleanBackup } from '../exportCleanBackup'

const { backup, report } = convertToCleanBackup(syntheticV1 as Record<string, unknown>)

describe('exportCleanBackup — 엄격 V1→clean V2 변환 (합성 fixture)', () => {
  it('정상 mode-v2 backup 형태를 만든다', () => {
    expect(backup.format).toBe('mode-v2')
    expect(backup.formatVersion).toBe(1)
    expect(backup.schemaVersion).toBe(1)
    expect(backup.migrationVersion).toBe(1)
    // 13 store 모두 존재(비어도 배열)
    expect(Object.keys(backup.tables)).toHaveLength(13)
    for (const rows of Object.values(backup.tables)) expect(Array.isArray(rows)).toBe(true)
  })

  it('OUTPUT 어디에도 legacy 마커가 없다', () => {
    const asText = JSON.stringify(backup)
    for (const banned of ['legacy_import', 'conversionRules', 'conversionVersion']) {
      expect(asText).not.toContain(banned)
    }
  })

  it('dailyLogs(상태)를 StateMeasurement 로 만들지 않는다 (가짜 시각/checkInType 금지)', () => {
    // 진짜 V2 직접입력 1개만 보존, V1 dailyLogs 유래 state 0
    expect(backup.tables.stateMeasurements).toHaveLength(1)
    const s = backup.tables.stateMeasurements[0] as Record<string, unknown>
    expect(s.localDate).toBe('2026-06-10')
    expect(s.source).toBe('manual')
    // 12:00 anchor 같은 가짜 시각이 없어야 한다
    const asText = JSON.stringify(backup.tables.stateMeasurements)
    expect(asText).not.toContain('T12:00:00')
    const stateDiscard = report.discarded.find((d) => d.table === 'dailyLogs(state)')
    expect(stateDiscard?.count).toBe(2)
  })

  it('dailyLogs.lastNightSleep(수면)을 SleepEpisode 로 만들지 않는다', () => {
    // 진짜 V2 sleep 1개만 보존, V1 수면 유래 0
    expect(backup.tables.sleepEpisodes).toHaveLength(1)
    expect((backup.tables.sleepEpisodes[0] as Record<string, unknown>).source).toBe('manual')
    const asText = JSON.stringify(backup.tables.sleepEpisodes)
    expect(asText).not.toContain('durationMinutes')
    const sleepDiscard = report.discarded.find((d) => d.table === 'dailyLogs(sleep)')
    expect(sleepDiscard?.count).toBe(2)
  })

  it('eventLogs / recoveryLogs 는 전량 폐기 (occurredAt 없음 → 시각/의미 불일치)', () => {
    expect(backup.tables.contextEvents).toHaveLength(0)
    expect(backup.tables.recoveryActions).toHaveLength(0)
    expect(report.discarded.find((d) => d.table === 'eventLogs')?.count).toBe(2)
    expect(report.discarded.find((d) => d.table === 'recoveryLogs')?.count).toBe(1)
  })

  it('dailyScores / patternInsights(파생) 전량 폐기', () => {
    expect(report.discarded.find((d) => d.table === 'dailyScores')?.count).toBe(1)
    expect(report.discarded.find((d) => d.table === 'patternInsights')?.count).toBe(1)
    const asText = JSON.stringify(backup)
    for (const banned of ['dayType', 'emotionalLoad', 'effectSize', 'patternInsight']) {
      expect(asText).not.toContain(banned)
    }
  })

  it('cycleLogs 의 생리 사실은 의미 동일 → 보존 (source=import, legacy 아님)', () => {
    // 3개 중 2개 보존(정상 flow), 06-20 은 flow 값만 미매핑 → record 는 보존하되 flowLevel=null
    const cycles = backup.tables.cycleRecords as Record<string, unknown>[]
    expect(cycles).toHaveLength(3)
    for (const c of cycles) {
      expect(c.source).toBe('import')
      expect(c.conversionVersion).toBeUndefined()
      expect(c.timezoneOffsetMinutes).toBe(540)
    }
    const start0605 = cycles.find((c) => c.localDate === '2026-06-05')!
    expect(start0605.periodStart).toBe(true)
    expect(start0605.flowLevel).toBe('normal')
    expect(start0605.painLevel).toBe(5)

    const end0608 = cycles.find((c) => c.localDate === '2026-06-08')!
    expect(end0608.periodEnd).toBe(true)
    expect(end0608.flowLevel).toBe('light')

    // 미매핑 flow: 재해석 금지 → flowLevel=null, 하지만 날짜/periodStart/pain 사실은 보존
    const start0620 = cycles.find((c) => c.localDate === '2026-06-20')!
    expect(start0620.periodStart).toBe(true)
    expect(start0620.flowLevel).toBeNull()
    expect(start0620.painLevel).toBe(6)
    expect(report.preservedExactV1Facts.cycleRecords).toBe(3)
    expect(report.discarded.find((d) => d.table.includes('gushing'))?.count).toBe(1)
  })

  it('진짜 V2 raw 를 보존한다 (preserved direct V2)', () => {
    expect(report.preservedDirectV2.stateMeasurements).toBe(1)
    expect(report.preservedDirectV2.sleepEpisodes).toBe(1)
    expect(report.preservedDirectV2.mealEpisodes).toBe(1)
    // 원본 V1 export 의 V2 직접입력은 manual → legacy 마커 제거 없음
    expect(report.sanitizedLegacyMarkers).toBe(0)
    // 보존 meal 값은 그대로
    const meal = backup.tables.mealEpisodes[0] as Record<string, unknown>
    expect(meal.preCraving).toBe(2)
    expect(meal.alcohol ?? null).toBeNull()
  })

  it('settings 는 의미 동일한 cycleEnabled 만 보존, 나머지 폐기', () => {
    expect(backup.settings).toEqual({ cycleEnabled: true })
    expect(report.preservedExactV1Facts.settings).toEqual(['cycleEnabled'])
    const settingsDiscard = report.discarded.find((d) => d.table === 'userSettings')
    expect(settingsDiscard?.reason).toContain('averageCycleLength')
    expect(settingsDiscard?.reason).toContain('toneMode')
  })

  it('진짜 V2 record 에 legacy 마커가 있으면 제거하고 집계한다', () => {
    const tainted = convertToCleanBackup({
      tables: {
        cycleRecords: [
          {
            localDate: '2026-07-01', timezoneOffsetMinutes: 540, periodStart: true,
            source: 'legacy_import', conversionVersion: 1, schemaVersion: 1,
            createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z',
          },
        ],
      },
    })
    expect(tainted.report.sanitizedLegacyMarkers).toBe(1)
    const c = tainted.backup.tables.cycleRecords[0] as Record<string, unknown>
    expect(c.source).toBe('import')
    expect(c.conversionVersion).toBeUndefined()
    expect(JSON.stringify(tainted.backup)).not.toContain('legacy_import')
  })
})
