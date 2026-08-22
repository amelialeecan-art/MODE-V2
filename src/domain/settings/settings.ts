import type { ISODateTime } from '@/domain/common/types'

/** 말투. 실제 UI 전체에 작동한다(작동 안 하는 setting 은 만들지 않는다). */
export type ToneMode = 'banmal' | 'haeyo'

export interface AppSettings {
  /** 생리 입력/분석 노출 여부. */
  cycleEnabled: boolean
  toneMode: ToneMode
}

export const DEFAULT_SETTINGS: AppSettings = {
  cycleEnabled: true,
  toneMode: 'banmal',
}

/** DB 단일 메타 레코드. 파생 cache 없이도 앱이 복원되도록 raw 중심. */
export interface AppMeta {
  id?: number
  schemaVersion: number
  migrationVersion: number
  lastBackupAt?: ISODateTime | null
  settings: AppSettings
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

/** raw record 형태 스키마 버전(도메인). */
export const APP_SCHEMA_VERSION = 1
/** 데이터 마이그레이션(변환 파이프라인) 버전. */
export const MIGRATION_VERSION = 1
