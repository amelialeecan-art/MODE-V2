# MODE V2 — 새 프로젝트 설계

> 이 문서는 구현 전에 확정한 설계다. 기존 앱(`mode-rhythm`)은 **참고 자료로만** 사용했고,
> 새 앱은 새 repository / 새 DB / 단방향 데이터 흐름으로 처음부터 다시 만든다.
>
> ```
> 사용자 입력  →  V2 raw data  →  V2 analysis engine  →  Today / Rhythm / Calendar / Analysis
> ```
>
> V1 fallback · legacy read adapter · dual repository 는 만들지 않는다.
> 과거 데이터는 **한 번** V2 raw record 로 변환되며, 변환 후에는 그냥 `source: legacy_import` 가 붙은
> 평범한 V2 record 다. 앱 어디에도 "legacy 인지 V2 인지" 를 분기하는 코드는 없다.

---

## 0. 기존 데이터 실측 요약 (mode-export-2026-08-22.json)

| table | rows | 성격 | 처리 |
|---|---|---|---|
| `dailyLogs` | 53 | **실제 원자료** (상태 + 내장 수면) | 선별 변환 → StateMeasurement / SleepEpisode |
| `cycleLogs` | 7 | **실제 원자료** (생리) | 적극 보존 → CycleRecord |
| `eventLogs` | 479 | 반은 체크박스 노이즈 | **선별** 변환 → ContextEvent |
| `recoveryLogs` | 140 | 회복 행동 사실 | 보존 → RecoveryAction |
| `dailyScores` | 53 | **앱이 계산한 결과** | **전량 폐기** |
| `patternInsights` | 17 | **앱이 계산한 결과** | **전량 폐기** |
| `userSettings` | 1 | 설정 | 선별 (averageCycleLength 삭제) |
| `stateMeasurements`/`sleepEpisodes`/`mealEpisodes` | 각 1 | 구 V2 테스트 잔여물 | 폐기 (실데이터 아님) |
| 나머지 V2 테이블 | 0 | 빈 테이블 | — |

핵심 사실:
- **실제 2개월 원자료는 전부 V1 테이블에 있다.** 구 V2 테이블은 테스트 흔적 1행씩뿐.
- 생리 시작 기록은 **2개** (07-17, 08-20) → 실측 주기 ≈ **34일**. 평균 28일 가정은 명백히 틀리다 → 제거.
- `dailyLogs.energy/focus/calm` 은 0~10 **역량(capacity)** 척도(0=낮음, 10=높음), `moodLow/anxiety/…` 는 0~10 **증상** 척도(0=없음, 10=심함). 새 스키마 규약과 방향 일치.
- `lastNightSleep = { hours, quality, issues[] }` 가 dailyLog 안에 34행 존재. **timestamp 없음.**

---

## 1. V2 Canonical Schema (schemaVersion = 1)

### 1.1 공통 값 규약 — 0 / missing / unknown 삼분

```ts
type RatingValue = number /*0~10 정수*/ | 'unknown' | null
```

- **0** = 측정했고 실제로 없음/낮음
- **missing** = 그 metric 의 **키 자체가 없음** = 안 물어봄
- **`'unknown'`** = 물어봤지만 판단 못 함

`StateMeasurement.promptedMetrics` 가 "물어봤는데 null" 과 "애초에 안 물어봄" 을 구분한다.
분석 엔진은 이 셋을 절대 동일 취급하지 않는다. (자동 테스트로 강제)

### 1.2 Core State — 13 metric (positiveAffect 추가)

```
moodLow  positiveAffect  anxiety  irritability  energy  focus  impulsivity
physicalHunger  craving  bingeUrge  fatigueHeaviness  bloating  painDiscomfort
```

- 각 metric 은 **독립 변수**. `moodLow=0` 이 `positiveAffect` 높음을 의미하지 않는다.
- 긍정/부정 정서를 한 직선 양끝으로 만들지 않는다. energy ≠ positiveAffect.
- 각 metric 은 명확한 low/high 라벨을 가진다 (`domain/state/coreState.ts`).
- 아침/저녁 **같은** core metric 을 측정 가능 (morning/evening paired analysis 지원).
  UI 는 slider / segmented scale (숫자 버튼 11개 나열 지양).

### 1.3 Raw record 공통 provenance

모든 timestamp 기반 raw record:

```ts
{ localDate, timezoneOffsetMinutes, source, schemaVersion, createdAt, updatedAt }
```

`source: 'manual' | 'import' | 'legacy_import' | 'derived'`
legacy_import record 에는 `conversionVersion` 추가.

### 1.4 테이블

| store | record | 요지 |
|---|---|---|
| `stateMeasurements` | StateMeasurement | localDate, recordedAt, checkInType(morning/evening/adhoc), promptedMetrics[], metrics{13} |
| `sleepEpisodes` | SleepEpisode | wentToBedAt/sleepOnsetAt/wakeAt(옵션), awakenings, satisfaction, **durationMinutes(legacy 전용 fallback)** |
| `mealEpisodes` | MealEpisode | startedAt, prePhysicalHunger/preCraving/preBingeUrge, amount, protein/sweets/ultraProcessed, perceivedOvereating, **alcohol(ordinal+drinks)** |
| `activityEpisodes` | ActivityEpisode | startedAt, durationMinutes, rpe, activityType |
| `cycleRecords` | CycleRecord | periodStart, periodEnd, flowLevel, painLevel — **사실만**. phase 는 저장 안 함(계산) |
| `contextEvents` | ContextEvent | code, category, intensity, approxWindow — 스트레스/생활 맥락 |
| `recoveryActions` | RecoveryAction | code, category, effect(much_better…worse/unknown) |
| `medicationProfiles` / `medicationDoses` | | 약 정의 / 복용 1회 |
| `healthExceptions` | HealthException | category, intensity |
| `screenExposures` | ScreenExposure | totalMinutes, shortFormMinutes, preBed2hMinutes … (수동/미래 자동) |
| `weightMeasurements` | WeightMeasurement | weightKg, userSawWeight |
| `experiments` | Experiment | targetMetric, interventionCode, baseline/intervention 구간 |
| `appMeta` | AppMeta | schemaVersion, migrationVersion, lastBackupAt, settings |

파생값(timeInBed, sleepLatency, sleepDuration, phase, baseline delta …)은 **저장하지 않고** 엔진이 raw 에서 계산.

### 1.5 Sleep — derived 규칙

```
timeInBed    = wakeAt - wentToBedAt          (둘 다 있을 때만)
sleepLatency = sleepOnsetAt - wentToBedAt     (둘 다 있을 때만)
sleepDuration= wakeAt - sleepOnsetAt          (둘 다 있을 때만)
             ↳ timestamp 없으면 durationMinutes 사용 (legacy)
```
과거 hours 만으로 취침/입면/기상 시각을 **만들어내지 않는다.**

### 1.6 Alcohol — 명확한 구조

```ts
type AlcoholIntake = { level: 'none'|'light'|'moderate'|'heavy'|'unknown', standardDrinks?: number|null }
```
숫자 하나 + 자유 단위 같은 애매 모델 금지.

### 1.7 Cycle — phase 는 retrospective 계산

사용자는 **사실만** 입력: 생리 시작/종료/출혈량/통증.
PMS·배란기·황체기를 **직접 고르게 하지 않는다.**
phase 는 실제 periodStart 기록이 쌓인 뒤 앱이 계산. **28일 평균을 primary inference 로 쓰지 않는다.**
`averageCycleLength` 설정은 신규 앱에서 제거.

---

## 2. Migration Matrix (mode-export → V2 raw, conversionVersion 1)

처리: **보존**=의미 동일 그대로 / **변환**=명시적 규칙 / **버림** / **판단**=규칙 결정함

### 2.1 State (`dailyLogs` → `StateMeasurement`, checkInType=`evening`, source=`legacy_import`)

| Old | New | 처리 | 규칙 |
|---|---|---|---|
| `moodLow` | `moodLow` | 보존 | 그대로 |
| `anxiety` | `anxiety` | 보존 | 그대로 |
| `irritability` | `irritability` | 보존 | 그대로 |
| `energy` | `energy` | 보존 | 0~10 capacity, 방향 동일 확인함 |
| `focus` | `focus` | 보존 | 0~10 capacity, 방향 동일 확인함 |
| `impulsivity` | `impulsivity` | 보존 | 그대로 |
| `bingeUrge` | `bingeUrge` | 보존 | 그대로 |
| `bloating` | `bloating` | 보존 | 그대로 |
| `fatigue`,`heaviness` | `fatigueHeaviness` | **변환** | `max(fatigue, heaviness)` (새 metric = "피로/몸 무거움") |
| `pain`,`bodyDiscomfort` | `painDiscomfort` | **변환** | `max(pain, bodyDiscomfort)` |
| `sweetCraving`,`saltyCraving`,`greasyCraving` | `craving` | **변환** | `max(sweet, salty, greasy)`, 하나라도 측정됐을 때만 |
| `appetite` | `physicalHunger` | **버림** | old appetite ≠ physicalHunger. 자동변환 **금지** |
| — | `physicalHunger` | (missing) | legacy 는 physicalHunger 안 물어봄 → 키 없음 |
| — | `positiveAffect` | (missing) | 과거에 측정 안 함 → **추정 금지** (§12). 신규부터 |
| `calm` | — | **버림** | positiveAffect 로 억지 변환 안 함 |
| `sadness`,`selfCriticism`,`headache`,`digestion` | — | **버림** | 새 core 에 대응 없음 |
| `stateCodes`,`overallIntensity`,`*Level`,`*Codes`,`functionLevel`,`dayContext` … | — | **버림** | V1 파생/보조 입력, clean break |

`promptedMetrics` = 실제로 값이 들어간 metric 목록 → physicalHunger/positiveAffect 자동으로 "안 물어봄".
recordedAt: legacy 는 시각 불명 → localDate 기준 anchor, `timezoneOffsetMinutes=540`(KST, 한국어 데이터).
**분석 엔진은 legacy_import state 를 날짜 단위로만 취급**(시각 신뢰 안 함, morning→evening ordering 대상 아님).

### 2.2 Sleep (`dailyLogs.lastNightSleep` → `SleepEpisode`, legacy_import)

| Old | New | 처리 |
|---|---|---|
| `hours` | `durationMinutes = hours*60` | 변환 |
| `quality` | `satisfaction` | 보존 |
| (시각) | `wentToBedAt/sleepOnsetAt/wakeAt = null` | **추정 금지** |
| `issues[]` | — | 버림 (시각 없는 애매 코드) |

### 2.3 Cycle (`cycleLogs` → `CycleRecord`, legacy_import) — 적극 보존

| Old | New | 처리 |
|---|---|---|
| `date` | `localDate` | 보존 |
| `periodStart`/`periodEnd` | 동일 | 보존 |
| `flowLevel` | `flowLevel` | 보존 (light/normal → enum, heavy/spotting 여지) |
| `periodPain` | `painLevel` | 보존 |

### 2.4 Events (`eventLogs` 479 → `ContextEvent`, **선별**, legacy_import, date-level)

- **allowlist (스트레스/생활 맥락만)**: `work_heavy`, `work_pressure`, `reply_stress`, `conflict`, `failure_mistake`, `not_my_way`, `upcoming_stress`, `new_burden`, `social_comparison`, `plan_disrupted`, `noise_space`, `crowded`, `long_alone`, `moved_lot`, `weather_gloomy`, `low_sunlight`, `stayed_in`, `messy_home`, `cramped`, `exercised`, `walked`
- **버림**: 모든 `sleep_*`(SleepEpisode 와 중복·시각 없음), 모든 음식 이벤트(`ate_*`,`meal_*`,`late_meal`,`alcohol`,`low_water` — 신규는 MealEpisode 로), digital(`shorts_heavy`,`phone_in_bed`,`late_screen`,`sns_heavy` — ScreenExposure 는 분(minutes) 필요), appearance/자기관리(`appearance`,`weighed`,`washed`)
- intensity 는 그대로 보존. `timing='recent3days'` → `approxWindow='recent3days'` 로 표시(같은 날 association 대상에서 제외).
- **occurredAt 없음** → 전후관계 만들지 않음(§20).

### 2.5 Recovery (`recoveryLogs` → `RecoveryAction`, legacy_import)
code/category/effect(much_better/little_better/same/worse/unknown) 보존. "무엇을 했을 때 달랐지"(§19 Q3) 재료.

### 2.6 Settings (`userSettings`)
`cycleEnabled` 보존 · `toneMode` → 실제 동작하는 말투 토글로만 유지 · `averageCycleLength` **삭제** · `reminderEnabled` **삭제**(알림 미구현 → 가짜 토글 금지) · `privacyMode` 삭제(로컬 전용).

---

## 3. 절대 migration 하지 않음 (전량 폐기)

`dailyScores` 전체(emotionalLoad, appetiteLoad, sleepLoad, bodyLoad, cycleLoad, eventLoad, rhythmLoad, recoveryScore, dayType, dayTypeSubLabel, confidence) · `patternInsights` 전체 · effectSize/confidence cache · 기존 pattern message · 기존 scoring 결과 · 기존 분석 cache.
→ 새 앱은 raw V2 에서 다시 계산.

---

## 4. 삭제할 legacy 개념 (새 앱에 존재하지 않음)

dailyLogs · dailyScores · eventLogs(구조) · 기존 patternInsights · 기존 recoveryLogs 기반 분석 ·
rhythmLoad · dayType · recoveryScore · 기존 scoring 공식 · V1 pattern analysis · LegacyLogForm ·
V1/V2 fallback · 호환용 repository abstraction · V1/V2 폴더 구분.

---

## 5. Architecture

```
src/
  domain/            # 순수 타입 + 카탈로그(라벨/척도 메타). 로직 없음
    state/ sleep/ meal/ activity/ cycle/ context/ recovery/
    medication/ weight/ screen/ experiment/  common/
  data/
    db/              # Dexie 스키마(단일 DB, V2)
    repositories/    # store 당 1개. 단일 방향
    migrations/      # migrationRunner + legacyImport(순수 함수)
    importExport/    # JSON export/import (raw 중심)
  analysis/
    baseline/ temporal/ associations/ cycle/ experiments/
  features/
    today/ log/ rhythm/ calendar/ analysis/ settings/
  shared/
    time/ statistics/ ui/
```

- **단방향**: features → analysis → data(repositories) → db. 역방향/우회 없음.
- 사용자에게 보이는 문구에 내부 영어 변수명 노출 금지. `craving`→"음식 당김".
- 상관/인과: "X 가 Y 를 만들었다" 금지. 기본 문구 "X 가 있던 날 Y 가 평소보다 높았음 / 함께 나타나는 경향".
  timestamp 있을 때만 순서 사용. legacy(날짜만) 은 전후관계 안 만듦.

## 6. 핵심 invariant (자동 테스트)

1. `0 !== missing !== unknown` — RatingValue 인코딩/분석에서 삼분 유지
2. 오늘 StateMeasurement 저장 → Today/Calendar/Rhythm 이 **같은 값** 을 읽음
3. legacy derived score(dailyScores/patternInsights) 는 새 DB 에 **들어오지 않음**
4. legacy duration-only sleep → **가짜 timestamp 생성 안 함** (wentToBedAt/…=null)
5. positiveAffect: legacy=missing 허용, 신규=정상 저장
6. 생리: 실제 periodStart 날짜만으로 retrospective phase 계산 (28일 default 미사용)
7. provenance: legacy_import 와 manual 신규 입력 구분 가능
