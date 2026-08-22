# MODE V2 — 작업 지침

N-of-1 개인 시계열 앱. **raw-first**, 단방향 데이터 흐름. 상세 설계는 `docs/DESIGN.md`.

## 절대 깨지 말아야 할 불변식 (테스트로 강제됨)

1. **0 / missing / unknown 삼분** — `RatingValue = number | 'unknown' | null`, `promptedMetrics` 로 "안 물어봄" 구분. 0 으로 채우지 말 것.
2. **파생값 저장 금지** — 점수·phase·baseline·delta 는 raw 에서 계산. DB 에 넣지 말 것.
3. **legacy 수면 timestamp 추정 금지** — duration 만 있으면 `durationMinutes` 만. `wentToBedAt/…` 은 null.
4. **positiveAffect 과거 추정 금지** — legacy record 는 missing. 신규부터 측정.
5. **생리 phase** — 실제 periodStart 기록만 근거, 28일 평균 미사용.
6. **provenance** — 모든 record 에 `source`; legacy 는 `legacy_import` + `conversionVersion`.
7. **단일 소스** — Today/Calendar/Rhythm/Analysis 는 `data/queries` 를 통해 같은 raw 를 읽는다. V1 fallback 코드 만들지 말 것.

## 관례

- 사용자 UI 에 내부 영어 변수명 노출 금지. 라벨은 `domain/*` 카탈로그가 단일 출처. `craving` → "음식 당김".
- 인과 문장 금지. "함께 나타나는 경향" 류만.
- 미구현 기능의 가짜 토글 만들지 말 것(알림 등). 말투 설정은 실제 전체 UI 에 작동해야 함.
- 신규 raw 는 repository `put()` 이 provenance 를 stamp. migration/import 는 `bulkImport()`.

## 명령

`npm test` · `npm run typecheck` · `npm run build`. 커밋 전 셋 다 통과시킬 것.
