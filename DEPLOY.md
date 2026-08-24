# 배포 (GitHub Pages · iPhone 홈 화면 PWA)

기존 MODE(V1)와 동일하게 **GitHub Pages**로 배포한다. 별도 Vercel 서비스는 쓰지 않는다.
데이터는 **로컬 전용** — iPhone 브라우저의 IndexedDB 에만 있고 서버/Git 으로 올라가지 않는다.

## 고정 production URL

```
https://amelialeecan-art.github.io/MODE-V2/
```

- Vite `base` = `/MODE-V2/` (현재 repository 이름 `amelialeecan-art/MODE-V2` 기준). manifest `id`/`start_url`/`scope`, workbox `navigateFallback`, 아이콘 경로 모두 이 base 에서 파생된다.
- 이 origin/path 가 앞으로 고정 → 재배포해도 IndexedDB 유지.
- repo 이름을 바꾸면 `vite.config.ts` 의 `REPO_BASE` 한 줄만 `'/<새이름>/'` 로 바꾸면 된다.

## 한 번만 하면 되는 것 (사용자 직접)

1. GitHub 저장소 **Settings → Pages → Build and deployment → Source** 를 **"GitHub Actions"** 로 설정.
2. 끝. 이후 기본 브랜치(`claude/mode-v2-rebuild-eigiej`)에 push 하면 `.github/workflows/deploy.yml`
   이 자동으로 빌드→배포한다. (수동 실행: Actions 탭 → "Deploy to GitHub Pages" → Run workflow)

Actions 가 `typecheck → test → build → Pages 배포` 를 수행한다. 첫 배포 후 위 URL 로 접속된다.

## 홈 화면에 추가 (iPhone Safari)

1. **Safari**(Chrome 아님)로 위 production URL 을 연다.
2. 하단 **공유 버튼** → **홈 화면에 추가** → 이름 `MODE` → **추가**.
3. 홈 화면의 **모찌 아이콘**을 탭하면 주소창 없는 standalone 웹앱으로 열린다.

## 업데이트 전략 (오래된 JS 안 남게)

- Service Worker `autoUpdate`(skipWaiting + clientsClaim + cleanupOutdatedCaches):
  새 배포 감지 시 새 SW 즉시 활성화 + 구 precache(옛 JS/CSS) 정리.
- 해시 붙은 assets 만 장기 캐시. `index.html`/`manifest`/`sw.js` 는 매번 최신 확인.

## 데이터 지속성

- IndexedDB 는 **origin 기준** 저장 → production origin 고정이면 재배포해도 유지.
- `DB_NAME = 'mode-v2'` 는 버전이 올라가도 바꾸지 않는다(바꾸면 새 빈 DB).
- 홈 화면 웹앱 삭제 / Safari 웹사이트 데이터 삭제 시 데이터 사라짐 → **설정 → JSON 내보내기**로 백업.
