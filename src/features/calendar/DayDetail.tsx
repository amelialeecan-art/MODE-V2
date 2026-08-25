import { useData, useAsyncData } from '@/app/DataContext'
import { loadDayRecords, loadRange } from '@/data/queries/dayQuery'
import { summarizeDay, compareToBaseline, CORE_STATE_META } from '@/analysis/day/daySummary'
import { deriveSleep } from '@/analysis/sleep/deriveSleep'
import { dayCycleInfo, bleedingSpans } from '@/analysis/cycle/cyclePhase'
import { type CoreMetric } from '@/domain/state/coreState'
import { FLOW_LEVEL_LABEL } from '@/domain/cycle/cycleRecord'
import { RECOVERY_EFFECT_LABEL } from '@/domain/recovery/recoveryAction'
import { mean, signed } from '@/shared/statistics/stats'
import { formatLocalDate, formatDuration, formatClock } from '@/shared/time/time'
import type { RatingValue } from '@/domain/common/types'

function ratingText(v: RatingValue | undefined): string {
  if (v === 'unknown') return '모름'
  if (typeof v === 'number') return String(v)
  return '—'
}

interface Glance { name: string; val: string; delta?: number; cycle?: boolean }

export function DayDetailSheet({
  date, onClose, onRecord,
}: { date: string; onClose: () => void; onRecord: (date: string) => void }) {
  const { repos, version, settings } = useData()
  const { data } = useAsyncData(async () => {
    const day = await loadDayRecords(repos, date)
    const range = await loadRange(repos, addDaysBack(date, 45), date)
    const cycleAll = await repos.cycle.all()
    return { day, range, cycleAll }
  }, [repos, version, date])

  const anyRecord = data && (data.day.state.length || data.day.sleep.length || data.day.meals.length || data.day.cycle.length || data.day.context.length || data.day.recovery.length)

  return (
    <>
      <div className="sheet-scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={`${formatLocalDate(date)} 상세`}>
        <div className="sheet__handle" />
        <p className="sheet__date">{formatLocalDate(date)}</p>

        {!data ? (
          <p className="sheet__hint">불러오는 중…</p>
        ) : !anyRecord ? (
          <>
            <p className="sheet__hint">이 날은 아직 기록이 없어.</p>
            <button className="btn-primary sheet__record" onClick={() => onRecord(date)}>이 날짜 기록하기</button>
          </>
        ) : (
          <Body date={date} data={data} cycleEnabled={settings.cycleEnabled} />
        )}

        <button className="sheet__closebtn" onClick={onClose}>닫기</button>
      </div>
    </>
  )
}

function addDaysBack(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

function Body({ date, data, cycleEnabled }: {
  date: string
  data: { day: Awaited<ReturnType<typeof loadDayRecords>>; range: Awaited<ReturnType<typeof loadRange>>; cycleAll: Parameters<typeof bleedingSpans>[0] }
  cycleEnabled: boolean
}) {
  const { day, range, cycleAll } = data
  const summary = summarizeDay(day)
  const history = range.state.filter((s) => s.localDate < date)
  const cmp = compareToBaseline(history, day.state)

  // 관측된 출혈 구간 안이면 "생리 N일차" (예측 아님)
  const inBleed = bleedingSpans(cycleAll).some((s) => date >= s.start && date <= s.end)
  const cyc = cycleEnabled ? dayCycleInfo(cycleAll, date) : null

  // 수면: 이 날 vs 과거 평균
  const sleepDur = summary.sleep?.sleepDuration ?? null
  const histSleep = history.length
    ? mean(range.sleep.filter((s) => s.localDate < date).map((s) => deriveSleep(s).sleepDuration).filter((x): x is number => x != null))
    : NaN
  const sleepDiff = sleepDur != null && Number.isFinite(histSleep) ? sleepDur - histSleep : null

  // ── 이날 한눈에: 가장 두드러진 2~4개 ──
  const glances: (Glance & { mag: number })[] = []
  if (inBleed && cyc?.cycleDay != null) glances.push({ name: '생리', val: `${cyc.cycleDay}일차`, cycle: true, mag: Infinity })
  for (const d of cmp.deltas.slice(0, 3)) {
    glances.push({ name: CORE_STATE_META[d.metric].label, val: String(d.value), delta: d.delta, mag: Math.abs(d.delta) })
  }
  if (sleepDur != null) {
    const magH = sleepDiff != null ? Math.abs(sleepDiff) / 60 : 0
    let tail = ''
    if (sleepDiff != null && Math.abs(sleepDiff) >= 30) {
      const h = Math.round(Math.abs(sleepDiff) / 60 * 10) / 10
      tail = ` · 평소보다 ${h}시간 ${sleepDiff < 0 ? '짧게' : '길게'} 잤어`
    }
    glances.push({ name: '수면', val: `${formatDuration(sleepDur)}${tail}`, mag: 1.2 + magH })
  }
  const topGlance = glances.sort((a, b) => b.mag - a.mag).slice(0, 4)

  return (
    <div className="sheet__body">
      {/* 이날 한눈에 */}
      {topGlance.length > 0 && (
        <div className="sheet-section">
          <p className="sheet-section__title">이날 한눈에</p>
          <div className="glance">
            {topGlance.map((g, i) => g.cycle ? (
              <div className="glance__cycle" key={i}>{g.name} {g.val}</div>
            ) : (
              <div className="glance__row" key={i}>
                <span className="glance__name">{g.name}</span>
                <span className="glance__val">
                  {g.val}
                  {g.delta != null && <span className={`glance__delta ${g.delta > 0 ? 'delta-pos' : g.delta < 0 ? 'delta-neg' : 'delta-flat'}`}> · 평소보다 {signed(g.delta)}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 수면 */}
      {summary.sleep && (sleepDur != null || summary.sleep.sleepLatency != null || summary.sleepSatisfaction != null) && (
        <div className="sheet-section">
          <p className="sheet-section__title">수면</p>
          {sleepDur != null && <p className="sheet-fact">{formatDuration(sleepDur)} 잠</p>}
          {summary.sleep.sleepLatency != null && <p className="sheet-fact">잠들기까지 {formatDuration(summary.sleep.sleepLatency)}</p>}
          {summary.sleepSatisfaction != null && summary.sleepSatisfaction !== 'unknown' && <p className="sheet-fact">만족 {summary.sleepSatisfaction}</p>}
        </div>
      )}

      {/* 식사 */}
      {day.meals.length > 0 && (
        <div className="sheet-section">
          <p className="sheet-section__title">식사 {day.meals.length}회</p>
          {day.meals.map((m) => (
            <p className="sheet-fact" key={m.id}>
              {formatClock(m.startedAt)} · 음식 당김 {ratingText(m.preCraving)}
              {m.alcohol && m.alcohol.level !== 'none' ? ` · 술 ${m.alcohol.level}` : ''}
            </p>
          ))}
        </div>
      )}

      {/* 오늘 있었던 일 */}
      {day.context.length > 0 && (
        <div className="sheet-section">
          <p className="sheet-section__title">오늘 있었던 일</p>
          <div className="sheet-chips">{day.context.map((c) => <span className="sheet-chip" key={c.id}>{c.label}</span>)}</div>
        </div>
      )}

      {/* 한 일 */}
      {day.recovery.length > 0 && (
        <div className="sheet-section">
          <p className="sheet-section__title">한 일</p>
          <div className="sheet-chips">{day.recovery.map((r) => <span className="sheet-chip sheet-chip--mint" key={r.id}>{r.label} · {RECOVERY_EFFECT_LABEL[r.effect]}</span>)}</div>
        </div>
      )}

      {/* 생리 기록 (관측된 사실만) */}
      {day.cycle.length > 0 && (
        <div className="sheet-section">
          <p className="sheet-section__title">생리 기록</p>
          {day.cycle.map((c) => (
            <p className="sheet-fact" key={c.id}>
              {c.periodStart ? '생리 시작 · ' : ''}{c.periodEnd ? '생리 종료 · ' : ''}
              {c.flowLevel ? `출혈 ${FLOW_LEVEL_LABEL[c.flowLevel]}` : ''}
              {c.painLevel != null && c.painLevel !== 'unknown' ? ` · 통증 ${c.painLevel}` : ''}
            </p>
          ))}
        </div>
      )}

      {/* 전체 기록 보기 — 모든 raw 숫자는 여기서만 */}
      {day.state.length > 0 && (
        <details className="sheet-all">
          <summary className="sheet-all__sum">전체 기록 보기</summary>
          {day.state.map((s) => (
            <div className="sheet-all__block" key={s.id}>
              <p className="sheet-all__ci">{s.checkInType === 'morning' ? '아침' : s.checkInType === 'evening' ? '저녁' : '수시'} 상태</p>
              {s.promptedMetrics.map((m) => (
                <div className="sheet-all__row" key={m}>
                  <span>{CORE_STATE_META[m as CoreMetric].label}</span>
                  <b>{ratingText(s.metrics[m as CoreMetric])}</b>
                </div>
              ))}
            </div>
          ))}
        </details>
      )}
    </div>
  )
}
