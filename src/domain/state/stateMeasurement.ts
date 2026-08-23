import type { ISODate, ISODateTime, Provenance, RatingValue, TimeProvenance } from '@/domain/common/types'
import type { CoreMetric } from './coreState'

export type CheckInType = 'morning' | 'evening' | 'adhoc'

/** metric 값 묶음. 안 물어본 metric 은 키 자체가 없다(0 으로 채우지 않는다). */
export type CoreMetricValues = Partial<Record<CoreMetric, RatingValue>>

export interface StateMeasurement extends Provenance, TimeProvenance {
  id?: number
  localDate: ISODate
  recordedAt: ISODateTime
  checkInType: CheckInType
  /**
   * 이 체크인에서 실제로 "물어본" metric.
   * metrics 에 값이 없어도 여기 있으면 "물어봤는데 답 없음(unknown/null)",
   * 여기 없으면 "애초에 안 물어봄(missing)" — 분석기가 구분한다.
   */
  promptedMetrics: CoreMetric[]
  metrics: CoreMetricValues
  note?: string
}

export type StateMeasurementInput = Omit<StateMeasurement, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>
