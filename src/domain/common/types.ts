/* =====================================================================
   MODE V2 · 공통 원시 타입 (raw-first)

   불변 규약:
   - 0 / missing / unknown 을 절대 섞지 않는다.
       · 0          = 측정했고 실제로 없음/낮음
       · missing    = 키 자체가 없음 = 안 물어봄
       · 'unknown'  = 물어봤으나 판단 못 함
   - 파생값은 저장하지 않는다. 이 파일은 순수 타입/상수뿐.
   ===================================================================== */

/** 'YYYY-MM-DD' 로컬 날짜. */
export type ISODate = string

/** absolute ISO datetime 문자열 (예: 2026-08-22T21:03:00.000+09:00). */
export type ISODateTime = string

/**
 * 데이터 출처(provenance). 분석기가 신뢰도/처리방식을 달리하는 근거.
 * V1 fallback 을 위한 값이 아니라, record 가 어디서 왔는지 표시만 한다.
 */
export type DataSource =
  | 'manual' // 사용자가 직접 입력 (신규)
  | 'import' // 백업 JSON 복원
  | 'legacy_import' // 구 MODE export 를 1회 변환
  | 'derived' // 앱이 계산 (거의 안 씀 — 파생은 원칙적으로 저장 안 함)

/**
 * rating 값 — 반드시 셋 중 하나. 0 으로 임의 보정하지 않는다.
 * - number: 0~10 정수
 * - 'unknown': 측정했으나 모름
 * - null: 측정 안 함(이 값이 명시적으로 들어갔을 때). 보통은 아예 키가 없음(missing).
 */
export type RatingValue = number | 'unknown' | null

/** 사실 boolean 도 0/null/unknown 과 같은 삼분 원칙. */
export type TriBoolean = boolean | 'unknown' | null

/** 현재 record 형태 스키마 버전. 형태가 실제로 바뀔 때만 올린다. */
export const SCHEMA_VERSION = 1

/** legacy_import 변환 규칙 버전. 변환 공식이 바뀌면 올린다. */
export const CONVERSION_VERSION = 1

/** 모든 raw record 가 공유하는 provenance 필드. */
export interface Provenance {
  source: DataSource
  schemaVersion: number
  /** legacy_import 일 때만 존재. */
  conversionVersion?: number
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

/** timestamp 기반 raw record 가 공유하는 시간 provenance. */
export interface TimeProvenance {
  localDate: ISODate
  /** UTC 대비 분 (KST = +540). recordedAt/occurredAt 해석 근거. */
  timezoneOffsetMinutes: number
}

/** RatingValue 가 유효한 수치(0~10)인지. */
export function isNumericRating(v: RatingValue | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 10
}

/** rating 유효성 검사 (0~10 정수 / 'unknown' / null). */
export function isValidRating(v: unknown): v is RatingValue {
  if (v === null || v === 'unknown') return true
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 10
}
