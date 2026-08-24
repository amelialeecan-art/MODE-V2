import { HashRouter, Route, Routes } from 'react-router-dom'
import { DataProvider, useData } from './DataContext'
import { AppShell } from '@/design'
import { TodayScreen } from '@/features/today/TodayScreen'
import { RhythmScreen } from '@/features/rhythm/RhythmScreen'
import { CalendarScreen } from '@/features/calendar/CalendarScreen'
import { AnalysisScreen } from '@/features/analysis/AnalysisScreen'
import { SettingsScreen } from '@/features/settings/SettingsScreen'
import { LogScreen } from '@/features/log/LogScreen'

function Shell() {
  const { ready } = useData()
  if (!ready) return <AppShell><div className="center-empty">불러오는 중…</div></AppShell>
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<TodayScreen />} />
        <Route path="/rhythm" element={<RhythmScreen />} />
        <Route path="/calendar" element={<CalendarScreen />} />
        <Route path="/analysis" element={<AnalysisScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/log" element={<LogScreen />} />
        <Route path="/log/:kind" element={<LogScreen />} />
      </Routes>
    </AppShell>
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
