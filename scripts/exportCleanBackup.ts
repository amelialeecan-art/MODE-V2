/* =====================================================================
   ONE-TIME 변환기 (production 앱 밖). 원본 V1 export JSON → 정상 mode-v2 backup.

   설계 원칙 (STEP 2):
   - "살릴 수 있으면 최대한 살린다" 가 아니다.
     V2 의미와 100% 동일한 사실만 보존한다.
   - 추정 / 합성 / 재해석 / 가짜 timestamp / 가짜 occurredAt = 0.
   - OUTPUT 은 "특별한 legacy backup" 이 아니라 앱이 평범하게 JSON 불러오기 하는
     정상 mode-v2 backup 이다. 따라서 OUTPUT 안에는
       legacy_import · conversionRules · conversionVersion
     이 존재하지 않는다.

   보존/폐기 판단:
   - A. export 안에 이미 있는 진짜 V2 raw record → 그대로 보존(형태만 정규화).
   - D. cycleLogs(생리): date·periodStart/End·flow·pain 은 V2 CycleRecord 와 의미 동일
        → 보존. (flow 는 V2 enum 에 정확히 일치하는 값만; 아니면 미기록으로 둔다.)
   - dailyLogs(상태): V2 StateMeasurement 는 recordedAt(시각)+checkInType(아침/저녁/수시)
        가 필수인데 V1 일일기록엔 둘 다 없다 → 만들면 가짜 사실. 전량 폐기.
   - dailyLogs.lastNightSleep(E): duration/quality 만, V2 SleepEpisode 는 실제 timestamp 기반
        → 전량 폐기(수면 살리려고 스키마를 바꾸지 않는다).
   - eventLogs / recoveryLogs(F): occurredAt 없음 → V2 episode 와 시각/의미 정확히
        일치하지 않는다 → 전량 폐기.
   - dailyScores / patternInsights: 앱이 계산한 파생값 → 전량 폐기.

   사용: npx tsx scripts/exportCleanBackup.ts <v1Export.json> [out.json]
   (INPUT 은 반드시 "원본 V1 export". 이미 변환된 mode-backup-*.json 을 넣지 말 것.)
   ===================================================================== */
import { readFileSync, writeFileSync } from 'node:fs'
import type { CycleRecord, FlowLevel } from '../src/domain/cycle/cycleRecord'

/* backup.ts(EXPORT_FORMAT 등)와 반드시 동일해야 하는 상수. 값 변경 시 함께 갱신. */
const EXPORT_FORMAT = 'mode-v2'
const EXPORT_FORMAT_VERSION = 1
const SCHEMA_VERSION = 1
const MIGRATION_VERSION = 1

/** 한국어 데이터 → localDate 해석 근거(KST=+540). 관측 metric 이 아니라 provenance. */
const KST_OFFSET = 540

/** V2 backup 이 담는 13개 store. importBackup 이 읽는 키와 동일. */
const STORE_KEYS = [
  'stateMeasurements', 'sleepEpisodes', 'mealEpisodes', 'activityEpisodes',
  'cycleRecords', 'contextEvents', 'recoveryActions', 'medicationProfiles',
  'medicationDoses', 'healthExceptions', 'screenExposures', 'weightMeasurements',
  'experiments',
] as const
type StoreKey = (typeof STORE_KEYS)[number]

const FLOW_LEVELS: readonly FlowLevel[] = ['spotting', 'light', 'normal', 'heavy', 'unknown']

/* ---- 느슨한 입력 타입(원본 V1 export). 읽기 전용 참조. ---- */
interface V1CycleLog {
  date?: string
  periodStart?: boolean
  periodEnd?: boolean
  flowLevel?: string
  periodPain?: number
  createdAt?: string
  updatedAt?: string
}
interface V1UserSettings {
  cycleEnabled?: boolean
  [k: string]: unknown
}
interface V1Export {
  tables?: Record<string, unknown[]>
  [k: string]: unknown
}

/* ---- 출력 backup 형태(backup.ts 의 BackupFile 과 동일). ---- */
interface CleanBackup {
  format: typeof EXPORT_FORMAT
  formatVersion: number
  schemaVersion: number
  migrationVersion: number
  exportedAt: string
  tables: Record<StoreKey, unknown[]>
  settings: { cycleEnabled: boolean } | null
}

export interface ConvertReport {
  /** A. export 안에 이미 있던 진짜 V2 raw record 를 그대로 보존한 수(store 별). */
  preservedDirectV2: Record<string, number>
  /** 보존 중 legacy 마커(legacy_import/conversionRules/conversionVersion)를 제거한 record 수. */
  sanitizedLegacyMarkers: number
  /** exact V1 facts: 의미가 동일해 보존한 V1 유래 사실. */
  preservedExactV1Facts: {
    cycleRecords: number
    settings: string[]
  }
  /** 폐기: 무엇을, 몇 개, 왜. */
  discarded: { table: string; count: number; reason: string }[]
}

export interface ConvertResult {
  backup: CleanBackup
  report: ConvertReport
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}
function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}
function toFlowLevel(v: unknown): FlowLevel | null {
  return typeof v === 'string' && (FLOW_LEVELS as string[]).includes(v) ? (v as FlowLevel) : null
}

/**
 * 진짜 V2 raw record 를 그대로 보존하되 형태만 정규화한다:
 * - id 제거(중복 add 대비), schemaVersion 고정.
 * - legacy 마커(source==='legacy_import', conversionVersion, conversionRules) 제거
 *   → OUTPUT 에 legacy 흔적 0 을 보장. (원본 V1 export 의 진짜 V2 직접입력은 보통 'manual'
 *      이라 아무것도 제거되지 않는다. 제거가 일어나면 report 에 집계된다.)
 * 값 자체(metric/timestamp)는 건드리지 않는다.
 */
function sanitizeV2(raw: Record<string, unknown>): { record: Record<string, unknown>; strippedLegacy: boolean } {
  const { id: _id, source, conversionVersion, conversionRules, ...rest } = raw
  const strippedLegacy = source === 'legacy_import' || conversionVersion !== undefined || conversionRules !== undefined
  const nextSource = source === 'legacy_import' || source == null ? 'import' : source
  return {
    record: { ...rest, source: nextSource, schemaVersion: SCHEMA_VERSION },
    strippedLegacy,
  }
}

export function convertToCleanBackup(input: V1Export): ConvertResult {
  const now = new Date().toISOString()
  const t = input.tables ?? {}
  const tables = Object.fromEntries(STORE_KEYS.map((k) => [k, [] as unknown[]])) as Record<StoreKey, unknown[]>

  const preservedDirectV2: Record<string, number> = {}
  let sanitizedLegacyMarkers = 0
  const discarded: ConvertReport['discarded'] = []

  /* ---- A) 진짜 V2 raw 보존 (13 store 전부 훑는다) ---- */
  const v2CycleDates = new Set<string>()
  for (const key of STORE_KEYS) {
    const rows = asArray(t[key])
    let kept = 0
    for (const raw of rows) {
      if (!isObj(raw) || typeof raw.localDate !== 'string') continue // V2 raw 는 모두 localDate 를 가진다
      const { record, strippedLegacy } = sanitizeV2(raw)
      if (strippedLegacy) sanitizedLegacyMarkers++
      tables[key].push(record)
      if (key === 'cycleRecords') v2CycleDates.add(raw.localDate)
      kept++
    }
    if (kept > 0) preservedDirectV2[key] = kept
  }

  /* ---- D) cycleLogs(V1) → CycleRecord: 의미 동일한 사실만 보존 ---- */
  let cycleKept = 0
  let cycleDroppedNoDate = 0
  let cycleConflictV2 = 0
  const unmappedFlow: Record<string, number> = {}
  for (const raw of asArray(t.cycleLogs) as V1CycleLog[]) {
    if (!raw?.date) { cycleDroppedNoDate++; continue }
    if (v2CycleDates.has(raw.date)) { cycleConflictV2++; continue } // 진짜 V2 직접입력 우선
    if (raw.flowLevel != null && toFlowLevel(raw.flowLevel) === null) {
      unmappedFlow[String(raw.flowLevel)] = (unmappedFlow[String(raw.flowLevel)] ?? 0) + 1
    }
    const record: Omit<CycleRecord, 'id'> = {
      source: 'import',
      schemaVersion: SCHEMA_VERSION,
      localDate: raw.date,
      timezoneOffsetMinutes: KST_OFFSET,
      periodStart: raw.periodStart === true,
      periodEnd: raw.periodEnd === true,
      flowLevel: toFlowLevel(raw.flowLevel), // enum 에 정확히 일치하는 값만; 아니면 null(미기록)
      painLevel: isNum(raw.periodPain) ? raw.periodPain : null,
      createdAt: raw.createdAt ?? now,
      updatedAt: raw.updatedAt ?? now,
    }
    tables.cycleRecords.push(record)
    cycleKept++
  }

  /* ---- 폐기 집계 (V2 의미와 1:1 이 아닌 모든 V1 데이터) ---- */
  const dailyLogs = asArray(t.dailyLogs)
  const stateBearing = dailyLogs.filter(
    (d) => isObj(d) && Object.keys(d).some((k) => !['id', 'date', 'lastNightSleep', 'createdAt', 'updatedAt'].includes(k)),
  ).length
  const sleepBearing = dailyLogs.filter((d) => isObj(d) && isObj(d.lastNightSleep)).length
  if (stateBearing > 0)
    discarded.push({ table: 'dailyLogs(state)', count: stateBearing, reason: 'V2 StateMeasurement 는 recordedAt(시각)+checkInType(아침/저녁/수시) 필수인데 V1 일일기록엔 둘 다 없음 → 만들면 가짜 사실' })
  if (sleepBearing > 0)
    discarded.push({ table: 'dailyLogs(sleep)', count: sleepBearing, reason: 'V1 수면은 duration/quality 만, V2 SleepEpisode 는 실제 timestamp 기반 → 수면 살리려 스키마를 바꾸지 않음' })
  if (cycleDroppedNoDate > 0)
    discarded.push({ table: 'cycleLogs(no date)', count: cycleDroppedNoDate, reason: 'date 없는 생리 기록 → 귀속 날짜 불명' })
  if (cycleConflictV2 > 0)
    discarded.push({ table: 'cycleLogs(V2 conflict)', count: cycleConflictV2, reason: '같은 날짜에 진짜 V2 cycleRecord 존재 → V2 직접입력 우선' })

  const eventCount = asArray(t.eventLogs).length
  if (eventCount > 0)
    discarded.push({ table: 'eventLogs', count: eventCount, reason: 'occurredAt 없음 → V2 ContextEvent 와 시각/의미가 정확히 일치하지 않음' })
  const recoveryCount = asArray(t.recoveryLogs).length
  if (recoveryCount > 0)
    discarded.push({ table: 'recoveryLogs', count: recoveryCount, reason: 'occurredAt 없음 → V2 RecoveryAction 과 시각/의미가 정확히 일치하지 않음' })

  for (const [table, key] of [['dailyScores', 'dailyScores'], ['patternInsights', 'patternInsights']] as const) {
    const n = asArray(t[key]).length
    if (n > 0) discarded.push({ table, count: n, reason: '앱이 계산한 파생값 → raw 아님, 전량 폐기' })
  }
  for (const [flow, n] of Object.entries(unmappedFlow)) {
    discarded.push({ table: `cycleLogs.flowLevel="${flow}"`, count: n, reason: 'V2 flow enum 에 없는 값 → 재해석 금지, 미기록(null)으로 둠' })
  }

  /* ---- settings: 의미가 동일한 사실만(cycleEnabled). 나머지는 폐기. ---- */
  const preservedSettings: string[] = []
  let settings: CleanBackup['settings'] = null
  const us = asArray(t.userSettings)[0] as V1UserSettings | undefined
  if (us && typeof us.cycleEnabled === 'boolean') {
    settings = { cycleEnabled: us.cycleEnabled }
    preservedSettings.push('cycleEnabled')
    const droppedKeys = Object.keys(us).filter((k) => !['cycleEnabled', 'id', 'createdAt', 'updatedAt'].includes(k))
    if (droppedKeys.length > 0)
      discarded.push({ table: 'userSettings', count: droppedKeys.length, reason: `V2 와 의미 다름/미구현 → 폐기: ${droppedKeys.join(', ')}` })
  }

  const backup: CleanBackup = {
    format: EXPORT_FORMAT,
    formatVersion: EXPORT_FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    migrationVersion: MIGRATION_VERSION,
    exportedAt: now,
    tables,
    settings,
  }

  return {
    backup,
    report: {
      preservedDirectV2,
      sanitizedLegacyMarkers,
      preservedExactV1Facts: { cycleRecords: cycleKept, settings: preservedSettings },
      discarded,
    },
  }
}

/* ---- CLI ---- */
function main(): void {
  const inPath = process.argv[2]
  const outPath = process.argv[3] ?? 'mode-v2-clean-backup.json'
  if (!inPath) {
    console.error('사용법: npx tsx scripts/exportCleanBackup.ts <원본 V1 export.json> [out.json]')
    console.error('주의: 이미 변환된 mode-backup-*.json 이 아니라 "원본 V1 export" 를 넣을 것.')
    process.exit(1)
  }
  const input = JSON.parse(readFileSync(inPath, 'utf-8')) as V1Export
  const { backup, report } = convertToCleanBackup(input)
  writeFileSync(outPath, JSON.stringify(backup, null, 2))

  console.log('변환 완료 →', outPath)
  console.log('\n[preserved direct V2]')
  const dv2 = Object.entries(report.preservedDirectV2)
  console.log(dv2.length ? dv2.map(([k, n]) => `  ${k}: ${n}`).join('\n') : '  (없음)')
  if (report.sanitizedLegacyMarkers > 0) console.log(`  · legacy 마커 제거: ${report.sanitizedLegacyMarkers} record`)
  console.log('\n[preserved exact V1 facts]')
  console.log(`  cycleRecords: ${report.preservedExactV1Facts.cycleRecords}`)
  console.log(`  settings: ${report.preservedExactV1Facts.settings.join(', ') || '(없음)'}`)
  console.log('\n[discarded]')
  console.log(report.discarded.length
    ? report.discarded.map((d) => `  ${d.table} × ${d.count} — ${d.reason}`).join('\n')
    : '  (없음)')
}

/* tsx 로 직접 실행될 때만 CLI 동작. import 될 때(테스트)는 순수 함수만 노출. */
if (process.argv[1] && /exportCleanBackup\.ts$/.test(process.argv[1])) main()
