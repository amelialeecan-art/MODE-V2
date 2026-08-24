import { useNavigate } from 'react-router-dom'
import { GlassCard, SectionHeader, Mascot } from '@/design'
import { useData, useAsyncData } from '@/app/DataContext'
import { loadDayRecords, loadRange } from '@/data/queries/dayQuery'
import { summarizeDay, compareToBaseline } from '@/analysis/day/daySummary'
import { CORE_STATE_META } from '@/domain/state/coreState'
import { narrateState } from './todayCopy'
import { comparedToUsual, lastNight, noDataToday } from '@/copy/tone'
import { formatDuration, formatLocalDate, todayLocalDate, addDays } from '@/shared/time/time'
import { signed } from '@/shared/statistics/stats'
import { dayCycleInfo, PHASE_LABEL } from '@/analysis/cycle/cyclePhase'
import './today.css'

const SettingsGear = ({ onClick }: { onClick: () => void }) => (
  <button className="topbar__settings" aria-label="설정" onClick={onClick}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1H2a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 3.6 8.5a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H8a1.7 1.7 0 0 0 1-1.56V2a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V8a1.7 1.7 0 0 0 1.56 1H22a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z" />
    </svg>
  </button>
)

export function TodayScreen() {
  const { repos, tone, settings, version } = useData()
  const today = todayLocalDate()
  const nav = useNavigate()

  const { data } = useAsyncData(async () => {
    const day = await loadDayRecords(repos, today)
    const range = await loadRange(repos, addDays(today, -45), today)
    const cycleAll = await repos.cycle.all()
    return { day, range, cycleAll }
  }, [repos, version, today])

  if (!data) return <div className="screen"><div className="center-empty">불러오는 중…</div></div>

  const summary = summarizeDay(data.day)
  const history = data.range.state.filter((s) => s.localDate < today)
  const cmp = compareToBaseline(history, data.day.state)
  const phrases = narrateState(summary.metrics, tone)
  const cyc = settings.cycleEnabled ? dayCycleInfo(data.cycleAll, today) : null

  // 가장 의미 있는 변화 먼저: 절댓값 큰 순 상위 3개만.
  const topDeltas = [...cmp.deltas].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3)
  const hasSleep = !!summary.sleep && (summary.sleep.sleepDuration != null || summary.sleep.sleepLatency != null)

  return (
    <div className="screen">
      <header className="today-top">
        <div>
          <h1 className="screen__title">오늘</h1>
          <p className="screen__subtitle">{formatLocalDate(today)}</p>
        </div>
        <SettingsGear onClick={() => nav('/settings')} />
      </header>

      {!summary.hasAnyState ? (
        <GlassCard>
          <div className="today-empty">
            <Mascot mood="calm" size={92} />
            <p className="today-empty__title">아직 오늘 기록이 없어</p>
            <p className="today-empty__sub">{noDataToday(tone)}</p>
            <button className="btn-primary today-empty__btn" onClick={() => nav('/log')}>오늘 기록하기</button>
          </div>
        </GlassCard>
      ) : (
        <>
          {/* 오늘 주요 상태 */}
          <GlassCard>
            <SectionHeader title="오늘 상태" subtitle="오늘 남긴 기록이야" right={<Mascot mood="happy" size={44} />} />
            {phrases.length > 0 ? (
              phrases.map((p, i) => <p className="today-state-line" key={i}>{p}{tone.say('.', '.')}</p>)
            ) : (
              <p className="today-state-line" style={{ color: 'var(--ink-2)', fontWeight: 500 }}>전반적으로 평소와 비슷한 하루야.</p>
            )}
          </GlassCard>

          {/* 평소와 비교 — 가장 의미 있는 변화만 */}
          {topDeltas.length > 0 && (
            <GlassCard>
              <SectionHeader title={comparedToUsual(tone)} subtitle="지난 기록 평균과 가장 달라진 것부터 (측정한 값만)" />
              {topDeltas.map((d) => {
                const cls = d.delta > 0 ? 'delta-pos' : d.delta < 0 ? 'delta-neg' : 'delta-flat'
                return (
                  <div key={d.metric} className="today-row">
                    <span className="today-row__name">{CORE_STATE_META[d.metric].label}</span>
                    <span className={cls}>{signed(d.delta)}</span>
                  </div>
                )
              })}
            </GlassCard>
          )}

          {/* 지난밤 수면 */}
          {hasSleep && summary.sleep && (
            <GlassCard tint="sky">
              <SectionHeader title={lastNight(tone)} />
              {summary.sleep.sleepDuration != null && (
                <div className="today-row"><span className="today-row__name">잔 시간</span><b>{formatDuration(summary.sleep.sleepDuration)}</b></div>
              )}
              {summary.sleep.sleepLatency != null && (
                <div className="today-row"><span className="today-row__name">잠들기까지</span><b>{formatDuration(summary.sleep.sleepLatency)}</b></div>
              )}
            </GlassCard>
          )}

          {/* 생리 주기 */}
          {cyc && cyc.cycleDay != null && (
            <GlassCard tint="lav">
              <SectionHeader title="생리 주기" />
              <div className="today-row">
                <span className="today-row__name">주기 {cyc.cycleDay}일째</span>
                <span className="pill">{PHASE_LABEL[cyc.phase]}</span>
              </div>
              {cyc.daysUntilNextPredicted != null && cyc.daysUntilNextPredicted >= 0 && (
                <p className="tiny dim" style={{ marginTop: 8 }}>기록된 주기 기준 예상 다음 생리까지 약 {cyc.daysUntilNextPredicted}일 (예측).</p>
              )}
            </GlassCard>
          )}

          <button className="quick-record" onClick={() => nav('/log')}>
            <span className="quick-record__plus">＋</span>
            <span>오늘 기록 다시 남기기</span>
          </button>
        </>
      )}
    </div>
  )
}
