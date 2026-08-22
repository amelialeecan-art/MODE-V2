import { Card, EmptyState } from '@/shared/ui/primitives'
import { useData, useAsyncData } from '@/app/DataContext'
import { loadRange } from '@/data/queries/dayQuery'
import { buildAnalysisReport } from '@/analysis/report/analysisReport'
import { CORE_STATE_META } from '@/domain/state/coreState'
import { addDays, todayLocalDate } from '@/shared/time/time'
import { signed } from '@/shared/statistics/stats'

export function AnalysisScreen() {
  const { repos, version, tone } = useData()
  const today = todayLocalDate()

  const { data } = useAsyncData(async () => {
    const range = await loadRange(repos, addDays(today, -90), today)
    return buildAnalysisReport(range, today)
  }, [repos, version, today])

  if (!data) return <div className="screen"><div className="center-empty">불러오는 중…</div></div>

  if (data.totalStateDays < 3) {
    return (
      <div className="screen">
        <h1 className="screen__title">✦ 분석</h1>
        <Card><EmptyState>기록이 조금 더 쌓이면 여기서 변화와 경향을 보여줄게. (지금 {data.totalStateDays}일)</EmptyState></Card>
      </div>
    )
  }

  const { recentChange, associations, recovery } = data

  return (
    <div className="screen">
      <h1 className="screen__title">✦ 분석</h1>
      <p className="screen__subtitle">최근 {data.totalStateDays}일의 기록 기준</p>

      {/* Q1 */}
      <div className="section-label">요즘 뭐가 달라졌지?</div>
      <Card>
        {recentChange.deltas.length === 0 && recentChange.morningEvening.length === 0 && (
          <p className="muted tiny">최근 값이 평소와 크게 다르지 않아.</p>
        )}
        {recentChange.deltas.map((d) => {
          const meta = CORE_STATE_META[d.metric]
          const cls = d.delta > 0 ? 'delta-pos' : 'delta-neg'
          return (
            <div key={d.metric} className="row-between" style={{ padding: '6px 0' }}>
              <span className="metric-row__name">{meta.label}</span>
              <span className={cls}>평소보다 {signed(d.delta)}</span>
            </div>
          )
        })}
        {recentChange.morningEvening.length > 0 && (
          <>
            <hr className="soft" />
            <p className="tiny dim" style={{ marginBottom: 6 }}>아침 → 저녁 변화 (시각이 기록된 날만)</p>
            {recentChange.morningEvening.map((s) => (
              <div key={s.metric} className="row-between tiny" style={{ padding: '3px 0' }}>
                <span className="muted">{CORE_STATE_META[s.metric].label}</span>
                <b>{s.avgChange > 0 ? '저녁에 더 높아짐' : '저녁에 더 낮아짐'} ({signed(s.avgChange)})</b>
              </div>
            ))}
          </>
        )}
      </Card>

      {/* Q2 */}
      <div className="section-label">무엇과 같이 나타났지?</div>
      {associations.length === 0 ? (
        <Card><p className="muted tiny">아직 뚜렷하게 함께 움직인 것은 안 보여.</p></Card>
      ) : (
        associations.map((a, i) => {
          const meta = CORE_STATE_META[a.metric]
          const dir = a.result.diff > 0 ? '높았음' : '낮았음'
          return (
            <Card key={i}>
              <p>
                <b>{a.exposureLabel}</b>이 있던 날, {tone.say(`${meta.label}가 평소보다 ${dir}`, `${meta.label}가 평소보다 ${dir}`)}
                <span className={a.result.diff > 0 ? 'delta-pos' : 'delta-neg'}> ({signed(a.result.diff)})</span>
              </p>
              <p className="tiny dim" style={{ marginTop: 4 }}>
                있던 날 {a.result.nPresent}일 · 없던 날 {a.result.nAbsent}일 · 함께 나타나는 경향 (원인 여부는 알 수 없어)
              </p>
            </Card>
          )
        })
      )}

      {/* Q3 */}
      <div className="section-label">무엇을 했을 때 달랐지?</div>
      {recovery.length === 0 ? (
        <Card><p className="muted tiny">'한 일' 기록이 더 쌓이면 여기 나와.</p></Card>
      ) : (
        <Card>
          {recovery.map((r) => (
            <div key={r.label} className="row-between" style={{ padding: '6px 0' }}>
              <span className="metric-row__name">{r.label}</span>
              <span className="tiny muted">{r.total}번 중 나아짐 {r.betterCount}{r.worseCount ? ` · 나빠짐 ${r.worseCount}` : ''}</span>
            </div>
          ))}
          <p className="tiny dim" style={{ marginTop: 6 }}>내가 스스로 보고한 느낌이야.</p>
        </Card>
      )}
    </div>
  )
}
