import { useNavigate } from 'react-router-dom'
import { Card, Button, EmptyState } from '@/shared/ui/primitives'
import { useData, useAsyncData } from '@/app/DataContext'
import { loadDayRecords, loadRange } from '@/data/queries/dayQuery'
import { summarizeDay, compareToBaseline } from '@/analysis/day/daySummary'
import { CORE_STATE_META } from '@/domain/state/coreState'
import { narrateState } from './todayCopy'
import { comparedToUsual, lastNight, noDataToday } from '@/copy/tone'
import { formatDuration, formatLocalDate, todayLocalDate, addDays } from '@/shared/time/time'
import { signed } from '@/shared/statistics/stats'
import { dayCycleInfo, PHASE_LABEL } from '@/analysis/cycle/cyclePhase'

export function TodayScreen() {
  const { repos, tone, settings, version } = useData()
  const today = todayLocalDate()

  const { data } = useAsyncData(async () => {
    const day = await loadDayRecords(repos, today)
    const range = await loadRange(repos, addDays(today, -45), today)
    const cycleAll = await repos.cycle.all()
    return { day, range, cycleAll }
  }, [repos, version, today])

  const nav = useNavigate()
  if (!data) return <div className="screen"><div className="center-empty">불러오는 중…</div></div>

  const summary = summarizeDay(data.day)
  const history = data.range.state.filter((s) => s.localDate < today)
  const recentToday = data.day.state
  const cmp = compareToBaseline(history, recentToday)
  const phrases = narrateState(summary.metrics, tone)
  const cyc = settings.cycleEnabled ? dayCycleInfo(data.cycleAll, today) : null

  return (
    <div className="screen">
      <h1 className="screen__title">◐ 오늘</h1>
      <p className="screen__subtitle">{formatLocalDate(today)}</p>

      {!summary.hasAnyState ? (
        <Card>
          <EmptyState>
            <p>{noDataToday(tone)}</p>
            <div style={{ marginTop: 14 }}>
              <Button variant="primary" onClick={() => nav('/log/state')}>상태 남기기</Button>
            </div>
          </EmptyState>
        </Card>
      ) : (
        <Card>
          <div className="card__title" style={{ marginBottom: 8 }}>오늘은</div>
          {phrases.length > 0 ? (
            <p style={{ fontSize: 17, lineHeight: 1.7 }}>
              {phrases.join(tone.say(', ', ', '))}{tone.say('.', '.')}
            </p>
          ) : (
            <p className="muted">전반적으로 평소와 비슷한 하루야.</p>
          )}
        </Card>
      )}

      {summary.sleep && (summary.sleep.sleepDuration != null || summary.sleep.sleepLatency != null) && (
        <>
          <div className="section-label">{lastNight(tone)}</div>
          <Card>
            {summary.sleep.sleepDuration != null && (
              <div className="row-between"><span className="muted">잔 시간</span><b>{formatDuration(summary.sleep.sleepDuration)}</b></div>
            )}
            {summary.sleep.sleepLatency != null && (
              <div className="row-between" style={{ marginTop: 6 }}><span className="muted">잠들기까지</span><b>{formatDuration(summary.sleep.sleepLatency)}</b></div>
            )}
          </Card>
        </>
      )}

      {cmp.deltas.length > 0 && (
        <>
          <div className="section-label">{comparedToUsual(tone)}</div>
          <Card>
            {cmp.deltas.slice(0, 5).map((d) => {
              const meta = CORE_STATE_META[d.metric]
              const cls = d.delta > 0 ? 'delta-pos' : d.delta < 0 ? 'delta-neg' : 'delta-flat'
              return (
                <div key={d.metric} className="row-between" style={{ padding: '7px 0' }}>
                  <span className="metric-row__name">{meta.label}</span>
                  <span className={cls}>{signed(d.delta)}</span>
                </div>
              )
            })}
            <p className="tiny dim" style={{ marginTop: 8 }}>최근 값이 지난 기록 평균과 얼마나 다른지 (측정한 값만 사용).</p>
          </Card>
        </>
      )}

      {cyc && cyc.cycleDay != null && (
        <>
          <div className="section-label">생리 주기</div>
          <Card>
            <div className="row-between">
              <span className="muted">주기 {cyc.cycleDay}일째</span>
              <span className="pill">{PHASE_LABEL[cyc.phase]}</span>
            </div>
            {cyc.daysUntilNextPredicted != null && cyc.daysUntilNextPredicted >= 0 && (
              <p className="tiny dim" style={{ marginTop: 8 }}>기록된 주기 기준 예상 다음 생리까지 약 {cyc.daysUntilNextPredicted}일 (예측).</p>
            )}
          </Card>
        </>
      )}

      <div className="btn-row">
        <Button variant="primary" block onClick={() => nav('/log')}>＋ 오늘 기록 추가</Button>
      </div>
    </div>
  )
}
