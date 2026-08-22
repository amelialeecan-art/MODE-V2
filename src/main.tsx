import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from '@/app/App'
import '@/shared/ui/theme.css'

// 장기 기록이 핵심인 앱 — 브라우저에 "이 IndexedDB 를 함부로 비우지 말라"고 요청(best-effort).
// 실패해도 동작에는 영향 없음. 데이터는 어떤 경우에도 서버로 나가지 않는다(로컬 전용).
if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {})
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
