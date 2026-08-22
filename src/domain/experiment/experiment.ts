import type { ISODate, ISODateTime, Provenance } from '@/domain/common/types'
import type { CoreMetric } from '@/domain/state/coreState'

/** 생활요인만. 의료 치료 변경(약 중단/용량)은 실험으로 제안하지 않는다. */
export type ExperimentInterventionCode =
  | 'reduce_prebed_screen'
  | 'consistent_bedtime'
  | 'morning_light'
  | 'protein_with_meals'
  | 'avoid_late_caffeine'
  | 'daily_walk'
  | 'custom_lifestyle'

export const INTERVENTION_LABEL: Record<ExperimentInterventionCode, string> = {
  reduce_prebed_screen: '취침 전 화면 줄이기',
  consistent_bedtime: '일정한 취침 시각',
  morning_light: '아침 햇빛 보기',
  protein_with_meals: '식사에 단백질',
  avoid_late_caffeine: '늦은 카페인 피하기',
  daily_walk: '매일 걷기',
  custom_lifestyle: '직접 정한 습관',
}

export type ExperimentStatus = 'planned' | 'baseline' | 'intervention' | 'completed' | 'abandoned'

export interface Experiment extends Provenance {
  id?: number
  title: string
  targetMetric: CoreMetric
  interventionCode: ExperimentInterventionCode
  baselineStart: ISODate
  baselineEnd: ISODate
  interventionStart: ISODate
  interventionEnd: ISODate
  status: ExperimentStatus
  note?: string
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export type ExperimentInput = Omit<Experiment, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>
