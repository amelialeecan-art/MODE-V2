import type { ISODate, ISODateTime, Provenance, RatingValue, TimeProvenance, TriBoolean } from '@/domain/common/types'

export type MealAmount = 'small' | 'normal' | 'large' | 'unknown' | null

/** 술: 명확한 ordinal + 선택적 잔 수. 숫자 하나 + 자유 단위 금지. */
export type AlcoholLevel = 'none' | 'light' | 'moderate' | 'heavy' | 'unknown'
export interface AlcoholIntake {
  level: AlcoholLevel
  standardDrinks?: number | null
}

/**
 * 한 끼/간식 = 하나의 episode.
 * physicalHunger / craving / bingeUrge 는 절대 합치지 않는다.
 * UI 표시: craving → "음식 당김".
 */
export interface MealEpisode extends Provenance, TimeProvenance {
  id?: number
  localDate: ISODate
  startedAt: ISODateTime
  endedAt?: ISODateTime | null
  prePhysicalHunger?: RatingValue
  preCraving?: RatingValue
  preBingeUrge?: RatingValue
  amount?: MealAmount
  proteinIncluded?: TriBoolean
  sweetsIncluded?: TriBoolean
  ultraProcessedIncluded?: TriBoolean
  perceivedOvereating?: TriBoolean
  alcohol?: AlcoholIntake | null
  note?: string
}

export type MealEpisodeInput = Omit<MealEpisode, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>
