/* =====================================================================
   MODE V2 · 단일 DB (Dexie / IndexedDB)
   - V2 raw store 만 존재. V1 테이블/호환 store 없음.
   - 파생값(점수/phase/baseline)은 저장하지 않는다.
   ===================================================================== */
import Dexie, { type Table } from 'dexie'
import type {
  StateMeasurement, SleepEpisode, MealEpisode, ActivityEpisode, CycleRecord,
  ContextEvent, RecoveryAction, MedicationProfile, MedicationDose, HealthException,
  ScreenExposure, WeightMeasurement, Experiment, AppMeta,
} from '@/domain'

export const DB_NAME = 'mode-v2'
export const DB_VERSION = 1

export class ModeDB extends Dexie {
  stateMeasurements!: Table<StateMeasurement, number>
  sleepEpisodes!: Table<SleepEpisode, number>
  mealEpisodes!: Table<MealEpisode, number>
  activityEpisodes!: Table<ActivityEpisode, number>
  cycleRecords!: Table<CycleRecord, number>
  contextEvents!: Table<ContextEvent, number>
  recoveryActions!: Table<RecoveryAction, number>
  medicationProfiles!: Table<MedicationProfile, number>
  medicationDoses!: Table<MedicationDose, number>
  healthExceptions!: Table<HealthException, number>
  screenExposures!: Table<ScreenExposure, number>
  weightMeasurements!: Table<WeightMeasurement, number>
  experiments!: Table<Experiment, number>
  appMeta!: Table<AppMeta, number>

  constructor(name: string = DB_NAME) {
    super(name)
    this.version(DB_VERSION).stores({
      // 인덱스만 선언. 비인덱스 필드는 자유롭게 저장.
      stateMeasurements: '++id, localDate, recordedAt, checkInType, source',
      sleepEpisodes: '++id, localDate, source',
      mealEpisodes: '++id, localDate, startedAt, source',
      activityEpisodes: '++id, localDate, startedAt, source',
      cycleRecords: '++id, localDate, source',
      contextEvents: '++id, localDate, code, category, source',
      recoveryActions: '++id, localDate, code, category, source',
      medicationProfiles: '++id, name, active',
      medicationDoses: '++id, localDate, medicationId, source',
      healthExceptions: '++id, localDate, category, source',
      screenExposures: '++id, localDate, source',
      weightMeasurements: '++id, localDate, measuredAt, source',
      experiments: '++id, status, targetMetric',
      appMeta: '++id',
    })
  }
}

/** 앱 런타임 단일 인스턴스. 테스트는 new ModeDB(uniqueName) 로 격리 생성. */
export const db = new ModeDB()
