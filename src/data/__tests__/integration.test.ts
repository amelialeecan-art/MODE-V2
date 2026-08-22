import { describe, it, expect, beforeEach } from 'vitest'
import { ModeDB } from '@/data/db/db'
import { createRepositories, type Repositories } from '@/data/repositories'
import { importLegacyExport } from '@/data/migrations/runMigration'
import sampleExport from '@/data/migrations/__fixtures__/sampleExport.json'
import type { LegacyExport } from '@/data/migrations/legacyTypes'
import { loadDayRecords, loadRange, loadRecordDates } from '@/data/queries/dayQuery'
import { pickDayState, summarizeDay } from '@/analysis/day/daySummary'
import { dailyMetricValues } from '@/analysis/associations/coOccurrence'
import { numericSamples } from '@/analysis/baseline/baseline'
import { buildAnalysisReport } from '@/analysis/report/analysisReport'
import { dayCycleInfo, cycleContext } from '@/analysis/cycle/cyclePhase'
import { exportBackup, importBackup } from '@/data/importExport/backup'
import { nowISO, todayLocalDate, addDays } from '@/shared/time/time'

let db: ModeDB
let repos: Repositories
let n = 0
beforeEach(() => { db = new ModeDB(`itg-${Date.now()}-${n++}`); repos = createRepositories(db) })

describe('단일 소스: 입력 → Today/Calendar/Rhythm/Analysis 동일 raw', () => {
  it('오늘 저장한 값을 모든 read 경로가 똑같이 읽는다', async () => {
    const today = todayLocalDate()
    await repos.state.upsertCheckIn({
      source: 'manual', localDate: today, timezoneOffsetMinutes: 540,
      recordedAt: nowISO(), checkInType: 'evening',
      promptedMetrics: ['energy', 'craving'], metrics: { energy: 8, craving: 3 },
    })
    const day = await loadDayRecords(repos, today)
    expect(pickDayState(day).find((p) => p.metric === 'energy')?.value).toBe(8) // Today/Calendar
    const presence = await loadRecordDates(repos, today, today)
    expect(presence.get(today)?.eveningState).toBe(true) // Calendar dots
    const range = await loadRange(repos, today, today)
    expect(dailyMetricValues(range.state, 'energy').get(today)).toBe(8) // Rhythm/Analysis
  })

  it('0 / missing / unknown 의 의미가 모든 read 경로에서 유지된다', async () => {
    const today = todayLocalDate()
    await repos.state.upsertCheckIn({
      source: 'manual', localDate: today, timezoneOffsetMinutes: 540,
      recordedAt: nowISO(), checkInType: 'evening',
      // anxiety 물어봤고 0, irritability 물어봤는데 unknown, physicalHunger 안 물어봄
      promptedMetrics: ['anxiety', 'irritability', 'energy'],
      metrics: { anxiety: 0, irritability: 'unknown', energy: 7 },
    })
    const day = await loadDayRecords(repos, today)
    const picked = pickDayState(day)
    // Today/Calendar: 0 은 값으로 보임(level none), unknown 은 level 없음, missing 은 아예 없음
    expect(picked.find((p) => p.metric === 'anxiety')?.value).toBe(0)
    expect(picked.find((p) => p.metric === 'anxiety')?.level).toBe('none')
    expect(picked.find((p) => p.metric === 'irritability')?.value).toBe('unknown')
    expect(picked.find((p) => p.metric === 'irritability')?.level).toBeNull()
    expect(picked.find((p) => p.metric === 'physicalHunger')).toBeUndefined()

    // Rhythm/Analysis 입력(dailyMetricValues): 0 은 포함, unknown/missing 은 제외
    const range = await loadRange(repos, today, today)
    expect(dailyMetricValues(range.state, 'anxiety').get(today)).toBe(0) // 0 은 실제 값
    expect(dailyMetricValues(range.state, 'irritability').has(today)).toBe(false) // unknown 제외
    expect(dailyMetricValues(range.state, 'physicalHunger').has(today)).toBe(false) // missing 제외

    // baseline 표본도 동일 규칙(0 포함, unknown/missing 제외)
    expect(numericSamples(range.state, 'anxiety')).toEqual([0])
    expect(numericSamples(range.state, 'irritability')).toEqual([])
  })
})

describe('실제 V2 + migration 과거 데이터 함께 import (#6)', () => {
  beforeEach(async () => { await importLegacyExport(repos, sampleExport as LegacyExport) })

  it('중복 없음 + 기존 V2 직접입력 우선', async () => {
    const d = await loadDayRecords(repos, '2026-06-03')
    const evenings = d.state.filter((s) => s.checkInType === 'evening')
    expect(evenings).toHaveLength(1) // 중복 아님
    expect(evenings[0].source).toBe('manual') // V2 직접입력
    expect(evenings[0].metrics.energy).toBe(7) // V1 값(2)이 덮어쓰지 않음
    expect(d.sleep).toHaveLength(1)
    expect(d.sleep[0].source).toBe('manual') // V2 수면 우선
  })

  it('가짜 sleep timestamp 없음 (legacy 는 duration 만)', async () => {
    const all = await repos.sleep.all()
    for (const s of all.filter((x) => x.source === 'legacy_import')) {
      expect(s.wentToBedAt).toBeNull()
      expect(s.sleepOnsetAt).toBeNull()
      expect(s.wakeAt).toBeNull()
    }
  })

  it('positiveAffect 과거값 임의 생성 없음', async () => {
    const all = await repos.state.all()
    for (const s of all.filter((x) => x.source === 'legacy_import')) {
      expect('positiveAffect' in s.metrics).toBe(false)
    }
  })

  it('dailyScores/patternInsights 는 어떤 store 에도 들어오지 않는다', async () => {
    const file = await exportBackup(repos)
    expect(Object.keys(file.tables)).not.toContain('dailyScores')
    expect(Object.keys(file.tables)).not.toContain('patternInsights')
    expect(JSON.stringify(file.tables)).not.toContain('rhythmLoad')
    expect(JSON.stringify(file.tables)).not.toContain('dayType')
  })

  it('생리 phase 에 28일 고정값을 쓰지 않는다', async () => {
    const cyc = await repos.cycle.all()
    const ctx = cycleContext(cyc)
    // 실제 start 가 1개뿐 → 관측 주기 없음 → 예측 불가(28일 fallback 이면 여기서 예측이 나왔을 것)
    expect(ctx.observedLengths).toEqual([])
    expect(ctx.medianLength).toBeNull()
    const info = dayCycleInfo(cyc, addDays('2026-06-05', 20))
    expect(info.daysUntilNextPredicted).toBeNull() // 28일 가정 안 함
  })
})

describe('백업 라운드트립 — 파생 없이 완전 복원', () => {
  it('export → 새 DB import 하면 raw 가 보존되고 파생은 없다', async () => {
    await importLegacyExport(repos, sampleExport as LegacyExport)
    const file = await exportBackup(repos)
    const db2 = new ModeDB(`itg-restore-${Date.now()}`)
    const repos2 = createRepositories(db2)
    await importBackup(repos2, file, { replace: true })
    expect(await repos2.state.count()).toBe(await repos.state.count())
    expect(await repos2.sleep.count()).toBe(await repos.sleep.count())
    expect(await repos2.meal.count()).toBe(await repos.meal.count())
    expect(await repos2.cycle.count()).toBe(await repos.cycle.count())
  })
})

describe('Analysis 는 raw 만으로 재계산된다', () => {
  it('import 후 리포트가 raw 기반으로 생성된다', async () => {
    await importLegacyExport(repos, sampleExport as LegacyExport)
    const range = await loadRange(repos, '2026-06-01', '2026-06-30')
    const report = buildAnalysisReport(range, '2026-06-30')
    expect(report.totalStateDays).toBeGreaterThan(0)
    // summarizeDay 도 raw 로부터
    const s = summarizeDay(await loadDayRecords(repos, '2026-06-02'))
    expect(s.hasAnyState).toBe(true)
  })
})
