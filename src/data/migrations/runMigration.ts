/* =====================================================================
   migration runner — 변환된 bundle 을 repositories 에 적재.
   앱 안 "구 MODE 데이터 가져오기" 경로와 CLI(scripts) 가 공유.
   ===================================================================== */
import type { Repositories } from '@/data/repositories'
import { migrateLegacyExport, type LegacyImportReport } from './legacyImport'
import type { LegacyExport } from './legacyTypes'
import type { AppSettings, ToneMode } from '@/domain/settings/settings'

/** legacy toneMode('witty' 등) → 새 말투. 새 앱은 banmal/haeyo 만. */
function toToneMode(v: string | undefined): ToneMode {
  return v === 'haeyo' || v === 'polite' ? 'haeyo' : 'banmal'
}

export async function importLegacyExport(
  repos: Repositories,
  input: LegacyExport,
): Promise<LegacyImportReport> {
  const { bundle, report } = migrateLegacyExport(input)

  await repos.sleep.bulkImport(bundle.sleep)
  await repos.state.bulkImport(bundle.state)
  await repos.meal.bulkImport(bundle.meal)
  await repos.cycle.bulkImport(bundle.cycle)
  await repos.context.bulkImport(bundle.context)
  await repos.recovery.bulkImport(bundle.recovery)

  // userSettings 선별 (averageCycleLength/reminderEnabled 삭제)
  const us = input.tables?.userSettings?.[0]
  if (us) {
    const meta = await repos.getMeta()
    const settings: AppSettings = {
      cycleEnabled: us.cycleEnabled !== false,
      toneMode: toToneMode(us.toneMode),
    }
    await repos.saveSettings({ ...meta.settings, ...settings })
  }

  return report
}
