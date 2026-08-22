# MODE V2

내 상태를 시간 순서대로 **원자료(raw data)** 로 기록하고, 수면·식사·생리·운동·스트레스·생활 사건이
내 상태와 어떻게 함께 움직이는지 **개인 baseline** 기준으로 보여주는 N-of-1 개인 시계열 앱.

기존 MODE(V1/V2 혼재)를 계승하지 않고 **처음부터 새로 설계한 앱**이다. 설계 근거는 [`docs/DESIGN.md`](docs/DESIGN.md).

## 데이터 흐름 (단방향)

```
사용자 입력  →  V2 raw data  →  V2 analysis engine  →  Today / Rhythm / Calendar / Analysis
```

V1 fallback · legacy read adapter · dual repository 는 없다. 과거 데이터는 한 번 `legacy_import` 로 변환되면
그냥 평범한 V2 raw record 다.

## 핵심 원칙

- **Raw 우선**: 사용자가 입력/발생한 사실만 저장. 파생값(점수·phase·baseline)은 저장하지 않고 언제든 raw 에서 재계산.
- **0 / missing / unknown 삼분**: `0`(실제 없음) ≠ 키 없음(안 물어봄) ≠ `'unknown'`(물어봤지만 모름). 절대 섞지 않음.
- **Core state 13 metric**: 부정 정서와 별개로 `positiveAffect` 를 독립 축으로. 긍정/부정을 한 직선으로 만들지 않음.
- **하나의 "오늘 점수/유형"으로 압축하지 않음**: 실제 metric 변화를 먼저 보여줌.
- **상관 ≠ 인과**: "X 가 Y 를 만들었다" 금지. "함께 나타나는 경향". 시각이 있을 때만 순서 사용.
- **생리**: 사실만 입력, phase 는 실제 생리 시작 기록으로 retrospective 계산. 28일 평균 가정 없음.

## 스택

Vite · React 18 · TypeScript · Dexie(IndexedDB) · React Router · vitest · vite-plugin-pwa. 완전 로컬, 네트워크 불필요.

## 스크립트

```bash
npm install
npm run dev         # 개발 서버
npm run test        # vitest (invariant 테스트 포함)
npm run typecheck
npm run build       # 타입체크 + 프로덕션 빌드(PWA)
npm run migrate:legacy <구export.json> [out.json]   # 구 MODE export → V2 backup 파일
```

## 구 MODE 데이터 가져오기

앱 안 **설정 → 구 MODE 데이터 가져오기** 에서 예전 export JSON 을 선택하면 한 번 변환되어 들어온다.
계산된 점수(`dailyScores`)·패턴(`patternInsights`)은 버리고, 신뢰 가능한 원자료(상태·수면·생리·맥락·회복)만 살린다.
CLI(`npm run migrate:legacy`)로도 동일하게 변환 가능.

## 구조

```
src/
  domain/       순수 타입 + 카탈로그(라벨/척도 메타)
  data/         db(Dexie) · repositories · migrations · importExport · queries
  analysis/     baseline · temporal · associations · cycle · sleep · day · report
  features/     today · log · rhythm · calendar · analysis · settings
  shared/       time · statistics · ui
```

V1/V2 폴더 구분은 없다. 이 프로젝트 자체가 V2다.
