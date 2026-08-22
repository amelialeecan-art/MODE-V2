import type { ISODate, ISODateTime, Provenance, RatingValue, TimeProvenance } from '@/domain/common/types'

/**
 * 수면 episode. timestamp 3개(옵션) 로 파생 계산.
 * timestamp 가 없으면(legacy) durationMinutes 만 신뢰 — 시각을 만들어내지 않는다.
 */
export interface SleepEpisode extends Provenance, TimeProvenance {
  id?: number
  localDate: ISODate // 깨어난 날짜에 귀속
  wentToBedAt?: ISODateTime | null
  sleepOnsetAt?: ISODateTime | null
  wakeAt?: ISODateTime | null
  awakenings?: number | null
  satisfaction?: RatingValue
  /** timestamp 가 없을 때(legacy)만 사용하는 fallback 총 수면시간(분). */
  durationMinutes?: number | null
}

export type SleepEpisodeInput = Omit<SleepEpisode, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>

/** raw 에서 파생: timestamp 우선, 없으면 durationMinutes fallback. 계산 불가면 null. */
export interface SleepDerived {
  timeInBed: number | null
  sleepLatency: number | null
  sleepDuration: number | null
}
