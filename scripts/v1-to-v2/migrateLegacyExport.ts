/* =====================================================================
   CLI: 원본 V1(구 MODE) export → clean V2 backup(JSON 불러오기 가능).
   사용: npx tsx scripts/v1-to-v2/migrateLegacyExport.ts <v1Export.json> [out.json]

   OUTPUT 은 특별한 legacy backup 이 아니라 앱이 그대로 복원하는 정상 mode-v2 backup.
   V2 의미와 100% 동일한 사실만 보존한다(추정/합성/재해석 없음).
   ===================================================================== */
import { readFileSync, writeFileSync } from 'node:fs'
import { convertV1Export, type V1Export } from './convert.ts'

const inPath = process.argv[2]
const outPath = process.argv[3] ?? 'mode-v2-clean.json'
if (!inPath) {
  console.error('사용법: npx tsx scripts/v1-to-v2/migrateLegacyExport.ts <v1Export.json> [out.json]')
  process.exit(1)
}

const v1 = JSON.parse(readFileSync(inPath, 'utf-8')) as V1Export
const { backup, report } = convertV1Export(v1)

writeFileSync(outPath, JSON.stringify(backup, null, 2))

console.log('변환 완료:', outPath)
console.log('\n[preserved · 진짜 V2 직접입력]')
for (const [k, n] of Object.entries(report.preservedDirectV2)) if (n) console.log(`  ${k}: ${n}`)
console.log('\n[preserved · V1 사실(1:1)]')
for (const [k, n] of Object.entries(report.preservedV1Facts)) if (n) console.log(`  ${k}: ${n}`)
console.log('\n[discarded]')
for (const d of report.discarded) console.log(`  ${d.source}: ${d.count} — ${d.reason}`)
