/* =====================================================================
   Core State — 13 metric 카탈로그 (순수 데이터)
   기존 V2 의 12 metric + positiveAffect.
   긍정/부정 정서를 한 직선 양끝으로 만들지 않는다: 각 metric 은 독립 변수.
   ===================================================================== */

/** 고정 core metric 13개. 이름은 CORE_METRICS_SCHEMA_VERSION 내에서 불변. */
export const CORE_METRICS = [
  'moodLow',
  'positiveAffect',
  'anxiety',
  'irritability',
  'energy',
  'focus',
  'impulsivity',
  'physicalHunger',
  'craving',
  'bingeUrge',
  'fatigueHeaviness',
  'bloating',
  'painDiscomfort',
] as const

export type CoreMetric = (typeof CORE_METRICS)[number]

export const CORE_METRICS_SCHEMA_VERSION = 1

export interface CoreStateMeta {
  metric: CoreMetric
  /** 사용자 표시명(한국어). 내부 영어 변수명을 UI 에 노출하지 않기 위한 단일 출처. */
  label: string
  /** 0 의 의미 / 10 의 의미. */
  lowLabel: string
  highLabel: string
  /**
   * 방향. 'symptom' = 높을수록 부담(0 좋음), 'capacity' = 높을수록 좋음(0 나쁨),
   * 'positive' = 높을수록 좋은 긍정정서.
   * baseline delta 를 사람에게 좋음/나쁨으로 해석할 때만 쓰고, 통계 자체는 방향 무관.
   */
  valence: 'symptom' | 'capacity' | 'positive'
}

/** 표시 순서 = CORE_METRICS 순서. */
export const CORE_STATE_META: Record<CoreMetric, CoreStateMeta> = {
  moodLow: { metric: 'moodLow', label: '기분 저하', lowLabel: '없음', highLabel: '매우 심함', valence: 'symptom' },
  positiveAffect: { metric: 'positiveAffect', label: '긍정 정서', lowLabel: '거의 없음', highLabel: '매우 좋음', valence: 'positive' },
  anxiety: { metric: 'anxiety', label: '불안', lowLabel: '없음', highLabel: '매우 심함', valence: 'symptom' },
  irritability: { metric: 'irritability', label: '짜증', lowLabel: '없음', highLabel: '매우 심함', valence: 'symptom' },
  energy: { metric: 'energy', label: '에너지', lowLabel: '매우 낮음', highLabel: '매우 높음', valence: 'capacity' },
  focus: { metric: 'focus', label: '집중', lowLabel: '매우 낮음', highLabel: '매우 높음', valence: 'capacity' },
  impulsivity: { metric: 'impulsivity', label: '충동성', lowLabel: '없음', highLabel: '매우 강함', valence: 'symptom' },
  physicalHunger: { metric: 'physicalHunger', label: '배고픔', lowLabel: '없음', highLabel: '매우 강함', valence: 'symptom' },
  craving: { metric: 'craving', label: '음식 당김', lowLabel: '없음', highLabel: '매우 강함', valence: 'symptom' },
  bingeUrge: { metric: 'bingeUrge', label: '폭식 충동', lowLabel: '없음', highLabel: '매우 강함', valence: 'symptom' },
  fatigueHeaviness: { metric: 'fatigueHeaviness', label: '피로·몸 무거움', lowLabel: '없음', highLabel: '매우 심함', valence: 'symptom' },
  bloating: { metric: 'bloating', label: '복부 팽만', lowLabel: '없음', highLabel: '매우 심함', valence: 'symptom' },
  painDiscomfort: { metric: 'painDiscomfort', label: '통증·불편감', lowLabel: '없음', highLabel: '매우 심함', valence: 'symptom' },
}

export const CORE_STATE_ORDER: CoreMetric[] = [...CORE_METRICS]

/**
 * 아침 체크인 기본 질문. 여기 없는 metric 은 아침에 "안 물어봄"(0 으로 채우지 않음).
 * 기상 직후라 craving/bingeUrge/impulsivity/painDiscomfort 는 기본에서 뺀다.
 */
export const MORNING_PROMPTED: CoreMetric[] = [
  'moodLow',
  'positiveAffect',
  'anxiety',
  'irritability',
  'energy',
  'focus',
  'physicalHunger',
  'fatigueHeaviness',
  'bloating',
]

/** 저녁 체크인 기본 질문 = 전체 13개. */
export const EVENING_PROMPTED: CoreMetric[] = [...CORE_METRICS]

export function promptedMetricsFor(checkInType: 'morning' | 'evening'): CoreMetric[] {
  return checkInType === 'morning' ? [...MORNING_PROMPTED] : [...EVENING_PROMPTED]
}

export function metricLabel(metric: CoreMetric): string {
  return CORE_STATE_META[metric].label
}
