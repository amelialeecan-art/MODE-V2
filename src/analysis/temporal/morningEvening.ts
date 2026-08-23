/* =====================================================================
   아침 → 저녁 변화(paired). 같은 날 morning/evening 이 모두 있을 때만.
   ===================================================================== */
import type { CoreMetric } from '@/domain/state/coreState'
import type { StateMeasurement } from '@/domain/state/stateMeasurement'
import { isNumericRating } from '@/domain/common/types'
import { mean, round1 } from '@/shared/statistics/stats'

export interface DayPair {
  localDate: string
  morning: number
  evening: number
  change: number // evening - morning
}

export function morningEveningPairs(measurements: StateMeasurement[], metric: CoreMetric): DayPair[] {
  const byDate = new Map<string, { morning?: number; evening?: number }>()
  for (const m of measurements) {
    if (m.checkInType === 'adhoc') continue
    const v = m.metrics[metric]
    if (!isNumericRating(v)) continue
    const slot = byDate.get(m.localDate) ?? {}
    if (m.checkInType === 'morning') slot.morning = v
    else if (m.checkInType === 'evening') slot.evening = v
    byDate.set(m.localDate, slot)
  }
  const pairs: DayPair[] = []
  for (const [localDate, { morning, evening }] of byDate) {
    if (morning == null || evening == null) continue
    pairs.push({ localDate, morning, evening, change: evening - morning })
  }
  return pairs.sort((a, b) => a.localDate.localeCompare(b.localDate))
}

export interface MorningEveningSummary {
  metric: CoreMetric
  n: number
  avgMorning: number
  avgEvening: number
  avgChange: number
}

export function morningEveningSummary(
  measurements: StateMeasurement[],
  metric: CoreMetric,
): MorningEveningSummary | null {
  const pairs = morningEveningPairs(measurements, metric)
  if (pairs.length < 2) return null
  return {
    metric,
    n: pairs.length,
    avgMorning: round1(mean(pairs.map((p) => p.morning))),
    avgEvening: round1(mean(pairs.map((p) => p.evening))),
    avgChange: round1(mean(pairs.map((p) => p.change))),
  }
}
