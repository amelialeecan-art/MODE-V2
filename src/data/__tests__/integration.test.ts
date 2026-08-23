import { describe, it, expect, beforeEach } from 'vitest'
import { ModeDB } from '@/data/db/db'
import { createRepositories, type Repositories } from '@/data/repositories'
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

/** V2 raw 만으로 며칠치 기록을 심는다(과거 데이터 변환 없이). */
async function seedV2(r: Repositories) {
  const tz = 540
  for (let i = 1; i <= 5; i++) {
    const localDate = `2026-06-0${i}`
    await r.state.put({
      source: 'manual', localDate, timezoneOffsetMinutes: tz,
      recordedAt: `${localDate}T21:00:00+09:00`, checkInType: 'evening',
      promptedMetrics: ['energy', 'anxiety'], metrics: { energy: i + 2, anxiety: i },
    })
  }
  // 시각이 있는 수면(파생 가능) + 시각 없이 duration 만 아는 수면
  await r.sleep.put({
    source: 'manual', localDate: '2026-06-01', timezoneOffsetMinutes: tz,
    wentToBedAt: '2026-05-31T23:00:00+09:00', sleepOnsetAt: '2026-05-31T23:30:00+09:00',
    wakeAt: '2026-06-01T07:00:00+09:00', satisfaction: 6, durationMinutes: null,
  })
  await r.sleep.put({
    source: 'manual', localDate: '2026-06-02', timezoneOffsetMinutes: tz,
    wentToBedAt: null, sleepOnsetAt: null, wakeAt: null, satisfaction: 5, durationMinutes: 420,
  })
  await r.meal.put({
    source: 'manual', localDate: '2026-06-02', timezoneOffsetMinutes: tz,
    startedAt: '2026-06-02T12:30:00+09:00', preCraving: 3,
  })
  // 실제 periodStart 1개만 — 관측 주기 없음
  await r.cycle.put({
    source: 'manual', localDate: '2026-06-05', timezoneOffsetMinutes: tz, periodStart: true,
  })
}

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

describe('V2 raw 만으로 불변식 유지', () => {
  beforeEach(async () => { await seedV2(repos) })

  it('시각 없는 수면은 timestamp 를 만들어내지 않는다(duration 만)', async () => {
    const d = await loadDayRecords(repos, '2026-06-02')
    expect(d.sleep).toHaveLength(1)
    expect(d.sleep[0].wentToBedAt).toBeNull()
    expect(d.sleep[0].sleepOnsetAt).toBeNull()
    expect(d.sleep[0].wakeAt).toBeNull()
    expect(d.sleep[0].durationMinutes).toBe(420)
  })

  it('안 물어본 metric(positiveAffect)은 임의로 생성되지 않는다', async () => {
    const all = await repos.state.all()
    for (const s of all) expect('positiveAffect' in s.metrics).toBe(false)
  })

  it('백업 export 에 파생 점수 테이블(dailyScores/patternInsights 등)이 없다', async () => {
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
    await seedV2(repos)
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
  it('리포트가 raw 기반으로 생성된다', async () => {
    await seedV2(repos)
    const range = await loadRange(repos, '2026-06-01', '2026-06-30')
    const report = buildAnalysisReport(range, '2026-06-30')
    expect(report.totalStateDays).toBeGreaterThan(0)
    // summarizeDay 도 raw 로부터
    const s = summarizeDay(await loadDayRecords(repos, '2026-06-02'))
    expect(s.hasAnyState).toBe(true)
  })
})
