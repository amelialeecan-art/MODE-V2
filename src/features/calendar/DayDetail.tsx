import { useData, useAsyncData } from '@/app/DataContext'
import { loadDayRecords } from '@/data/queries/dayQuery'
import { summarizeDay } from '@/analysis/day/daySummary'
import { deriveSleep } from '@/analysis/sleep/deriveSleep'
import { dayCycleInfo, PHASE_LABEL } from '@/analysis/cycle/cyclePhase'
import { CORE_STATE_META, type CoreMetric } from '@/domain/state/coreState'
import { FLOW_LEVEL_LABEL } from '@/domain/cycle/cycleRecord'
import { RECOVERY_EFFECT_LABEL } from '@/domain/recovery/recoveryAction'
import { formatLocalDate, formatDuration, formatClock } from '@/shared/time/time'
import type { RatingValue } from '@/domain/common/types'

function ratingText(v: RatingValue | undefined): string {
  if (v === 'unknown') return '모름'
  if (typeof v === 'number') return String(v)
  return '—'
}

export function DayDetail({ date }: { date: string }) {
  const { repos, version, settings } = useData()
  const { data } = useAsyncData(async () => {
    const day = await loadDayRecords(repos, date)
    const cycleAll = await repos.cycle.all()
    return { day, cycleAll }
  }, [repos, version, date])

  if (!data) return <p className="muted">불러오는 중…</p>
  const { day } = data
  const summary = summarizeDay(day)
  const anyRecord = day.state.length || day.sleep.length || day.meals.length || day.cycle.length || day.context.length || day.recovery.length

  if (!anyRecord) return <p className="muted">{formatLocalDate(date)} — 기록 없음</p>

  return (
    <div>
      <div className="row-between">
        <b>{formatLocalDate(date)}</b>
      </div>

      {/* 1) RAW 기록 */}
      <div className="section-label">기록</div>
      {day.state.map((s) => (
        <div key={s.id} style={{ marginBottom: 10 }}>
          <div className="tiny dim">{s.checkInType === 'morning' ? '아침' : s.checkInType === 'evening' ? '저녁' : '수시'} 상태</div>
          {s.promptedMetrics.map((m) => (
            <div key={m} className="row-between tiny" style={{ padding: '2px 0' }}>
              <span className="muted">{CORE_STATE_META[m as CoreMetric].label}</span>
              <b>{ratingText(s.metrics[m as CoreMetric])}</b>
            </div>
          ))}
        </div>
      ))}
      {day.sleep.map((s) => {
        const d = deriveSleep(s)
        return (
          <div key={s.id} className="tiny" style={{ marginBottom: 6 }}>
            <span className="muted">수면 · </span>
            {d.sleepDuration != null ? `${formatDuration(d.sleepDuration)} 잠` : '시간 미상'}
            {s.wakeAt ? ` · 기상 ${formatClock(s.wakeAt)}` : ''}
            {s.satisfaction != null && s.satisfaction !== 'unknown' ? ` · 만족 ${s.satisfaction}` : ''}
          </div>
        )
      })}
      {day.meals.map((m) => (
        <div key={m.id} className="tiny muted" style={{ marginBottom: 4 }}>
          식사 {formatClock(m.startedAt)} · 음식 당김 {ratingText(m.preCraving)}{m.alcohol && m.alcohol.level !== 'none' ? ` · 술 ${m.alcohol.level}` : ''}
        </div>
      ))}
      {day.cycle.map((c) => (
        <div key={c.id} className="tiny muted" style={{ marginBottom: 4 }}>
          생리 {c.periodStart ? '시작 · ' : ''}{c.periodEnd ? '종료 · ' : ''}{c.flowLevel ? FLOW_LEVEL_LABEL[c.flowLevel] : ''}{c.painLevel != null && c.painLevel !== 'unknown' ? ` · 통증 ${c.painLevel}` : ''}
        </div>
      ))}
      {day.context.map((c) => (
        <span key={c.id} className="pill" style={{ marginRight: 6, marginBottom: 6, display: 'inline-block' }}>{c.label}</span>
      ))}
      {day.recovery.map((r) => (
        <div key={r.id} className="tiny muted">{r.label} → {RECOVERY_EFFECT_LABEL[r.effect]}</div>
      ))}

      {/* 2) DERIVED 요약 */}
      {summary.hasAnyState && (
        <>
          <div className="section-label">요약</div>
          <p className="tiny muted">상태 {summary.metrics.length}개 측정 · 식사 {summary.mealCount}회{summary.sleep?.sleepDuration != null ? ` · 수면 ${formatDuration(summary.sleep.sleepDuration)}` : ''}</p>
        </>
      )}

      {/* 3) 관련 pattern */}
      {settings.cycleEnabled && (() => {
        const cyc = dayCycleInfo(data.cycleAll, date)
        if (cyc.cycleDay == null) return null
        return (
          <>
            <div className="section-label">주기</div>
            <p className="tiny muted">주기 {cyc.cycleDay}일째 · {PHASE_LABEL[cyc.phase]}</p>
          </>
        )
      })()}
    </div>
  )
}
