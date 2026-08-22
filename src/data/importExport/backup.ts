/* =====================================================================
   JSON export / import — raw 중심 백업.
   derived analytics cache 가 없어도 앱이 완전히 복원되어야 한다.
   ===================================================================== */
import type { Repositories } from '@/data/repositories'
import { APP_SCHEMA_VERSION, MIGRATION_VERSION } from '@/domain'

export const EXPORT_FORMAT = 'mode-v2'
export const EXPORT_FORMAT_VERSION = 1

export interface BackupFile {
  format: typeof EXPORT_FORMAT
  formatVersion: number
  schemaVersion: number
  migrationVersion: number
  exportedAt: string
  tables: Record<string, unknown[]>
  settings: unknown
}

const STORE_KEYS = [
  'stateMeasurements', 'sleepEpisodes', 'mealEpisodes', 'activityEpisodes',
  'cycleRecords', 'contextEvents', 'recoveryActions', 'medicationProfiles',
  'medicationDoses', 'healthExceptions', 'screenExposures', 'weightMeasurements',
  'experiments',
] as const

export async function exportBackup(repos: Repositories): Promise<BackupFile> {
  const db = repos.db
  const tables: Record<string, unknown[]> = {}
  for (const key of STORE_KEYS) {
    tables[key] = await (db as unknown as Record<string, { toArray(): Promise<unknown[]> }>)[key].toArray()
  }
  const meta = await repos.getMeta()
  await repos.touchBackup()
  return {
    format: EXPORT_FORMAT,
    formatVersion: EXPORT_FORMAT_VERSION,
    schemaVersion: APP_SCHEMA_VERSION,
    migrationVersion: MIGRATION_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
    settings: meta.settings,
  }
}

export interface ImportResult {
  imported: Record<string, number>
}

/** 백업 파일 복원. replace=true 면 기존 raw 전량 교체. */
export async function importBackup(
  repos: Repositories,
  file: BackupFile,
  opts: { replace?: boolean } = {},
): Promise<ImportResult> {
  if (file.format !== EXPORT_FORMAT) {
    throw new Error(`알 수 없는 백업 형식: ${String(file.format)}`)
  }
  if (opts.replace) await repos.clearAllData()

  const db = repos.db
  const imported: Record<string, number> = {}
  for (const key of STORE_KEYS) {
    const rows = (file.tables?.[key] ?? []) as { id?: number }[]
    if (rows.length === 0) { imported[key] = 0; continue }
    // id 충돌 방지: replace 아닐 땐 id 제거하고 새로 add.
    const toAdd = opts.replace ? rows : rows.map(({ id: _id, ...rest }) => rest)
    await (db as unknown as Record<string, { bulkAdd(items: unknown[]): Promise<unknown> }>)[key].bulkAdd(toAdd)
    imported[key] = toAdd.length
  }
  if (file.settings) {
    const meta = await repos.getMeta()
    await repos.saveSettings({ ...meta.settings, ...(file.settings as object) })
  }
  return { imported }
}
