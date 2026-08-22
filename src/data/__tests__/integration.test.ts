import { describe, it, expect, beforeEach } from 'vitest'
import { ModeDB } from '@/data/db/db'
import { createRepositories, type Repositories } from '@/data/repositories'
import { importLegacyExport } from '@/data/migrations/runMigration'
import legacyExport from '@/data/migrations/__fixtures__/legacyExport.json'
import type { LegacyExport } from '@/data/migrations/legacyTypes'
import { loadDayRecords, loadRange, loadRecordDates } from '@/data/queries/dayQuery'
import { pickDayState } from '@/analysis/day/daySummary'
import { dailyMetricValues } from '@/analysis/associations/coOccurrence'
import { exportBackup, importBackup } from '@/data/importExport/backup'
import { nowISO, todayLocalDate } from '@/shared/time/time'

let db: ModeDB
let repos: Repositories
let n = 0
beforeEach(() => { db = new ModeDB(`itg-${Date.now()}-${n++}`); repos = createRepositories(db) })

describe('단일 소스: 입력 → DB → Today/Calendar/Rhythm 동일 데이터', () => {
  it('오늘 저장한 값을 세 surface 가 똑같이 읽는다', async () => {
    const today = todayLocalDate()
    await repos.state.upsertCheckIn({
      source: 'manual', localDate: today, timezoneOffsetMinutes: 540,
      recordedAt: nowISO(), checkInType: 'evening',
      promptedMetrics: ['energy', 'craving'], metrics: { energy: 8, craving: 3 },
    })

    // Today 경로
    const day = await loadDayRecords(repos, today)
    const picked = pickDayState(day)
    expect(picked.find((p) => p.metric === 'energy')?.value).toBe(8)

    // Calendar 경로
    const presence = await loadRecordDates(repos, today, today)
    expect(presence.get(today)?.eveningState).toBe(true)

    // Rhythm 경로
    const range = await loadRange(repos, today, today)
    const rhythm = dailyMetricValues(range.state, 'energy')
    expect(rhythm.get(today)).toBe(8)
  })

  it('legacy import 후 알려진 날짜가 모든 경로에서 동일하게 보인다', async () => {
    await importLegacyExport(repos, legacyExport as LegacyExport)
    const date = '2026-08-19' // fixture 의 rich 한 날
    const day = await loadDayRecords(repos, date)
    expect(day.state.length).toBe(1)
    const picked = pickDayState(day)
    const rhythm = dailyMetricValues((await loadRange(repos, date, date)).state, picked[0].metric)
    // 같은 metric 을 두 경로가 같은 값으로 본다
    const v = picked[0].value
    if (typeof v === 'number') expect(rhythm.get(date)).toBe(v)
  })
})

describe('백업 라운드트립 — 파생 없이 완전 복원', () => {
  it('export → 새 DB import 하면 raw 가 보존되고 파생은 없다', async () => {
    await importLegacyExport(repos, legacyExport as LegacyExport)
    const file = await exportBackup(repos)

    // 파생 store 가 백업에 없다
    expect(Object.keys(file.tables)).not.toContain('dailyScores')
    expect(Object.keys(file.tables)).not.toContain('patternInsights')
    expect(JSON.stringify(file)).not.toContain('rhythmLoad')
    expect(JSON.stringify(file)).not.toContain('dayType')

    const db2 = new ModeDB(`itg-restore-${Date.now()}`)
    const repos2 = createRepositories(db2)
    await importBackup(repos2, file, { replace: true })

    expect(await repos2.state.count()).toBe(await repos.state.count())
    expect(await repos2.sleep.count()).toBe(await repos.sleep.count())
    expect(await repos2.cycle.count()).toBe(await repos.cycle.count())
  })
})

describe('provenance 로 legacy/manual 구분 유지', () => {
  it('import 한 record 는 legacy_import, 신규는 manual', async () => {
    await importLegacyExport(repos, legacyExport as LegacyExport)
    await repos.state.upsertCheckIn({
      source: 'manual', localDate: todayLocalDate(), timezoneOffsetMinutes: 540,
      recordedAt: nowISO(), checkInType: 'evening', promptedMetrics: ['anxiety'], metrics: { anxiety: 1 },
    })
    const all = await repos.state.all()
    expect(all.some((s) => s.source === 'legacy_import')).toBe(true)
    expect(all.some((s) => s.source === 'manual')).toBe(true)
  })
})
