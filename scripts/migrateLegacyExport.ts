/* =====================================================================
   CLI: 구 MODE export → V2 backup(import 가능) 파일 생성.
   사용: npx tsx scripts/migrateLegacyExport.ts <legacyExport.json> [out.json]
   앱 UI 의 "데이터 가져오기" 와 동일한 migrateLegacyExport 를 사용한다.
   ===================================================================== */
import { readFileSync, writeFileSync } from 'node:fs'
import { migrateLegacyExport } from '../src/data/migrations/legacyImport.ts'
import type { LegacyExport } from '../src/data/migrations/legacyTypes.ts'

const inPath = process.argv[2]
const outPath = process.argv[3] ?? 'mode-v2-migrated.json'
if (!inPath) {
  console.error('사용법: npx tsx scripts/migrateLegacyExport.ts <legacyExport.json> [out.json]')
  process.exit(1)
}

const legacy = JSON.parse(readFileSync(inPath, 'utf-8')) as LegacyExport
const { bundle, report } = migrateLegacyExport(legacy)

const backup = {
  format: 'mode-v2',
  formatVersion: 1,
  schemaVersion: 1,
  migrationVersion: 1,
  exportedAt: new Date().toISOString(),
  tables: {
    stateMeasurements: bundle.state,
    sleepEpisodes: bundle.sleep,
    mealEpisodes: bundle.meal,
    cycleRecords: bundle.cycle,
    contextEvents: bundle.context,
    recoveryActions: bundle.recovery,
    activityEpisodes: [], medicationProfiles: [],
    medicationDoses: [], healthExceptions: [], screenExposures: [],
    weightMeasurements: [], experiments: [],
  },
  settings: null,
}

writeFileSync(outPath, JSON.stringify(backup, null, 2))
console.log('변환 완료:', outPath)
console.log('counts:', report.counts)
console.log('버린 테이블:', report.droppedTables.join(', ') || '(없음)')
console.log('버린 event code 종류:', Object.keys(report.droppedEventCodes).length)
console.log('보존 event code 종류:', Object.keys(report.keptEventCodes).length)
