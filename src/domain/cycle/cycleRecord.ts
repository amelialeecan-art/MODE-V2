import type { ISODate, Provenance, RatingValue, TimeProvenance } from '@/domain/common/types'

export type FlowLevel = 'spotting' | 'light' | 'normal' | 'heavy' | 'unknown'

export const FLOW_LEVEL_LABEL: Record<FlowLevel, string> = {
  spotting: '아주 적음',
  light: '적음',
  normal: '보통',
  heavy: '많음',
  unknown: '모름',
}

/**
 * 생리 = 사실만 기록. PMS/배란기/황체기를 직접 고르게 하지 않는다.
 * phase 는 저장하지 않고, 실제 periodStart 기록으로부터 retrospective 계산한다.
 */
export interface CycleRecord extends Provenance, TimeProvenance {
  id?: number
  localDate: ISODate
  periodStart?: boolean
  periodEnd?: boolean
  flowLevel?: FlowLevel | null
  painLevel?: RatingValue
  note?: string
}

export type CycleRecordInput = Omit<CycleRecord, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>

/** 엔진이 계산하는 phase(저장 안 함). unknown = 계산 근거 부족. */
export type CyclePhase = 'menstrual' | 'follicular' | 'luteal' | 'unknown'
