import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// ── GitHub Pages 프로젝트 페이지 배포 ────────────────────────────────
// 현재 repository 이름이 그대로 경로가 된다: amelialeecan-art/MODE-V2
//   → https://amelialeecan-art.github.io/MODE-V2/
// repo 이름을 바꾸면 이 상수 하나만 고치면 된다(그 뒤 IndexedDB origin/path 고정).
// dev 는 '/', build/preview 는 base 를 써서 SW scope/경로를 로컬에서도 검증.
const REPO_BASE = '/MODE-V2/'

export default defineConfig(({ command, isPreview }) => {
  const base = command === 'build' || isPreview ? REPO_BASE : '/'
  return {
    base,
    plugins: [
      react(),
      VitePWA({
        // autoUpdate: 새 배포 시 새 SW 즉시 활성화 + 오래된 precache(구 JS) 정리.
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['icons/icon.svg', 'icons/maskable.svg', 'icons/apple-touch-icon.png'],
        manifest: {
          // id 고정 = 배포 경로가 같으면 같은 앱으로 인식(새 설치 취급/데이터 분리 방지).
          id: base,
          name: 'MODE',
          short_name: 'MODE',
          description: '내 상태를 원자료로 기록하는 개인 시계열 앱',
          lang: 'ko',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'portrait',
          theme_color: '#a985e8',
          background_color: '#ebe3fa',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // 앱 셸만 프리캐시. IndexedDB(개인 기록)는 캐시 대상이 아니며 로컬에 남는다.
          globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
          navigateFallback: `${base}index.html`,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
        },
      }),
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    test: {
      globals: true,
      environment: 'node',
      setupFiles: ['./src/test/setup.ts'],
    },
  }
})
