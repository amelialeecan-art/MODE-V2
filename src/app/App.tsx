import { HashRouter, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { DataProvider, useData } from './DataContext'
import { TodayScreen } from '@/features/today/TodayScreen'
import { RhythmScreen } from '@/features/rhythm/RhythmScreen'
import { CalendarScreen } from '@/features/calendar/CalendarScreen'
import { AnalysisScreen } from '@/features/analysis/AnalysisScreen'
import { SettingsScreen } from '@/features/settings/SettingsScreen'
import { LogScreen } from '@/features/log/LogScreen'

function BottomNav() {
  return (
    <nav className="nav">
      <NavLink to="/" end><span className="nav__icon">◐</span>오늘</NavLink>
      <NavLink to="/rhythm"><span className="nav__icon">〰</span>리듬</NavLink>
      <NavLink to="/calendar"><span className="nav__icon">▦</span>캘린더</NavLink>
      <NavLink to="/analysis"><span className="nav__icon">✦</span>분석</NavLink>
      <NavLink to="/settings"><span className="nav__icon">⚙</span>설정</NavLink>
    </nav>
  )
}

function Fab() {
  const nav = useNavigate()
  const loc = useLocation()
  if (loc.pathname.startsWith('/log')) return null
  return <button className="fab" aria-label="기록하기" onClick={() => nav('/log')}>＋</button>
}

function Shell() {
  const { ready } = useData()
  if (!ready) return <div className="app-shell"><div className="center-empty">불러오는 중…</div></div>
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<TodayScreen />} />
        <Route path="/rhythm" element={<RhythmScreen />} />
        <Route path="/calendar" element={<CalendarScreen />} />
        <Route path="/analysis" element={<AnalysisScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/log" element={<LogScreen />} />
        <Route path="/log/:kind" element={<LogScreen />} />
      </Routes>
      <Fab />
      <BottomNav />
    </div>
  )
}

export function App() {
  return (
    <DataProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </DataProvider>
  )
}
