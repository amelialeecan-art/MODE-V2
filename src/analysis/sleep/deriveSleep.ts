/* 수면 파생 — timestamp 우선, 없으면 durationMinutes fallback. 추정 금지. */
import type { SleepEpisode, SleepDerived } from '@/domain/sleep/sleepEpisode'
import { minutesBetween } from '@/shared/time/time'

export function deriveSleep(ep: SleepEpisode): SleepDerived {
  const timeInBed = minutesBetween(ep.wentToBedAt, ep.wakeAt)
  const sleepLatency = minutesBetween(ep.wentToBedAt, ep.sleepOnsetAt)
  let sleepDuration = minutesBetween(ep.sleepOnsetAt, ep.wakeAt)
  if (sleepDuration == null && typeof ep.durationMinutes === 'number') {
    sleepDuration = ep.durationMinutes // legacy: 시각 없이 총 수면시간만
  }
  return { timeInBed, sleepLatency, sleepDuration }
}
