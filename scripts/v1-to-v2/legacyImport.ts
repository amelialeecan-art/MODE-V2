/* =====================================================================
   Legacy migration — 구 MODE export → V2 raw record (1회 변환, 순수 함수)

   원칙:
   - 의미가 동일한 필드만 보존. 이름 비슷하다고 자동 매핑하지 않는다.
   - appetite ≠ physicalHunger → 변환 금지.
   - craving/fatigueHeaviness/painDiscomfort 는 명시적 max() 규칙(conversionVersion).
     이 metric 은 StateMeasurement.conversionRules 에 규칙을 남겨 "직접 측정" 과 구별한다.
   - positiveAffect 는 과거에서 만들어내지 않는다(missing).
   - 수면 timestamp 를 추정하지 않는다(durationMinutes 만).
   - 파생 결과(dailyScores/patternInsights)는 절대 넣지 않는다.
   - event 는 allowlist 만 선별. 시각 없는 legacy 는 전후관계 안 만든다.

   ── 기존 V2 raw 보존 & 충돌 정책 ──────────────────────────────────────
   export 안에는 과거 V1 뿐 아니라 사용자가 신 V2 로 직접 입력한 raw record
   (stateMeasurements/sleepEpisodes/mealEpisodes 등)가 함께 있을 수 있다.
   이들은 이미 V2 원자료이므로 그대로 보존한다(source 유지, 변환 안 함).
   같은 날짜에 V1 변환본과 V2 직접입력이 겹치면 **V2 직접입력이 우선**한다:
     · state  : (localDate, checkInType) 가 같으면 V1 변환본 skip
     · sleep  : localDate 가 같으면 V1 변환본 skip
     · cycle  : localDate 가 같으면 V1 변환본 skip
   → 중복 생성 없음, V2 직접값을 V1 변환값이 덮어쓰지 않음.
   ===================================================================== */
import { CONVERSION_VERSION, SCHEMA_VERSION } from '@/domain/common/types'
import { CONTEXT_EVENT_CATALOG, type ContextCategory, type ContextEvent } from '@/domain/context/contextEvent'
import { RECOVERY_ACTION_CATALOG, type RecoveryCategory, type RecoveryEffect, type RecoveryAction } from '@/domain/recovery/recoveryAction'
import type { CoreMetric } from '@/domain/state/coreState'
import type { CoreMetricValues, StateMeasurement } from '@/domain/state/stateMeasurement'
import type { SleepEpisode } from '@/domain/sleep/sleepEpisode'
import type { MealEpisode, AlcoholIntake } from '@/domain/meal/mealEpisode'
import type { CycleRecord, FlowLevel } from '@/domain/cycle/cycleRecord'
import type { LegacyDailyLog, LegacyExport, LegacyEventLog } from './legacyTypes'

/** 한국어 데이터 → KST(+540) 로 provenance 고정. legacy 는 정확한 시각 불명. */
const LEGACY_TZ = 540

/** legacy 는 시각을 모른다 → 정오 anchor. 분석은 이 record 를 날짜 단위로만 취급. */
function anchorAt(localDate: string): string {
  return `${localDate}T12:00:00.000+09:00`
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** 존재하는 숫자들만 모아 max. 하나도 없으면 undefined(→ 키 없음 = 안 물어봄). */
function maxDefined(...vals: (number | undefined)[]): number | undefined {
  const nums = vals.filter(isNum)
  return nums.length ? Math.max(...nums) : undefined
}

/** metric 단위 변환 규칙 라벨(conversionRules 값). */
const CRAVING_RULE = 'max(sweetCraving,saltyCraving,greasyCraving)'
const FATIGUE_RULE = 'max(fatigue,heaviness)'
const PAIN_RULE = 'max(pain,bodyDiscomfort)'

export interface LegacyImportBundle {
  state: StateMeasurement[]
  sleep: SleepEpisode[]
  meal: MealEpisode[]
  cycle: CycleRecord[]
  context: ContextEvent[]
  recovery: RecoveryAction[]
}

export interface LegacyImportReport {
  counts: { state: number; sleep: number; meal: number; cycle: number; context: number; recovery: number }
  /** export 에서 그대로 보존한 기존 V2 raw record 수. */
  preservedV2: { state: number; sleep: number; meal: number; cycle: number }
  /** 같은 날짜 V2 직접입력 때문에 skip 한 V1 변환본 수. */
  skippedByV2Conflict: { state: number; sleep: number; cycle: number }
  droppedTables: string[]
  droppedEventCodes: Record<string, number>
  keptEventCodes: Record<string, number>
}

export interface LegacyImportResult {
  bundle: LegacyImportBundle
  report: LegacyImportReport
}

const CONTEXT_CODES = new Map(CONTEXT_EVENT_CATALOG.map((d) => [d.code, d]))
const RECOVERY_CODES = new Map(RECOVERY_ACTION_CATALOG.map((d) => [d.code, d]))

function toFlowLevel(v: string | undefined): FlowLevel | null {
  if (!v) return null
  const allowed: FlowLevel[] = ['spotting', 'light', 'normal', 'heavy', 'unknown']
  return (allowed as string[]).includes(v) ? (v as FlowLevel) : null
}

function toRecoveryEffect(v: string | undefined): RecoveryEffect {
  const allowed: RecoveryEffect[] = ['much_better', 'little_better', 'same', 'worse', 'unknown']
  return v && (allowed as string[]).includes(v) ? (v as RecoveryEffect) : 'unknown'
}

/** dailyLog → StateMeasurement metrics + 변환 규칙(§2.1)을 여기서만 정의. */
function convertStateMetrics(d: LegacyDailyLog): {
  metrics: CoreMetricValues
  prompted: CoreMetric[]
  conversionRules: Partial<Record<CoreMetric, string>>
} {
  const metrics: CoreMetricValues = {}
  const prompted: CoreMetric[] = []
  const conversionRules: Partial<Record<CoreMetric, string>> = {}

  const preserve: [CoreMetric, number | undefined][] = [
    ['moodLow', d.moodLow],
    ['anxiety', d.anxiety],
    ['irritability', d.irritability],
    ['energy', d.energy],
    ['focus', d.focus],
    ['impulsivity', d.impulsivity],
    ['bingeUrge', d.bingeUrge],
    ['bloating', d.bloating],
  ]
  for (const [metric, val] of preserve) {
    if (isNum(val)) {
      metrics[metric] = val
      prompted.push(metric)
    }
  }

  // 변환(explicit max) — conversionVersion 1, metric 단위 provenance 남김
  const craving = maxDefined(d.sweetCraving, d.saltyCraving, d.greasyCraving)
  if (craving !== undefined) { metrics.craving = craving; prompted.push('craving'); conversionRules.craving = CRAVING_RULE }

  const fatigueHeaviness = maxDefined(d.fatigue, d.heaviness)
  if (fatigueHeaviness !== undefined) { metrics.fatigueHeaviness = fatigueHeaviness; prompted.push('fatigueHeaviness'); conversionRules.fatigueHeaviness = FATIGUE_RULE }

  const painDiscomfort = maxDefined(d.pain, d.bodyDiscomfort)
  if (painDiscomfort !== undefined) { metrics.painDiscomfort = painDiscomfort; prompted.push('painDiscomfort'); conversionRules.painDiscomfort = PAIN_RULE }

  // appetite → physicalHunger: 변환 금지 (missing).
  // positiveAffect: 과거 추정 금지 (missing).
  // calm/sadness/selfCriticism/headache/digestion: 대응 없음 (버림).
  return { metrics, prompted, conversionRules }
}

/** 구 V2 mealEpisode 의 alcoholAmount(숫자) → 신 alcohol 구조로 정규화. */
function normalizeAlcohol(raw: { alcohol?: unknown; alcoholAmount?: unknown }): AlcoholIntake | null {
  if (raw.alcohol && typeof raw.alcohol === 'object') return raw.alcohol as AlcoholIntake
  const amt = raw.alcoholAmount
  if (amt == null) return null
  if (typeof amt === 'number') {
    if (amt === 0) return { level: 'none' }
    // 구 스키마는 잔 수만 저장 — 잔 수는 보존하되 categorical level 은 기록되지 않았음.
    return { level: 'unknown', standardDrinks: amt }
  }
  return null
}

/** 기존 V2 record 를 신 스키마로 정규화(값 변경 없이 형태만). id/파생 없이 그대로 보존. */
function normalizeV2<T extends { id?: number; source?: string; schemaVersion?: number; createdAt?: string; updatedAt?: string }>(
  raw: T,
  now: string,
): Omit<T, 'id'> {
  const { id: _id, ...rest } = raw
  return {
    ...(rest as object),
    source: (raw.source ?? 'import') as string,
    schemaVersion: SCHEMA_VERSION,
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now,
  } as Omit<T, 'id'>
}

export function migrateLegacyExport(input: LegacyExport): LegacyImportResult {
  const now = new Date().toISOString()
  const t = input.tables ?? {}
  const bundle: LegacyImportBundle = { state: [], sleep: [], meal: [], cycle: [], context: [], recovery: [] }
  const droppedEventCodes: Record<string, number> = {}
  const keptEventCodes: Record<string, number> = {}
  const preservedV2 = { state: 0, sleep: 0, meal: 0, cycle: 0 }
  const skippedByV2Conflict = { state: 0, sleep: 0, cycle: 0 }

  const prov = { source: 'legacy_import' as const, schemaVersion: SCHEMA_VERSION, conversionVersion: CONVERSION_VERSION }

  /* ---- 1) 기존 V2 raw 보존 (먼저 넣어 충돌 판단 기준을 만든다) ---- */
  const v2StateKeys = new Set<string>() // `${localDate}|${checkInType}`
  const v2SleepDates = new Set<string>()
  const v2CycleDates = new Set<string>()

  for (const raw of (t.stateMeasurements ?? []) as StateMeasurement[]) {
    if (!raw?.localDate || !raw.checkInType) continue
    bundle.state.push(normalizeV2(raw, now) as StateMeasurement)
    v2StateKeys.add(`${raw.localDate}|${raw.checkInType}`)
    preservedV2.state++
  }
  for (const raw of (t.sleepEpisodes ?? []) as SleepEpisode[]) {
    if (!raw?.localDate) continue
    bundle.sleep.push({ durationMinutes: null, ...normalizeV2(raw, now) } as SleepEpisode)
    v2SleepDates.add(raw.localDate)
    preservedV2.sleep++
  }
  for (const raw of (t.mealEpisodes ?? []) as (MealEpisode & { alcoholAmount?: number | null })[]) {
    if (!raw?.localDate) continue
    const norm = normalizeV2(raw, now) as MealEpisode & { alcoholAmount?: number | null }
    norm.alcohol = normalizeAlcohol(raw)
    delete (norm as { alcoholAmount?: unknown }).alcoholAmount
    bundle.meal.push(norm as MealEpisode)
    preservedV2.meal++
  }
  for (const raw of (t.cycleRecords ?? []) as CycleRecord[]) {
    // 구 앱은 cycleLogs(V1)만 썼으나, 신 V2 export 는 cycleRecords 를 가질 수 있다.
    if (!raw?.localDate) continue
    bundle.cycle.push(normalizeV2(raw, now) as CycleRecord)
    v2CycleDates.add(raw.localDate)
    preservedV2.cycle++
  }

  /* ---- 2) dailyLogs(V1) → State + Sleep (V2 충돌 시 skip) ---- */
  for (const d of t.dailyLogs ?? []) {
    if (!d?.date) continue
    const { metrics, prompted, conversionRules } = convertStateMetrics(d)
    if (prompted.length > 0) {
      if (v2StateKeys.has(`${d.date}|evening`)) {
        skippedByV2Conflict.state++ // V2 직접입력 우선
      } else {
        bundle.state.push({
          ...prov,
          localDate: d.date,
          timezoneOffsetMinutes: LEGACY_TZ,
          recordedAt: anchorAt(d.date),
          checkInType: 'evening',
          promptedMetrics: prompted,
          metrics,
          ...(Object.keys(conversionRules).length ? { conversionRules } : {}),
          createdAt: d.createdAt ?? now,
          updatedAt: d.updatedAt ?? now,
        })
      }
    }
    // lastNightSleep → SleepEpisode (timestamp 추정 금지)
    const s = d.lastNightSleep
    if (s && (isNum(s.hours) || isNum(s.quality))) {
      if (v2SleepDates.has(d.date)) {
        skippedByV2Conflict.sleep++
      } else {
        bundle.sleep.push({
          ...prov,
          localDate: d.date,
          timezoneOffsetMinutes: LEGACY_TZ,
          wentToBedAt: null,
          sleepOnsetAt: null,
          wakeAt: null,
          awakenings: null,
          satisfaction: isNum(s.quality) ? s.quality : null,
          durationMinutes: isNum(s.hours) ? Math.round(s.hours * 60) : null,
          createdAt: d.createdAt ?? now,
          updatedAt: d.updatedAt ?? now,
        })
      }
    }
  }

  /* ---- 3) cycleLogs(V1) → CycleRecord (V2 충돌 시 skip, 아니면 적극 보존) ---- */
  for (const c of t.cycleLogs ?? []) {
    if (!c?.date) continue
    if (v2CycleDates.has(c.date)) { skippedByV2Conflict.cycle++; continue }
    bundle.cycle.push({
      ...prov,
      localDate: c.date,
      timezoneOffsetMinutes: LEGACY_TZ,
      periodStart: c.periodStart === true,
      periodEnd: c.periodEnd === true,
      flowLevel: toFlowLevel(c.flowLevel),
      painLevel: isNum(c.periodPain) ? c.periodPain : null,
      createdAt: c.createdAt ?? now,
      updatedAt: c.updatedAt ?? now,
    })
  }

  /* ---- 4) eventLogs(V1) → ContextEvent (allowlist 선별) ---- */
  for (const e of (t.eventLogs ?? []) as LegacyEventLog[]) {
    if (!e?.eventCode || !e.date) continue
    const def = CONTEXT_CODES.get(e.eventCode)
    if (!def) {
      droppedEventCodes[e.eventCode] = (droppedEventCodes[e.eventCode] ?? 0) + 1
      continue
    }
    keptEventCodes[e.eventCode] = (keptEventCodes[e.eventCode] ?? 0) + 1
    bundle.context.push({
      ...prov,
      localDate: e.date,
      timezoneOffsetMinutes: LEGACY_TZ,
      occurredAt: null, // 시각 불명 → 전후관계 안 만듦
      code: def.code,
      label: def.label,
      category: def.category as ContextCategory,
      intensity: isNum(e.intensity) ? e.intensity : null,
      approxWindow: e.timing === 'recent3days' ? 'recent3days' : 'today',
      createdAt: e.createdAt ?? now,
      updatedAt: e.createdAt ?? now,
    })
  }

  /* ---- 5) recoveryLogs(V1) → RecoveryAction ---- */
  for (const r of t.recoveryLogs ?? []) {
    if (!r?.actionCode || !r.date) continue
    const def = RECOVERY_CODES.get(r.actionCode)
    bundle.recovery.push({
      ...prov,
      localDate: r.date,
      timezoneOffsetMinutes: LEGACY_TZ,
      occurredAt: null,
      code: r.actionCode,
      label: def?.label ?? r.actionLabel ?? r.actionCode,
      category: (def?.category ?? 'body') as RecoveryCategory,
      effect: toRecoveryEffect(r.effect),
      createdAt: r.createdAt ?? now,
      updatedAt: r.createdAt ?? now,
    })
  }

  // 폐기 테이블 기록(§3 · §11) — 파생 결과는 절대 bundle 에 넣지 않는다.
  const droppedTables = ['dailyScores', 'patternInsights'].filter((k) => Array.isArray(t[k]) && (t[k] as unknown[]).length > 0)

  return {
    bundle,
    report: {
      counts: {
        state: bundle.state.length,
        sleep: bundle.sleep.length,
        meal: bundle.meal.length,
        cycle: bundle.cycle.length,
        context: bundle.context.length,
        recovery: bundle.recovery.length,
      },
      preservedV2,
      skippedByV2Conflict,
      droppedTables,
      droppedEventCodes,
      keptEventCodes,
    },
  }
}
