import { describe, it, expect } from 'vitest'
import { convertV1Export, type V1Export } from './convert'
import { ModeDB } from '@/data/db/db'
import { createRepositories } from '@/data/repositories'
import { importBackup, type BackupFile as AppBackupFile } from '@/data/importExport/backup'

/** 합성 fixture — 실제 개인 데이터 아님. V1 export 모양만 재현. */
const SYNTHETIC: V1Export = {
  app: 'MODE', version: 2, exportedAt: '2026-08-22T00:00:00.000Z',
  tables: {
    // 이미 들어있는 진짜 V2 직접입력 → 보존
    stateMeasurements: [
      {
        localDate: '2026-08-22', recordedAt: '2026-08-22T02:30:00.000Z', timezoneOffsetMinutes: 540,
        checkInType: 'morning', promptedMetrics: ['moodLow', 'anxiety', 'energy'],
        metrics: { moodLow: 0, anxiety: 3, energy: 8 },
        source: 'manual', schemaVersion: 1, createdAt: 'x', updatedAt: 'y', id: 1,
      },
      // 불완전(V2 아님): recordedAt/checkInType 없음 → 버림
      { localDate: '2026-08-20', metrics: { anxiety: 5 } },
    ],
    sleepEpisodes: [
      {
        localDate: '2026-08-22', wentToBedAt: '2026-08-21T15:30:00.000Z',
        sleepOnsetAt: '2026-08-21T17:40:00.000Z', wakeAt: '2026-08-21T22:30:00.000Z',
        awakenings: 0, satisfaction: 6, source: 'manual', schemaVersion: 1, createdAt: 'x', updatedAt: 'y', id: 1,
      },
    ],
    mealEpisodes: [
      {
        localDate: '2026-08-22', startedAt: '2026-08-21T23:28:00.000Z', prePhysicalHunger: 3,
        preCraving: 0, amount: 'small', proteinIncluded: true, alcoholAmount: null, // 비-V2 키
        source: 'manual', schemaVersion: 1, createdAt: 'x', updatedAt: 'y', id: 1,
      },
    ],
    // date 단위 사실 → 보존
    cycleLogs: [
      { date: '2026-07-17', periodStart: true, periodEnd: false, flowLevel: 'normal', periodPain: 5, createdAt: 'c1' },
      { date: '2026-07-18', periodStart: false, periodEnd: false, flowLevel: 'light', periodPain: 0, createdAt: 'c2' },
      { date: '2026-07-20', periodStart: false, periodEnd: true, flowLevel: null, periodPain: null, createdAt: 'c3' },
      { periodStart: true }, // date 없음 → 버림
    ],
    // V2 카탈로그 코드만 보존
    eventLogs: [
      { date: '2026-07-01', eventCode: 'conflict', category: 'relationship', timing: 'today', intensity: 5 },
      { date: '2026-07-02', eventCode: 'walked', category: 'movement', timing: 'recent3days', intensity: 3 },
      { date: '2026-07-01', eventCode: 'sleep_short', category: 'sleep', timing: 'today', intensity: 5 }, // 카탈로그 밖 → 버림
    ],
    recoveryLogs: [
      { date: '2026-07-01', actionCode: 'talk_family', category: 'relationship', effect: 'much_better' },
      { date: '2026-07-02', actionCode: 'warm_food', category: 'body', effect: 'little_better' },
      { date: '2026-07-03', actionCode: 'sns', category: 'digital', effect: 'worse' }, // 카탈로그 밖 → 버림
    ],
    // 추정/파생 → 전부 버림
    dailyLogs: [
      { date: '2026-07-01', moodLow: 0, anxiety: 2, sweetCraving: 3, appetite: 4, lastNightSleep: { hours: 7, quality: 3 } },
      { date: '2026-07-02', energy: 6 },
    ],
    dailyScores: [{ date: '2026-07-01', dayType: 'stable', rhythmLoad: 12, recoveryScore: 55 }],
    patternInsights: [{ id: 1, text: 'x' }],
    userSettings: [{ cycleEnabled: true, toneMode: 'witty' }],
  },
}

const { backup, report } = convertV1Export(SYNTHETIC)

describe('V1 → clean V2 backup 변환기', () => {
  it('정상 mode-v2 backup 형식 + 13개 store key 를 갖는다', () => {
    expect(backup.format).toBe('mode-v2')
    expect(backup.settings).toBeNull()
    for (const k of ['stateMeasurements', 'sleepEpisodes', 'mealEpisodes', 'cycleRecords', 'contextEvents', 'recoveryActions']) {
      expect(Array.isArray(backup.tables[k])).toBe(true)
    }
  })

  it('출력에 legacy_import / conversionRules / conversionVersion 이 없다', () => {
    const s = JSON.stringify(backup)
    expect(s).not.toContain('legacy_import')
    expect(s).not.toContain('conversionRules')
    expect(s).not.toContain('conversionVersion')
  })

  it('진짜 V2 직접입력은 그대로 보존(source manual)', () => {
    expect(backup.tables.stateMeasurements).toHaveLength(1)
    expect((backup.tables.stateMeasurements[0] as { source: string }).source).toBe('manual')
    expect(report.preservedDirectV2.stateMeasurements).toBe(1)
  })

  it('비-V2 키(alcoholAmount)는 제거된다', () => {
    const meal = backup.tables.mealEpisodes[0] as Record<string, unknown>
    expect('alcoholAmount' in meal).toBe(false)
    expect(meal.preCraving).toBe(0) // V2 필드는 보존
  })

  it('cycle 은 date 단위 사실로 1:1 보존(추정 없음)', () => {
    const cyc = backup.tables.cycleRecords as Record<string, unknown>[]
    expect(cyc).toHaveLength(3) // date 없는 1건 버림
    expect(cyc[0].periodStart).toBe(true)
    expect(cyc[0].flowLevel).toBe('normal')
    expect(cyc[0].painLevel).toBe(5)
    // flow/pain 이 null 이면 키 자체가 없다(0 으로 안 채움)
    expect('flowLevel' in cyc[2]).toBe(false)
    expect('painLevel' in cyc[2]).toBe(false)
    expect(cyc[2].periodEnd).toBe(true)
    // 가짜 시각 없음
    for (const c of cyc) expect('recordedAt' in c).toBe(false)
  })

  it('context/recovery 는 V2 카탈로그 코드만, 가짜 occurredAt 없음', () => {
    const ctx = backup.tables.contextEvents as Record<string, unknown>[]
    expect(ctx.map((c) => c.code).sort()).toEqual(['conflict', 'walked'])
    expect(ctx.find((c) => c.code === 'conflict')!.label).toBe('사람과 갈등') // V2 카탈로그 라벨
    expect(ctx.find((c) => c.code === 'conflict')!.approxWindow).toBe('today')
    expect(ctx.find((c) => c.code === 'walked')!.approxWindow).toBe('recent3days')
    for (const c of ctx) expect(c.occurredAt).toBeNull()

    const rec = backup.tables.recoveryActions as Record<string, unknown>[]
    expect(rec.map((r) => r.code).sort()).toEqual(['talk_family', 'warm_food'])
    expect(rec[0].effect).toBe('much_better')
    for (const r of rec) expect(r.occurredAt).toBeNull()
  })

  it('추정/파생/재해석 대상은 전부 버리고 이유를 보고한다', () => {
    expect(backup.tables.contextEvents).toHaveLength(2)
    expect(backup.tables.recoveryActions).toHaveLength(2)
    const sources = report.discarded.map((d) => d.source)
    expect(sources).toContain('dailyLogs')
    expect(sources).toContain('dailyScores')
    expect(sources).toContain('patternInsights')
    // dailyLog metric(sweetCraving/appetite 등)은 어디에도 안 들어감
    const dump = JSON.stringify(backup.tables)
    expect(dump).not.toContain('sweetCraving')
    expect(dump).not.toContain('rhythmLoad')
    expect(dump).not.toContain('dayType')
  })

  it('앱의 importBackup 으로 그대로 복원된다(정상 backup)', async () => {
    const db = new ModeDB(`conv-${Date.now()}`)
    const repos = createRepositories(db)
    const res = await importBackup(repos, backup as unknown as AppBackupFile, { replace: true })
    expect(res.imported.stateMeasurements).toBe(1)
    expect(res.imported.cycleRecords).toBe(3)
    expect(res.imported.contextEvents).toBe(2)
    expect(res.imported.recoveryActions).toBe(2)
    expect(await repos.cycle.periodStartDates()).toEqual(['2026-07-17'])
  })
})
