/* 구 MODE export(mode-export-*.json) 의 느슨한 타입. 읽기 전용 참조. */

export interface LegacyExport {
  app?: string
  version?: number
  exportedAt?: string
  tables: LegacyTables
}

export interface LegacyTables {
  dailyLogs?: LegacyDailyLog[]
  cycleLogs?: LegacyCycleLog[]
  eventLogs?: LegacyEventLog[]
  recoveryLogs?: LegacyRecoveryLog[]
  // 아래는 파생 결과 — 읽되 절대 변환하지 않는다.
  dailyScores?: unknown[]
  patternInsights?: unknown[]
  userSettings?: LegacyUserSettings[]
  [k: string]: unknown
}

export interface LegacyLastNightSleep {
  hours?: number
  quality?: number
  issues?: string[]
}

export interface LegacyDailyLog {
  id?: number
  date: string
  moodLow?: number
  anxiety?: number
  irritability?: number
  sadness?: number
  heaviness?: number
  calm?: number
  energy?: number
  focus?: number
  selfCriticism?: number
  impulsivity?: number
  appetite?: number
  sweetCraving?: number
  saltyCraving?: number
  greasyCraving?: number
  bingeUrge?: number
  bodyDiscomfort?: number
  pain?: number
  bloating?: number
  fatigue?: number
  headache?: number
  digestion?: number
  lastNightSleep?: LegacyLastNightSleep | null
  createdAt?: string
  updatedAt?: string
}

export interface LegacyCycleLog {
  id?: number
  date: string
  periodStart?: boolean
  periodEnd?: boolean
  flowLevel?: string
  periodPain?: number
  createdAt?: string
  updatedAt?: string
}

export interface LegacyEventLog {
  id?: number
  date: string
  eventCode: string
  eventLabel?: string
  category?: string
  timing?: string
  intensity?: number
  isCustom?: boolean
  createdAt?: string
}

export interface LegacyRecoveryLog {
  id?: number
  date: string
  actionCode: string
  actionLabel?: string
  category?: string
  effect?: string
  direction?: string
  createdAt?: string
}

export interface LegacyUserSettings {
  cycleEnabled?: boolean
  averageCycleLength?: number
  toneMode?: string
  reminderEnabled?: boolean
}
