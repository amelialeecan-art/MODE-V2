# scripts/v1-to-v2 — 파킹된 V1→V2 one-time 변환기

프로덕션 앱(`src/`)에는 V1(구 MODE) 호환 runtime 이 **하나도 없다**. V1 export 를
V2 raw 로 옮기는 일이 실제로 필요해지면, 그 변환은 앱 밖의 이 one-time 스크립트에서만 한다.

이 디렉터리는 프로덕션 typecheck(`tsc`)와 test(`vitest`), build(`vite`) 에서 **제외**된다.

- `legacyImport.ts` / `legacyTypes.ts` / `runMigration.ts` / `migrateLegacyExport.ts`
  — cleanup 이전 스키마(`legacy_import` source, `conversionVersion`, `conversionRules`)를
  참조하는 **파킹 상태**의 코드다. 실제 변환 STEP 에서 현재 V2 스키마에 맞게 재작성한다.
- `legacyImport.test.ts.ref` — 당시 변환 규칙을 기록해 둔 참고용 테스트(실행 안 됨).

아직 아무 데이터도 변환하지 않는다. 이 STEP 은 runtime/schema 정리만 했다.
