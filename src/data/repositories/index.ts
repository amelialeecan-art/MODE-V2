/* =====================================================================
   앱 repository 집합. createRepositories(db) 로 생성 — 테스트는 격리 db 주입.
   ===================================================================== */
import { RawRepository } from './rawRepository'
import { ModeDB, db as runtimeDb } from '@/data/db/db'
import { nowISO } from '@/shared/time/time'
import {
  APP_SCHEMA_VERSION, MIGRATION_VERSION, DEFAULT_SETTINGS, SCHEMA_VERSION,
} from '@/domain'
import type {
  StateMeasurement, StateMeasurementInput, SleepEpisode, SleepEpisodeInput,
  MealEpisode, MealEpisodeInput, ActivityEpisode, ActivityEpisodeInput,
  CycleRecord, CycleRecordInput, ContextEvent, ContextEventInput,
  RecoveryAction, RecoveryActionInput, HealthException, HealthExceptionInput,
  ScreenExposure, ScreenExposureInput, WeightMeasurement, WeightMeasurementInput,
  Experiment, ExperimentInput, MedicationDose, MedicationDoseInput,
  AppMeta, AppSettings, CheckInType,
} from '@/domain'

class StateRepository extends RawRepository<StateMeasurement, StateMeasurementInput> {
  /** morning/evening 은 localDate 당 1개 upsert. adhoc 은 항상 새로. */
  async upsertCheckIn(input: StateMeasurementInput): Promise<number> {
    if (input.checkInType === 'adhoc') return this.put(input)
    const sameDay = await this.byDate(input.localDate)
    const existing = sameDay.find((s) => s.checkInType === input.checkInType)
    return this.put(existing ? { ...input, id: existing.id } : input)
  }
}

class CycleRepository extends RawRepository<CycleRecord, CycleRecordInput> {
  /** 실제 생리 시작 날짜(오름차순). retrospective phase 계산의 유일 근거. */
  async periodStartDates(): Promise<string[]> {
    const all = await this.all()
    return all
      .filter((r) => r.periodStart === true)
      .map((r) => r.localDate)
      .sort()
  }
}

export interface Repositories {
  state: StateRepository
  sleep: RawRepository<SleepEpisode, SleepEpisodeInput>
  meal: RawRepository<MealEpisode, MealEpisodeInput>
  activity: RawRepository<ActivityEpisode, ActivityEpisodeInput>
  cycle: CycleRepository
  context: RawRepository<ContextEvent, ContextEventInput>
  recovery: RawRepository<RecoveryAction, RecoveryActionInput>
  health: RawRepository<HealthException, HealthExceptionInput>
  screen: RawRepository<ScreenExposure, ScreenExposureInput>
  weight: RawRepository<WeightMeasurement, WeightMeasurementInput>
  medicationDose: RawRepository<MedicationDose, MedicationDoseInput>
  experiment: RawRepository<Experiment, ExperimentInput>
  db: ModeDB
  /** 앱 메타(설정/버전) 로드 — 없으면 기본값으로 생성. */
  getMeta(): Promise<AppMeta>
  saveSettings(settings: AppSettings): Promise<AppMeta>
  touchBackup(): Promise<void>
  /** 모든 raw store 비우기(import 전 전체 교체 등). appMeta 는 유지. */
  clearAllData(): Promise<void>
}

export function createRepositories(database: ModeDB = runtimeDb): Repositories {
  const state = new StateRepository(database.stateMeasurements)
  const cycle = new CycleRepository(database.cycleRecords)

  async function getMeta(): Promise<AppMeta> {
    const existing = await database.appMeta.toCollection().first()
    if (existing) return existing
    const now = nowISO()
    const meta: AppMeta = {
      schemaVersion: APP_SCHEMA_VERSION,
      migrationVersion: MIGRATION_VERSION,
      lastBackupAt: null,
      settings: { ...DEFAULT_SETTINGS },
      createdAt: now,
      updatedAt: now,
    }
    meta.id = await database.appMeta.add(meta)
    return meta
  }

  async function saveSettings(settings: AppSettings): Promise<AppMeta> {
    const meta = await getMeta()
    const updated: AppMeta = { ...meta, settings, updatedAt: nowISO() }
    await database.appMeta.put(updated)
    return updated
  }

  async function touchBackup(): Promise<void> {
    const meta = await getMeta()
    await database.appMeta.put({ ...meta, lastBackupAt: nowISO(), updatedAt: nowISO() })
  }

  async function clearAllData(): Promise<void> {
    await database.transaction('rw', [
      database.stateMeasurements, database.sleepEpisodes, database.mealEpisodes,
      database.activityEpisodes, database.cycleRecords, database.contextEvents,
      database.recoveryActions, database.medicationProfiles, database.medicationDoses,
      database.healthExceptions, database.screenExposures, database.weightMeasurements,
      database.experiments,
    ], async () => {
      await Promise.all([
        database.stateMeasurements.clear(), database.sleepEpisodes.clear(),
        database.mealEpisodes.clear(), database.activityEpisodes.clear(),
        database.cycleRecords.clear(), database.contextEvents.clear(),
        database.recoveryActions.clear(), database.medicationProfiles.clear(),
        database.medicationDoses.clear(), database.healthExceptions.clear(),
        database.screenExposures.clear(), database.weightMeasurements.clear(),
        database.experiments.clear(),
      ])
    })
  }

  return {
    state,
    sleep: new RawRepository(database.sleepEpisodes),
    meal: new RawRepository(database.mealEpisodes),
    activity: new RawRepository(database.activityEpisodes),
    cycle,
    context: new RawRepository(database.contextEvents),
    recovery: new RawRepository(database.recoveryActions),
    health: new RawRepository(database.healthExceptions),
    screen: new RawRepository(database.screenExposures),
    weight: new RawRepository(database.weightMeasurements),
    medicationDose: new RawRepository(database.medicationDoses),
    experiment: new RawRepository(database.experiments),
    db: database,
    getMeta,
    saveSettings,
    touchBackup,
    clearAllData,
  }
}

/** 런타임 단일 repositories. */
export const repositories = createRepositories()

export { SCHEMA_VERSION, type CheckInType }
