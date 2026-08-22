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
  /**
   * metric 단위 변환 provenance. 여기 키가 있는 metric 은 "직접 측정" 이 아니라
   * legacy 원자료에서 규칙으로 파생된 값이다(예: craving = max(sweet,salty,greasy)).
   * 직접 측정값에는 이 키가 없다 → 분석에서 직접값/legacy 변환값을 구별할 수 있다.
   * manual 신규 입력은 항상 이 필드가 비어 있다.
   */
  conversionRules?: Partial<Record<CoreMetric, string>>
  note?: string
}

export type StateMeasurementInput = Omit<StateMeasurement, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>

/** metric 이 직접 측정값인지(= legacy 파생이 아닌지). */
export function isDirectlyMeasured(m: Pick<StateMeasurement, 'conversionRules'>, metric: CoreMetric): boolean {
  return m.conversionRules?.[metric] === undefined
}
