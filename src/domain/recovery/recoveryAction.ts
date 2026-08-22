import type { ISODate, ISODateTime, Provenance, TimeProvenance } from '@/domain/common/types'

/** 사용자가 보고한 효과(사실). 'unknown' = 잘 모르겠음. */
export type RecoveryEffect = 'much_better' | 'little_better' | 'same' | 'worse' | 'unknown'

export const RECOVERY_EFFECT_LABEL: Record<RecoveryEffect, string> = {
  much_better: '훨씬 나아짐',
  little_better: '조금 나아짐',
  same: '그대로',
  worse: '더 나빠짐',
  unknown: '모르겠음',
}

export type RecoveryCategory = 'body' | 'relationship' | 'rest' | 'reality'

/** "무엇을 했을 때 달랐지" 재료. 회복점수로 압축하지 않는다 — 사실 기록. */
export interface RecoveryAction extends Provenance, TimeProvenance {
  id?: number
  localDate: ISODate
  occurredAt?: ISODateTime | null
  code: string
  label: string
  category: RecoveryCategory
  effect: RecoveryEffect
  note?: string
}

export type RecoveryActionInput = Omit<RecoveryAction, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>

export interface RecoveryActionDef {
  code: string
  label: string
  category: RecoveryCategory
}

export const RECOVERY_ACTION_CATALOG: RecoveryActionDef[] = [
  { code: 'rest', label: '휴식', category: 'rest' },
  { code: 'sleep', label: '잠', category: 'rest' },
  { code: 'nap', label: '낮잠', category: 'rest' },
  { code: 'lying_down', label: '누워있기', category: 'rest' },
  { code: 'shower', label: '샤워', category: 'body' },
  { code: 'warm_food', label: '따뜻한 음식', category: 'body' },
  { code: 'protein', label: '단백질 식사', category: 'body' },
  { code: 'exercise', label: '운동', category: 'body' },
  { code: 'walk', label: '산책', category: 'body' },
  { code: 'stretch', label: '스트레칭', category: 'body' },
  { code: 'clean', label: '청소', category: 'body' },
  { code: 'talk_family', label: '가족과 대화', category: 'relationship' },
  { code: 'talk_partner', label: '파트너와 대화', category: 'relationship' },
  { code: 'talk_friend', label: '친구와 대화', category: 'relationship' },
  { code: 'alone', label: '혼자 있기', category: 'reality' },
  { code: 'delay_reply', label: '답장 미루기', category: 'reality' },
]

export const RECOVERY_CATEGORY_LABEL: Record<RecoveryCategory, string> = {
  body: '몸',
  relationship: '관계',
  rest: '쉼',
  reality: '거리두기',
}
