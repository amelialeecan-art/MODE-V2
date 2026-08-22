/* =====================================================================
   생리 주기 — retrospective 계산. 실제 periodStart 기록만 근거.
   - 평균 28일을 primary inference 로 쓰지 않는다.
   - 관측된 주기 길이(실제 start 간격)만 사용.
   - 확정할 수 없으면 phase='unknown' 으로 남긴다(억지 분류 금지).
   ===================================================================== */
import type { CycleRecord, CyclePhase } from '@/domain/cycle/cycleRecord'
import { addDays, daysBetween } from '@/shared/time/time'
import { median } from '@/shared/statistics/stats'

/** 황체기 길이는 개인차가 있으나 총 주기보다 안정적(~14일). 배란 추정에만 사용. */
const LUTEAL_DAYS = 14

export interface BleedingSpan {
  start: string
  end: string // periodEnd 없으면 start 와 동일(알려진 만큼만)
}

/** 기록에서 실제 출혈 구간을 만든다(periodStart→periodEnd). 없으면 start 하루만. */
export function bleedingSpans(records: CycleRecord[]): BleedingSpan[] {
  const sorted = [...records].sort((a, b) => a.localDate.localeCompare(b.localDate))
  const spans: BleedingSpan[] = []
  let open: string | null = null
  let lastFlowDate: string | null = null
  for (const r of sorted) {
    if (r.periodStart) {
      if (open) spans.push({ start: open, end: lastFlowDate ?? open })
      open = r.localDate
      lastFlowDate = r.localDate
    }
    if (open && (r.flowLevel || r.periodStart)) lastFlowDate = r.localDate
    if (r.periodEnd && open) {
      spans.push({ start: open, end: r.localDate })
      open = null
      lastFlowDate = null
    }
  }
  if (open) spans.push({ start: open, end: lastFlowDate ?? open })
  return spans
}

export interface CycleContext {
  startDates: string[]
  /** 관측된 주기 길이(실제 start 간격). 하나도 없으면 null. */
  observedLengths: number[]
  medianLength: number | null
}

export function cycleContext(records: CycleRecord[]): CycleContext {
  const startDates = records.filter((r) => r.periodStart).map((r) => r.localDate).sort()
  const observedLengths: number[] = []
  for (let i = 1; i < startDates.length; i++) {
    observedLengths.push(daysBetween(startDates[i - 1], startDates[i]))
  }
  return {
    startDates,
    observedLengths,
    medianLength: observedLengths.length ? median(observedLengths) : null,
  }
}

export interface DayCycleInfo {
  /** 마지막 start 이후 경과일(1 = 생리 첫날). start 없으면 null. */
  cycleDay: number | null
  phase: CyclePhase
  /** 다음 예상 생리까지 남은 일수(관측 주기 기반 예측). 근거 부족 시 null. */
  daysUntilNextPredicted: number | null
}

/**
 * 특정 날짜의 주기 정보(retrospective).
 * - menstrual: 실제 출혈 구간 안일 때만.
 * - follicular/luteal: 앞뒤 start 가 모두 알려진(완결) 주기에서만 분할. 진행 중이면 unknown.
 */
export function dayCycleInfo(records: CycleRecord[], date: string): DayCycleInfo {
  const spans = bleedingSpans(records)
  const inBleed = spans.some((s) => date >= s.start && date <= s.end)

  const ctx = cycleContext(records)
  const starts = ctx.startDates
  const s0 = [...starts].reverse().find((s) => s <= date) ?? null // 직전 start
  const s1 = starts.find((s) => s > date) ?? null // 다음 start(있으면 완결 주기)

  const cycleDay = s0 ? daysBetween(s0, date) + 1 : null

  let phase: CyclePhase = 'unknown'
  if (inBleed) {
    phase = 'menstrual'
  } else if (s0 && s1) {
    // 완결 주기: 배란 추정 = 다음 start - LUTEAL_DAYS
    const ovulation = addDays(s1, -LUTEAL_DAYS)
    phase = date >= ovulation ? 'luteal' : 'follicular'
  } else if (s0 && ctx.medianLength) {
    // 진행 중 주기: 관측 주기로 배란 추정(예측이며 primary inference 아님)
    const predictedNext = addDays(s0, ctx.medianLength)
    const ovulation = addDays(predictedNext, -LUTEAL_DAYS)
    if (date >= ovulation && date < predictedNext) phase = 'luteal'
    else if (date < ovulation) phase = 'follicular'
    // predictedNext 를 넘어섰는데 새 start 가 없으면 unknown 유지(지연)
  }

  let daysUntilNextPredicted: number | null = null
  if (s0 && ctx.medianLength) {
    daysUntilNextPredicted = daysBetween(date, addDays(s0, ctx.medianLength))
  }

  return { cycleDay, phase, daysUntilNextPredicted }
}

export const PHASE_LABEL: Record<CyclePhase, string> = {
  menstrual: '생리 중',
  follicular: '난포기',
  luteal: '황체기',
  unknown: '—',
}
