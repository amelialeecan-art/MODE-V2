import type { ISODate, ISODateTime, Provenance, RatingValue, TimeProvenance } from '@/domain/common/types'

export type ActivityType = 'strength' | 'cardio' | 'walk' | 'other'

export const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = {
  strength: '근력',
  cardio: '유산소',
  walk: '산책',
  other: '기타',
}

/** 운동 episode. "운동함 Y/N" 금지 — 최소 duration 을 가진 구조화 기록. */
export interface ActivityEpisode extends Provenance, TimeProvenance {
  id?: number
  localDate: ISODate
  startedAt: ISODateTime
  durationMinutes: number
  rpe?: RatingValue // 주관적 강도 0~10
  activityType: ActivityType
  steps?: number | null
  note?: string
}

export type ActivityEpisodeInput = Omit<ActivityEpisode, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>
