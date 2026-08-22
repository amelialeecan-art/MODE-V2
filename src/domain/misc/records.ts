import type { ISODate, ISODateTime, Provenance, RatingValue, TimeProvenance, TriBoolean } from '@/domain/common/types'

/* --- Medication --- */
export interface MedicationProfile {
  id?: number
  name: string
  defaultDose?: number | null
  doseUnit?: string | null
  active: boolean
  createdAt: ISODateTime
  updatedAt: ISODateTime
}
export interface MedicationDose extends Provenance, TimeProvenance {
  id?: number
  medicationId: number
  localDate: ISODate
  takenAt: ISODateTime
  dose?: number | null
}
export type MedicationDoseInput = Omit<MedicationDose, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>

/* --- HealthException — 분석엔 category 만 사용 --- */
export type HealthExceptionCategory =
  | 'illness' | 'fever' | 'gi_illness' | 'travel' | 'all_nighter'
  | 'jet_lag' | 'vaccination' | 'procedure' | 'injury' | 'other'

export const HEALTH_EXCEPTION_LABEL: Record<HealthExceptionCategory, string> = {
  illness: '아픔', fever: '발열', gi_illness: '장염·배탈', travel: '여행', all_nighter: '밤샘',
  jet_lag: '시차', vaccination: '예방접종', procedure: '시술', injury: '부상', other: '기타',
}

export interface HealthException extends Provenance, TimeProvenance {
  id?: number
  localDate: ISODate
  occurredAt?: ISODateTime | null
  category: HealthExceptionCategory
  intensity?: RatingValue
  customLabel?: string
}
export type HealthExceptionInput = Omit<HealthException, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>

/* --- ScreenExposure — 분(minutes) 기반. 웹에서 자동 수집 시도 안 함 --- */
export interface ScreenExposure extends Provenance, TimeProvenance {
  id?: number
  localDate: ISODate
  totalMinutes?: number | null
  socialMinutes?: number | null
  shortFormMinutes?: number | null
  /** 취침 전 2시간 화면 분 — 최우선 관심 변수. */
  preBed2hMinutes?: number | null
  lastScreenAt?: ISODateTime | null
}
export type ScreenExposureInput = Omit<ScreenExposure, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>

/* --- WeightMeasurement --- */
export interface WeightMeasurement extends Provenance, TimeProvenance {
  id?: number
  measuredAt: ISODateTime
  localDate: ISODate
  weightKg: number
  /** 몸무게를 본 행위 자체가 심리적 exposure 가 될 수 있어 별도 필드. */
  userSawWeight?: TriBoolean
}
export type WeightMeasurementInput = Omit<WeightMeasurement, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>
