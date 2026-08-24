# scripts/v1-to-v2 — One-time V1 → clean V2 backup 변환기

프로덕션 앱(`src/`)에는 V1(구 MODE) 호환 runtime 이 **하나도 없다**. V1 export 를
V2 로 옮기는 일은 앱 밖의 이 one-time 도구에서만 한다. 이 폴더의 코드는 vite
프로덕션 번들에 포함되지 않는다(typecheck·test 게이트에는 포함).

## 원칙

"살릴 수 있으면 최대한"이 아니라 **V2 의미와 100% 동일한 사실만** 보존한다.
추정·합성·재해석·가짜 timestamp·가짜 occurredAt 없음.

- **보존(진짜 V2 직접입력)**: export 안에 이미 있는 `stateMeasurements`,
  `sleepEpisodes`, `mealEpisodes` 등 실제 V2 raw record(비-V2 키는 제거).
- **보존(V1 사실 1:1)**:
  - `cycleLogs` → `cycleRecords` (date 단위 사실: periodStart/End, flow, pain).
  - `eventLogs` → `contextEvents` — **V2 카탈로그에 있는 code 만**, occurredAt=null,
    timing→approxWindow. (시각 생성 안 함)
  - `recoveryLogs` → `recoveryActions` — V2 카탈로그 code + V2 effect enum 만.
- **버림**:
  - `dailyLogs` — V2 StateMeasurement 은 실제 recordedAt+checkInType 필요.
    날짜만 있는 daily record 를 evening/12:00 으로 만들지 않고, metric 재해석
    (max craving, appetite→physicalHunger 등)도 하지 않는다 → 전부 버림.
  - V1 수면(duration/quality only) — V2 SleepEpisode 는 timestamp 기반 → 버림.
  - 카탈로그 밖 event/recovery code, `dailyScores`/`patternInsights`(파생),
    `userSettings`(사실 아님).

## 출력

앱이 그대로 "JSON 불러오기(전체 교체)" 하는 **정상 mode-v2 backup**.
`legacy_import` / `conversionRules` / `conversionVersion` 이 존재하지 않는다.

## 사용

```
npx tsx scripts/v1-to-v2/migrateLegacyExport.ts <원본_V1_export.json> [out.json]
# 또는
npm run migrate:legacy -- <원본_V1_export.json> [out.json]
```

입력은 **원본 V1 export** 이다(이미 변환된 mode-backup-*.json 아님).
실제 개인 export JSON 은 저장소에 커밋하지 않는다. 테스트는 합성 fixture 로 한다.
