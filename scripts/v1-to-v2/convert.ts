/* =====================================================================
   One-time V1(구 MODE export) → clean V2 backup 변환기.  (프로덕션 앱 밖 도구)

   원칙: "살릴 수 있으면 최대한"이 아니라, **V2 의미와 100% 동일한 사실만** 보존.
   - 추정/합성/재해석/가짜 timestamp/가짜 occurredAt 없음.
   - 출력은 앱이 그대로 "JSON 불러오기" 하는 정상 mode-v2 backup.
   - 출력에 legacy_import / conversionRules / conversionVersion 이 존재하지 않는다.

   INPUT = 원본 V1 export JSON(dailyLogs/eventLogs/cycleLogs/recoveryLogs + 이미
   들어있는 진짜 V2 raw tables). 이미 한번 변환된 mode-backup-*.json 이 아니다.

   V2 카탈로그/enum 은 아래에 스냅샷으로 임베드한다(단일 출처: src/domain/*).
   이 파일은 @/ alias 를 쓰지 않는다 → node/tsx 로 단독 실행 가능.
   ===================================================================== */

// ── V1 입력(느슨한 read-only 타입) ─────────────────────────────────
export interface V1Export {
  app?: string
  version?: number
  exportedAt?: string
  tables?: Record<string, unknown[] | undefined>
}

interface V1CycleLog {
  date?: string
  periodStart?: boolean
  periodEnd?: boolean
  flowLevel?: string | null
  periodPain?: number | null
  createdAt?: string
  updatedAt?: string
}
interface V1EventLog {
  date?: string
  eventCode?: string
  timing?: string
  intensity?: number | null
  createdAt?: string
}
interface V1RecoveryLog {
  date?: string
  actionCode?: string
  effect?: string
  createdAt?: string
}

// ── V2 출력 형태(필요한 부분만) ────────────────────────────────────
type DataSource = 'manual' | 'import' | 'derived'
interface Provenance {
  source: DataSource
  schemaVersion: number
  createdAt: string
  updatedAt: string
}
interface TimeProvenance {
  localDate: string
  timezoneOffsetMinutes: number
}

type FlowLevel = 'spotting' | 'light' | 'normal' | 'heavy' | 'unknown'
type ContextCategory = 'work' | 'relationship' | 'control' | 'environment' | 'movement'
type RecoveryCategory = 'body' | 'relationship' | 'rest' | 'reality'
type RecoveryEffect = 'much_better' | 'little_better' | 'same' | 'worse' | 'unknown'

interface CycleRecordOut extends Provenance, TimeProvenance {
  id?: number
  periodStart?: boolean
  periodEnd?: boolean
  flowLevel?: FlowLevel
  painLevel?: number
}
interface ContextEventOut extends Provenance, TimeProvenance {
  id?: number
  occurredAt: null
  code: string
  label: string
  category: ContextCategory
  intensity?: number
  approxWindow: 'today' | 'recent3days' | null
}
interface RecoveryActionOut extends Provenance, TimeProvenance {
  id?: number
  occurredAt: null
  code: string
  label: string
  category: RecoveryCategory
  effect: RecoveryEffect
}

export interface BackupFile {
  format: 'mode-v2'
  formatVersion: number
  schemaVersion: number
  migrationVersion: number
  exportedAt: string
  tables: Record<string, unknown[]>
  settings: unknown
}

// ── V2 스냅샷 상수(출처: src/domain/*) ─────────────────────────────
const SCHEMA_VERSION = 1
const APP_SCHEMA_VERSION = 1
const MIGRATION_VERSION = 1
const EXPORT_FORMAT_VERSION = 1
/** 한국어 데이터 = KST. date 단위 record 의 provenance 메타(시각 생성 아님). */
const KST = 540

const V2_STORE_KEYS = [
  'stateMeasurements', 'sleepEpisodes', 'mealEpisodes', 'activityEpisodes',
  'cycleRecords', 'contextEvents', 'recoveryActions', 'medicationProfiles',
  'medicationDoses', 'healthExceptions', 'screenExposures', 'weightMeasurements',
  'experiments',
] as const

const V2_FLOW: ReadonlySet<FlowLevel> = new Set(['spotting', 'light', 'normal', 'heavy', 'unknown'])
const V2_EFFECT: ReadonlySet<RecoveryEffect> = new Set(['much_better', 'little_better', 'same', 'worse', 'unknown'])

/** src/domain/context/contextEvent.ts CONTEXT_EVENT_CATALOG 스냅샷. */
const V2_CONTEXT: ReadonlyMap<string, { label: string; category: ContextCategory }> = new Map([
  ['work_heavy', { label: '일이 많았음', category: 'work' }],
  ['work_pressure', { label: '마감·압박', category: 'work' }],
  ['reply_stress', { label: '연락·답장 스트레스', category: 'relationship' }],
  ['conflict', { label: '사람과 갈등', category: 'relationship' }],
  ['social_comparison', { label: '사회적 비교', category: 'relationship' }],
  ['long_alone', { label: '혼자 오래 있음', category: 'relationship' }],
  ['crowded', { label: '사람 많음', category: 'relationship' }],
  ['failure_mistake', { label: '실패·실수', category: 'control' }],
  ['not_my_way', { label: '내 뜻대로 안 됨', category: 'control' }],
  ['upcoming_stress', { label: '앞둔 일 스트레스', category: 'control' }],
  ['new_burden', { label: '부담 일정 생김', category: 'control' }],
  ['plan_disrupted', { label: '계획 틀어짐', category: 'control' }],
  ['weather_gloomy', { label: '날씨 흐림', category: 'environment' }],
  ['low_sunlight', { label: '햇빛 부족', category: 'environment' }],
  ['noise_space', { label: '소음·공간 스트레스', category: 'environment' }],
  ['messy_home', { label: '집 지저분함', category: 'environment' }],
  ['cramped', { label: '공간 답답함', category: 'environment' }],
  ['stayed_in', { label: '집에만 있었음', category: 'environment' }],
  ['moved_lot', { label: '이동이 많았음', category: 'movement' }],
  ['exercised', { label: '운동함', category: 'movement' }],
  ['walked', { label: '산책함', category: 'movement' }],
])

/** src/domain/recovery/recoveryAction.ts RECOVERY_ACTION_CATALOG 스냅샷. */
const V2_RECOVERY: ReadonlyMap<string, { label: string; category: RecoveryCategory }> = new Map([
  ['rest', { label: '휴식', category: 'rest' }],
  ['sleep', { label: '잠', category: 'rest' }],
  ['nap', { label: '낮잠', category: 'rest' }],
  ['lying_down', { label: '누워있기', category: 'rest' }],
  ['shower', { label: '샤워', category: 'body' }],
  ['warm_food', { label: '따뜻한 음식', category: 'body' }],
  ['protein', { label: '단백질 식사', category: 'body' }],
  ['exercise', { label: '운동', category: 'body' }],
  ['walk', { label: '산책', category: 'body' }],
  ['stretch', { label: '스트레칭', category: 'body' }],
  ['clean', { label: '청소', category: 'body' }],
  ['talk_family', { label: '가족과 대화', category: 'relationship' }],
  ['talk_partner', { label: '파트너와 대화', category: 'relationship' }],
  ['talk_friend', { label: '친구와 대화', category: 'relationship' }],
  ['alone', { label: '혼자 있기', category: 'reality' }],
  ['delay_reply', { label: '답장 미루기', category: 'reality' }],
])

/** 이미 export 안에 있는 진짜 V2 record 를 그대로 보존할 때 허용하는 필드. */
const STATE_FIELDS = new Set([
  'localDate', 'recordedAt', 'checkInType', 'promptedMetrics', 'metrics', 'note',
  'timezoneOffsetMinutes', 'source', 'schemaVersion', 'createdAt', 'updatedAt',
])
const SLEEP_FIELDS = new Set([
  'localDate', 'wentToBedAt', 'sleepOnsetAt', 'wakeAt', 'awakenings', 'satisfaction',
  'durationMinutes', 'note', 'timezoneOffsetMinutes', 'source', 'schemaVersion', 'createdAt', 'updatedAt',
])
const MEAL_FIELDS = new Set([
  'localDate', 'startedAt', 'endedAt', 'prePhysicalHunger', 'preCraving', 'preBingeUrge',
  'amount', 'proteinIncluded', 'sweetsIncluded', 'ultraProcessedIncluded', 'perceivedOvereating',
  'alcohol', 'note', 'timezoneOffsetMinutes', 'source', 'schemaVersion', 'createdAt', 'updatedAt',
])

// ── report ─────────────────────────────────────────────────────────
export interface ConvertReport {
  /** export 안에 이미 있던 진짜 V2 직접입력 (그대로 보존). */
  preservedDirectV2: Record<string, number>
  /** V2 와 의미가 100% 동일해 1:1 로 보존한 V1 사실. */
  preservedV1Facts: Record<string, number>
  /** 버린 record 와 이유. */
  discarded: { source: string; count: number; reason: string }[]
}
export interface ConvertResult {
  backup: BackupFile
  report: ConvertReport
}

// ── helpers ────────────────────────────────────────────────────────
const isInt0to10 = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 10
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const pick = (row: Record<string, unknown>, allow: ReadonlySet<string>): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(row)) if (allow.has(k) && row[k] !== undefined) out[k] = row[k]
  return out
}

// ── 변환 ───────────────────────────────────────────────────────────
export function convertV1Export(v1: V1Export): ConvertResult {
  const t = v1.tables ?? {}
  const now = new Date().toISOString()
  const exportedAt = typeof v1.exportedAt === 'string' ? v1.exportedAt : now

  const tables: Record<string, unknown[]> = {}
  for (const k of V2_STORE_KEYS) tables[k] = []

  const preservedDirectV2: Record<string, number> = {}
  const preservedV1Facts: Record<string, number> = {}
  const discarded: ConvertReport['discarded'] = []
  const drop = (source: string, count: number, reason: string) => {
    if (count > 0) discarded.push({ source, count, reason })
  }

  // ── A) 이미 존재하는 진짜 V2 raw record 보존 ───────────────────────
  // stateMeasurements: recordedAt(시각)+checkInType+localDate 가 있어야 완전한 V2 record.
  {
    const rows = asArray(t.stateMeasurements) as Record<string, unknown>[]
    let kept = 0, bad = 0
    for (const r of rows) {
      if (typeof r.localDate === 'string' && typeof r.recordedAt === 'string'
        && (r.checkInType === 'morning' || r.checkInType === 'evening' || r.checkInType === 'adhoc')) {
        tables.stateMeasurements.push(pick(r, STATE_FIELDS)); kept++
      } else bad++
    }
    preservedDirectV2.stateMeasurements = kept
    drop('stateMeasurements(V2)', bad, 'recordedAt/checkInType 없는 불완전 record')
  }
  // sleepEpisodes: V2 는 timestamp 기반. localDate 만 있으면 보존(시각 없는 V1 수면은 여기 없음).
  {
    const rows = asArray(t.sleepEpisodes) as Record<string, unknown>[]
    let kept = 0, bad = 0
    for (const r of rows) {
      if (typeof r.localDate === 'string') { tables.sleepEpisodes.push(pick(r, SLEEP_FIELDS)); kept++ }
      else bad++
    }
    preservedDirectV2.sleepEpisodes = kept
    drop('sleepEpisodes(V2)', bad, 'localDate 없는 불완전 record')
  }
  // mealEpisodes: V2 필드만 남김(예: 비-V2 키 alcoholAmount 제거).
  {
    const rows = asArray(t.mealEpisodes) as Record<string, unknown>[]
    let kept = 0, bad = 0
    for (const r of rows) {
      if (typeof r.localDate === 'string' && typeof r.startedAt === 'string') {
        tables.mealEpisodes.push(pick(r, MEAL_FIELDS)); kept++
      } else bad++
    }
    preservedDirectV2.mealEpisodes = kept
    drop('mealEpisodes(V2)', bad, 'localDate/startedAt 없는 불완전 record')
  }

  // ── D) cycleLogs → cycleRecords (date 단위 사실, 의미 동일) ─────────
  {
    const rows = asArray(t.cycleLogs) as V1CycleLog[]
    let kept = 0, noDate = 0
    for (const c of rows) {
      if (typeof c.date !== 'string') { noDate++; continue }
      const rec: CycleRecordOut = {
        localDate: c.date, timezoneOffsetMinutes: KST,
        source: 'import', schemaVersion: SCHEMA_VERSION,
        createdAt: c.createdAt ?? exportedAt, updatedAt: c.updatedAt ?? c.createdAt ?? exportedAt,
        periodStart: c.periodStart === true, periodEnd: c.periodEnd === true,
      }
      if (typeof c.flowLevel === 'string' && V2_FLOW.has(c.flowLevel as FlowLevel)) rec.flowLevel = c.flowLevel as FlowLevel
      if (isInt0to10(c.periodPain)) rec.painLevel = c.periodPain
      tables.cycleRecords.push(rec); kept++
    }
    preservedV1Facts.cycleRecords = kept
    drop('cycleLogs', noDate, 'date 없음')
  }

  // ── F) eventLogs → contextEvents (V2 카탈로그 코드만, 시각 생성 없음) ─
  {
    const rows = asArray(t.eventLogs) as V1EventLog[]
    let kept = 0, notInCatalog = 0, noDate = 0
    for (const e of rows) {
      const def = e.eventCode ? V2_CONTEXT.get(e.eventCode) : undefined
      if (!def) { notInCatalog++; continue }
      if (typeof e.date !== 'string') { noDate++; continue }
      const approxWindow = e.timing === 'today' ? 'today' : e.timing === 'recent3days' ? 'recent3days' : null
      const rec: ContextEventOut = {
        localDate: e.date, timezoneOffsetMinutes: KST,
        source: 'import', schemaVersion: SCHEMA_VERSION,
        createdAt: e.createdAt ?? exportedAt, updatedAt: e.createdAt ?? exportedAt,
        occurredAt: null, code: e.eventCode as string, label: def.label, category: def.category,
        approxWindow,
      }
      if (isInt0to10(e.intensity)) rec.intensity = e.intensity
      tables.contextEvents.push(rec); kept++
    }
    preservedV1Facts.contextEvents = kept
    drop('eventLogs', notInCatalog, 'V2 context 카탈로그에 없는 code(재해석 금지)')
    drop('eventLogs', noDate, 'date 없음')
  }

  // ── F) recoveryLogs → recoveryActions (V2 카탈로그 코드+effect 만) ──
  {
    const rows = asArray(t.recoveryLogs) as V1RecoveryLog[]
    let kept = 0, notInCatalog = 0, badEffect = 0, noDate = 0
    for (const r of rows) {
      const def = r.actionCode ? V2_RECOVERY.get(r.actionCode) : undefined
      if (!def) { notInCatalog++; continue }
      if (typeof r.date !== 'string') { noDate++; continue }
      if (typeof r.effect !== 'string' || !V2_EFFECT.has(r.effect as RecoveryEffect)) { badEffect++; continue }
      const rec: RecoveryActionOut = {
        localDate: r.date, timezoneOffsetMinutes: KST,
        source: 'import', schemaVersion: SCHEMA_VERSION,
        createdAt: r.createdAt ?? exportedAt, updatedAt: r.createdAt ?? exportedAt,
        occurredAt: null, code: r.actionCode as string, label: def.label, category: def.category,
        effect: r.effect as RecoveryEffect,
      }
      tables.recoveryActions.push(rec); kept++
    }
    preservedV1Facts.recoveryActions = kept
    drop('recoveryLogs', notInCatalog, 'V2 recovery 카탈로그에 없는 code(재해석 금지)')
    drop('recoveryLogs', badEffect, 'V2 effect enum 과 불일치')
    drop('recoveryLogs', noDate, 'date 없음')
  }

  // ── C) 추정/재해석이 필요한 것은 전부 버림 ─────────────────────────
  const dailyLogs = asArray(t.dailyLogs) as Record<string, unknown>[]
  drop('dailyLogs', dailyLogs.length,
    'V2 StateMeasurement 은 실제 recordedAt(시각)+checkInType 필요; V1 dailyLog 은 날짜만 → 시각·체크인 추정 금지, metric 재해석(max/appetite→physicalHunger 등) 금지')
  drop('dailyLogs.lastNightSleep', dailyLogs.filter((d) => d.lastNightSleep).length,
    'V2 SleepEpisode 는 timestamp 기반; V1 은 duration/quality 만 → 버림(schema 안 바꿈)')
  drop('dailyScores', asArray(t.dailyScores).length, '파생 결과(점수) — 원자료 아님')
  drop('patternInsights', asArray(t.patternInsights).length, '파생 결과(패턴) — 원자료 아님')
  drop('userSettings', asArray(t.userSettings).length,
    '설정은 원자료 사실 아님; toneMode 등 V1 값은 V2 와 1:1 아님 → 앱에서 재설정')

  // ── id 재부여(정상 export 모양) ────────────────────────────────────
  for (const k of V2_STORE_KEYS) {
    tables[k] = tables[k].map((row, i) => ({ ...(row as object), id: i + 1 }))
  }

  const backup: BackupFile = {
    format: 'mode-v2',
    formatVersion: EXPORT_FORMAT_VERSION,
    schemaVersion: APP_SCHEMA_VERSION,
    migrationVersion: MIGRATION_VERSION,
    exportedAt: now,
    tables,
    settings: null,
  }
  return { backup, report: { preservedDirectV2, preservedV1Facts, discarded } }
}
