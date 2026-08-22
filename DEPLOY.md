# 배포 (iPhone 홈 화면 PWA)

이 앱은 **로컬 전용**이다. 데이터는 iPhone 브라우저의 IndexedDB 에만 있고, 서버/Git 으로 절대 올라가지 않는다.
배포되는 것은 **앱 코드(정적 파일)뿐**이다.

## 권장: Vercel (고정 production URL, 전용 origin)

앱은 `HashRouter`(`/#/...`)를 쓰므로 서버 리라이트가 필요 없다. 정적 호스팅이면 어디든 동작한다.
Vercel 설정은 `vercel.json` 에 이미 들어 있다(`framework: vite`, `outputDirectory: dist`,
`sw.js`·`manifest`·`index.html` 은 캐시 안 함 → 업데이트 시 오래된 JS 안 남음).

### 한 번만 하면 되는 것 (사용자 직접)
1. https://vercel.com → **GitHub 계정으로 로그인**.
2. **Add New… → Project** → GitHub 저장소 `amelialeecan-art/MODE-V.2.` 를 **Import**.
   - Production Branch 는 이 저장소의 기본 브랜치(`claude/mode-v2-rebuild-eigiej`)면 된다.
   - Framework 는 자동으로 **Vite** 로 잡힌다(안 잡히면 수동 선택). Build/Output 은 `vercel.json` 이 지정.
3. **Deploy** 클릭 → 잠시 후 `https://<프로젝트이름>.vercel.app` 형태의 **고정 production URL** 이 생긴다.
   - 이후 이 브랜치에 push 할 때마다 **같은 URL** 로 자동 재배포된다(origin 불변).

이게 전부다. 별도 서버·DB·환경변수 없음.

## 고정 URL / 데이터 지속성

- **production URL 은 고정**이다(`*.vercel.app` alias 는 재배포해도 안 바뀜). preview URL(커밋마다 생기는
  `*-git-*.vercel.app`)은 홈 화면 등록에 쓰지 말 것 — 반드시 production URL 만 사용.
- IndexedDB 는 **origin 기준**으로 저장된다. production origin 이 그대로면 재배포해도 데이터 유지.
- `DB_NAME = 'mode-v2'` 는 버전이 올라가도 바꾸지 않는다(바꾸면 새 빈 DB 가 됨).

## 홈 화면에 추가 (iPhone Safari)

1. **Safari**(Chrome 아님)로 production URL 을 연다.
2. 하단 **공유 버튼** → **홈 화면에 추가** → 이름 `MODE` 확인 → **추가**.
3. 홈 화면 아이콘(◐)을 탭하면 주소창 없는 **standalone 웹앱**으로 열린다.

## 업데이트 전략 (오래된 JS 안 남게)

- Service Worker 는 `autoUpdate`(skipWaiting + clientsClaim + cleanupOutdatedCaches).
  새 배포가 감지되면 새 SW 가 즉시 활성화되고 구 precache(옛 JS/CSS)를 정리한다.
- `sw.js` / `manifest.webmanifest` / `index.html` 은 `Cache-Control: no-cache` 로 서빙 → 항상 최신 확인.
- 해시가 붙은 assets(`assets/*.js`)만 장기 캐시.

## 대안: GitHub Pages

가능하지만 이 저장소 이름(`MODE-V.2.`)이 서브경로가 되어 `vite.config` 의 `base` 를 `'/MODE-V.2./'` 로
바꿔야 하고 origin 이 `github.io`(공유 도메인)가 된다. 전용 origin·깔끔한 URL 때문에 **Vercel 을 권장**한다.
