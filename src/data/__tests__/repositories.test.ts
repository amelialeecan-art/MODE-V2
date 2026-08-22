import { describe, it, expect, beforeEach } from 'vitest'
import { ModeDB } from '@/data/db/db'
import { createRepositories, type Repositories } from '@/data/repositories'
import { importLegacyExport } from '@/data/migrations/runMigration'
import legacyExport from '@/data/migrations/__fixtures__/sampleExport.json'
import type { LegacyExport } from '@/data/migrations/legacyTypes'
import { todayLocalDate, nowISO } from '@/shared/time/time'

let db: ModeDB
let repos: Repositories
let n = 0

beforeEach(async () => {
  db = new ModeDB(`test-${Date.now()}-${n++}`)
  repos = createRepositories(db)
})

describe('repositories · provenance stamping', () => {
  it('manual 신규 입력과 legacy_import 를 구분할 수 있다', async () => {
    const today = todayLocalDate()
    await repos.state.put({
      source: 'manual',
      localDate: today,
      timezoneOffsetMinutes: 540,
      recordedAt: nowISO(),
      checkInType: 'evening',
      promptedMetrics: ['anxiety'],
      metrics: { anxiety: 3 },
    })
    await importLegacyExport(repos, legacyExport as LegacyExport)

    const all = await repos.state.all()
    const manual = all.filter((s) => s.source === 'manual')
    const legacy = all.filter((s) => s.source === 'legacy_import')
    // 내가 넣은 manual 1 + export 안 보존된 V2 manual 2 = 3
    expect(manual.length).toBe(3)
    // V1 변환본 3 (06-03 은 V2 충돌로 skip)
    expect(legacy.length).toBe(3)
    expect(legacy.every((s) => s.conversionVersion === 1)).toBe(true)
    expect(manual.every((s) => s.conversionVersion === undefined)).toBe(true)
  })

  it('put 은 schemaVersion/createdAt/updatedAt 를 찍는다', async () => {
    const id = await repos.sleep.put({
      source: 'manual',
      localDate: '2026-08-22',
      timezoneOffsetMinutes: 540,
      satisfaction: 7,
      durationMinutes: null,
    })
    const rec = await repos.sleep.get(id)
    expect(rec?.schemaVersion).toBe(1)
    expect(rec?.createdAt).toBeTruthy()
    expect(rec?.updatedAt).toBeTruthy()
  })
})

describe('invariant · 0 !== missing !== unknown', () => {
  it('세 상태를 저장/조회에서 구분한다', async () => {
    const id = await repos.state.put({
      source: 'manual',
      localDate: '2026-08-22',
      timezoneOffsetMinutes: 540,
      recordedAt: nowISO(),
      checkInType: 'evening',
      // anxiety 물어봤고 0, irritability 물어봤는데 unknown, energy 아예 안 물어봄
      promptedMetrics: ['anxiety', 'irritability'],
      metrics: { anxiety: 0, irritability: 'unknown' },
    })
    const rec = (await repos.state.get(id))!
    expect(rec.metrics.anxiety).toBe(0) // 실제 없음
    expect(rec.metrics.irritability).toBe('unknown') // 모름
    expect('energy' in rec.metrics).toBe(false) // 안 물어봄(missing)
    expect(rec.promptedMetrics).toContain('irritability')
    expect(rec.promptedMetrics).not.toContain('energy')
  })
})

describe('invariant · 신규 저장이 곧바로 조회된다 (단일 소스)', () => {
  it('오늘 StateMeasurement 저장 → byDate/inRange 에서 같은 값', async () => {
    const today = todayLocalDate()
    await repos.state.upsertCheckIn({
      source: 'manual',
      localDate: today,
      timezoneOffsetMinutes: 540,
      recordedAt: nowISO(),
      checkInType: 'evening',
      promptedMetrics: ['energy', 'anxiety'],
      metrics: { energy: 7, anxiety: 2 },
    })
    const byDate = await repos.state.byDate(today)
    const range = await repos.state.inRange(today, today)
    expect(byDate).toHaveLength(1)
    expect(range).toHaveLength(1)
    expect(byDate[0].metrics.energy).toBe(7)
    expect(range[0].metrics.energy).toBe(7)
  })

  it('evening 재저장은 upsert(중복 안 생김)', async () => {
    const today = todayLocalDate()
    const base = {
      source: 'manual' as const,
      localDate: today,
      timezoneOffsetMinutes: 540,
      recordedAt: nowISO(),
      checkInType: 'evening' as const,
      promptedMetrics: ['energy' as const],
    }
    await repos.state.upsertCheckIn({ ...base, metrics: { energy: 3 } })
    await repos.state.upsertCheckIn({ ...base, metrics: { energy: 8 } })
    const rows = await repos.state.byDate(today)
    expect(rows).toHaveLength(1)
    expect(rows[0].metrics.energy).toBe(8)
  })
})
