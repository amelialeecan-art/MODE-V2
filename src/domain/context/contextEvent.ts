import type { ISODate, ISODateTime, Provenance, RatingValue, TimeProvenance } from '@/domain/common/types'

/** 스트레스/생활 맥락 event 카테고리. */
export type ContextCategory = 'work' | 'relationship' | 'control' | 'environment' | 'movement'

/**
 * 스트레스/생활 사건. occurredAt 이 있으면 시각 사용, 없으면(legacy) 날짜 단위로만.
 * approxWindow='recent3days' 는 "정확한 날짜 불명" 표시 → 같은날 association 제외.
 */
export interface ContextEvent extends Provenance, TimeProvenance {
  id?: number
  localDate: ISODate
  occurredAt?: ISODateTime | null
  code: string
  label: string
  category: ContextCategory
  intensity?: RatingValue
  approxWindow?: 'today' | 'recent3days' | null
  note?: string
}

export type ContextEventInput = Omit<ContextEvent, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>

/** 신규 입력용 카탈로그. (사용자에게 보이는 라벨 = 단일 출처) */
export interface ContextEventDef {
  code: string
  label: string
  category: ContextCategory
}

export const CONTEXT_EVENT_CATALOG: ContextEventDef[] = [
  { code: 'work_heavy', label: '일이 많았음', category: 'work' },
  { code: 'work_pressure', label: '마감·압박', category: 'work' },
  { code: 'reply_stress', label: '연락·답장 스트레스', category: 'relationship' },
  { code: 'conflict', label: '사람과 갈등', category: 'relationship' },
  { code: 'social_comparison', label: '사회적 비교', category: 'relationship' },
  { code: 'long_alone', label: '혼자 오래 있음', category: 'relationship' },
  { code: 'crowded', label: '사람 많음', category: 'relationship' },
  { code: 'failure_mistake', label: '실패·실수', category: 'control' },
  { code: 'not_my_way', label: '내 뜻대로 안 됨', category: 'control' },
  { code: 'upcoming_stress', label: '앞둔 일 스트레스', category: 'control' },
  { code: 'new_burden', label: '부담 일정 생김', category: 'control' },
  { code: 'plan_disrupted', label: '계획 틀어짐', category: 'control' },
  { code: 'weather_gloomy', label: '날씨 흐림', category: 'environment' },
  { code: 'low_sunlight', label: '햇빛 부족', category: 'environment' },
  { code: 'noise_space', label: '소음·공간 스트레스', category: 'environment' },
  { code: 'messy_home', label: '집 지저분함', category: 'environment' },
  { code: 'cramped', label: '공간 답답함', category: 'environment' },
  { code: 'stayed_in', label: '집에만 있었음', category: 'environment' },
  { code: 'moved_lot', label: '이동이 많았음', category: 'movement' },
  { code: 'exercised', label: '운동함', category: 'movement' },
  { code: 'walked', label: '산책함', category: 'movement' },
]

export const CONTEXT_CATEGORY_LABEL: Record<ContextCategory, string> = {
  work: '일',
  relationship: '관계',
  control: '통제감',
  environment: '환경',
  movement: '움직임',
}
