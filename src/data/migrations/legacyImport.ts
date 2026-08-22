/* =====================================================================
   Legacy migration — 구 MODE export → V2 raw record (1회 변환, 순수 함수)

   원칙:
   - 의미가 동일한 필드만 보존. 이름 비슷하다고 자동 매핑하지 않는다.
   - appetite ≠ physicalHunger → 변환 금지.
   - craving/fatigueHeaviness/painDiscomfort 는 명시적 max() 규칙(conversionVersion).
   - positiveAffect 는 과거에서 만들어내지 않는다(missing).
   - 수면 timestamp 를 추정하지 않는다(durationMinutes 만).
   - 파생 결과(dailyScores/patternInsights)는 절대 넣지 않는다.
   - event 는 allowlist 만 선별. 시각 없는 legacy 는 전후관계 안 만든다.
   ===================================================================== */
import { CONVERSION_VERSION, SCHEMA_VERSION } from '@/domain/common/types'
import { CONTEXT_EVENT_CATALOG, type ContextCategory, type ContextEvent } from '@/domain/context/contextEvent'
import { RECOVERY_ACTION_CATALOG, type RecoveryCategory, type RecoveryEffect, type RecoveryAction } from '@/domain/recovery/recoveryAction'
import type { CoreMetric } from '@/domain/state/coreState'
import type { CoreMetricValues, StateMeasurement } from '@/domain/state/stateMeasurement'
import type { SleepEpisode } from '@/domain/sleep/sleepEpisode'
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

export interface LegacyImportBundle {
  state: StateMeasurement[]
  sleep: SleepEpisode[]
  cycle: CycleRecord[]
  context: ContextEvent[]
  recovery: RecoveryAction[]
}

export interface LegacyImportReport {
  counts: { state: number; sleep: number; cycle: number; context: number; recovery: number }
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

/** dailyLog → StateMeasurement metrics. 보존/변환 규칙(§2.1)을 여기서만 정의. */
function convertStateMetrics(d: LegacyDailyLog): { metrics: CoreMetricValues; prompted: CoreMetric[] } {
  const metrics: CoreMetricValues = {}
  const prompted: CoreMetric[] = []

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

  // 변환(explicit max) — conversionVersion 1
  const craving = maxDefined(d.sweetCraving, d.saltyCraving, d.greasyCraving)
  if (craving !== undefined) { metrics.craving = craving; prompted.push('craving') }

  const fatigueHeaviness = maxDefined(d.fatigue, d.heaviness)
  if (fatigueHeaviness !== undefined) { metrics.fatigueHeaviness = fatigueHeaviness; prompted.push('fatigueHeaviness') }

  const painDiscomfort = maxDefined(d.pain, d.bodyDiscomfort)
  if (painDiscomfort !== undefined) { metrics.painDiscomfort = painDiscomfort; prompted.push('painDiscomfort') }

  // appetite → physicalHunger: 변환 금지 (missing).
  // positiveAffect: 과거 추정 금지 (missing).
  // calm/sadness/selfCriticism/headache/digestion: 대응 없음 (버림).
  return { metrics, prompted }
}

export function migrateLegacyExport(input: LegacyExport): LegacyImportResult {
  const now = new Date().toISOString()
  const t = input.tables ?? {}
  const bundle: LegacyImportBundle = { state: [], sleep: [], cycle: [], context: [], recovery: [] }
  const droppedEventCodes: Record<string, number> = {}
  const keptEventCodes: Record<string, number> = {}

  const prov = { source: 'legacy_import' as const, schemaVersion: SCHEMA_VERSION, conversionVersion: CONVERSION_VERSION }

  // --- dailyLogs → State + Sleep ---
  for (const d of t.dailyLogs ?? []) {
    if (!d?.date) continue
    const { metrics, prompted } = convertStateMetrics(d)
    if (prompted.length > 0) {
      bundle.state.push({
        ...prov,
        localDate: d.date,
        timezoneOffsetMinutes: LEGACY_TZ,
        recordedAt: anchorAt(d.date),
        checkInType: 'evening',
        promptedMetrics: prompted,
        metrics,
        createdAt: d.createdAt ?? now,
        updatedAt: d.updatedAt ?? now,
      })
    }
    // lastNightSleep → SleepEpisode (timestamp 추정 금지)
    const s = d.lastNightSleep
    if (s && (isNum(s.hours) || isNum(s.quality))) {
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

  // --- cycleLogs → CycleRecord (적극 보존) ---
  for (const c of t.cycleLogs ?? []) {
    if (!c?.date) continue
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

  // --- eventLogs → ContextEvent (allowlist 선별) ---
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

  // --- recoveryLogs → RecoveryAction ---
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

  // 폐기 테이블 기록(§3 · §11)
  const droppedTables = ['dailyScores', 'patternInsights'].filter((k) => Array.isArray(t[k]) && (t[k] as unknown[]).length > 0)

  return {
    bundle,
    report: {
      counts: {
        state: bundle.state.length,
        sleep: bundle.sleep.length,
        cycle: bundle.cycle.length,
        context: bundle.context.length,
        recovery: bundle.recovery.length,
      },
      droppedTables,
      droppedEventCodes,
      keptEventCodes,
    },
  }
}
