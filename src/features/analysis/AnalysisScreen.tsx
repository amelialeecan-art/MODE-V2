import { GlassCard, SectionHeader } from '@/design'
import { useData, useAsyncData } from '@/app/DataContext'
import { loadRange } from '@/data/queries/dayQuery'
import { buildAnalysisReport } from '@/analysis/report/analysisReport'
import { CORE_STATE_META } from '@/domain/state/coreState'
import { addDays, todayLocalDate } from '@/shared/time/time'
import { signed } from '@/shared/statistics/stats'
import './analysis.css'

export function AnalysisScreen() {
  const { repos, version } = useData()
  const today = todayLocalDate()

  const { data } = useAsyncData(async () => {
    const range = await loadRange(repos, addDays(today, -90), today)
    return buildAnalysisReport(range, today)
  }, [repos, version, today])

  if (!data) return <div className="screen"><div className="center-empty">불러오는 중…</div></div>

  if (data.totalStateDays < 3) {
    return (
      <div className="screen">
        <header className="screen-head"><h1 className="screen-head__title">분석</h1></header>
        <GlassCard>
          <p className="ana-empty">기록이 조금 더 쌓이면 여기서 변화와 경향을 보여줄게. 지금은 {data.totalStateDays}일 치라 아직 일러.</p>
        </GlassCard>
      </div>
    )
  }

  const { recentChange, associations, recovery } = data

  return (
    <div className="screen">
      <header className="screen-head">
        <h1 className="screen-head__title">분석</h1>
        <p className="screen-head__sub">최근 {data.totalStateDays}일의 기록을 바탕으로 · 원인이 아니라 함께 나타난 경향이야</p>
      </header>

      {/* Q1 — 요즘 뭐가 달라졌지? */}
      <GlassCard tint="lav">
        <SectionHeader title="요즘 뭐가 달라졌지?" subtitle="지난 기록 평균과 요즘이 얼마나 다른지" />
        {recentChange.deltas.length === 0 && recentChange.morningEvening.length === 0 ? (
          <p className="ana-empty">요즘 값이 평소와 크게 다르지 않아.</p>
        ) : (
          <>
            {recentChange.deltas.map((d) => (
              <div key={d.metric} className="ana-row">
                <span className="ana-row__name">{CORE_STATE_META[d.metric].label}</span>
                <span className={`ana-row__delta ${d.delta > 0 ? 'delta-pos' : 'delta-neg'}`}>평소보다 {signed(d.delta)}</span>
              </div>
            ))}
            {recentChange.morningEvening.length > 0 && (
              <div className="ana-me">
                <p className="ana-me__title">아침 → 저녁 변화 (시각이 기록된 날만)</p>
                {recentChange.morningEvening.map((s) => (
                  <div key={s.metric} className="ana-me__row">
                    <span>{CORE_STATE_META[s.metric].label}</span>
                    <b>{s.avgChange > 0 ? '저녁에 더 높아짐' : '저녁에 더 낮아짐'} ({signed(s.avgChange)})</b>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </GlassCard>

      {/* Q2 — 무엇과 같이 나타났지? */}
      <GlassCard tint="sky">
        <SectionHeader title="무엇과 같이 나타났지?" subtitle="어떤 일이 있던 날, 함께 두드러졌던 것" />
        {associations.length === 0 ? (
          <p className="ana-empty">아직 뚜렷하게 함께 움직인 것은 안 보여. 기록이 더 쌓이면 나타나.</p>
        ) : (
          associations.map((a, i) => {
            const label = CORE_STATE_META[a.metric].label
            const dir = a.result.diff > 0 ? '높았어' : '낮았어'
            return (
              <div key={i} style={i > 0 ? { marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' } : undefined}>
                <p className="ana-say">
                  <b>{a.exposureLabel}</b>이 있던 날, {label}이 평소보다 {dir}
                  <span className={a.result.diff > 0 ? 'delta-pos' : 'delta-neg'}> ({signed(a.result.diff)})</span>
                </p>
                <p className="ana-meta">있던 날 {a.result.nPresent}일 · 없던 날 {a.result.nAbsent}일 · 함께 나타나는 경향 (원인 여부는 알 수 없어)</p>
              </div>
            )
          })
        )}
      </GlassCard>

      {/* Q3 — 무엇을 했을 때 달랐지? */}
      <GlassCard tint="mint">
        <SectionHeader title="무엇을 했을 때 달랐지?" subtitle="'한 일'을 남긴 뒤 스스로 보고한 느낌" />
        {recovery.length === 0 ? (
          <p className="ana-empty">'한 일' 기록이 더 쌓이면 여기 나와.</p>
        ) : (
          <>
            {recovery.map((r) => (
              <div key={r.label} className="ana-rec">
                <span className="ana-rec__name">{r.label}</span>
                <span className="ana-rec__tally">{r.total}번 중 나아짐 {r.betterCount}{r.worseCount ? ` · 나빠짐 ${r.worseCount}` : ''}</span>
              </div>
            ))}
            <p className="ana-meta" style={{ marginTop: 10 }}>내가 스스로 보고한 느낌이야.</p>
          </>
        )}
      </GlassCard>
    </div>
  )
}
