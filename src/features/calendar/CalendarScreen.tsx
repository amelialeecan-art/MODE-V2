import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData, useAsyncData } from '@/app/DataContext'
import { loadRecordDates } from '@/data/queries/dayQuery'
import { bleedingSpans } from '@/analysis/cycle/cyclePhase'
import { todayLocalDate, addDays } from '@/shared/time/time'
import { DayDetailSheet } from './DayDetail'
import './calendar.css'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const startOfMonth = () => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } }
const pad2 = (n: number) => String(n).padStart(2, '0')

function monthGrid(year: number, month: number): (string | null)[] {
  const startDow = new Date(Date.UTC(year, month, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const cells: (string | null)[] = Array(startDow).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${year}-${pad2(month + 1)}-${pad2(d)}`)
  return cells
}

export function CalendarScreen() {
  const { repos, version } = useData()
  const nav = useNavigate()
  const today = todayLocalDate()
  const nowMonth = useMemo(startOfMonth, [])
  const [ym, setYm] = useState(nowMonth)
  const [selected, setSelected] = useState<string | null>(null)

  const from = `${ym.y}-${pad2(ym.m + 1)}-01`
  const lastDay = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate()
  const to = `${ym.y}-${pad2(ym.m + 1)}-${pad2(lastDay)}`

  const { data } = useAsyncData(async () => {
    const presence = await loadRecordDates(repos, from, to)
    const cycleAll = await repos.cycle.all()
    return { presence, cycleAll }
  }, [repos, version, from, to])

  // 실제 관측된 출혈 구간만 pink band 로. (예측 없음)
  const periodDays = useMemo(() => {
    const set = new Set<string>()
    for (const s of bleedingSpans(data?.cycleAll ?? [])) {
      for (let d = s.start; d <= s.end; d = addDays(d, 1)) set.add(d)
    }
    return set
  }, [data])

  const cells = monthGrid(ym.y, ym.m)
  const isCurrentMonth = ym.y === nowMonth.y && ym.m === nowMonth.m

  function shift(delta: number) {
    setYm(({ y, m }) => { const nm = m + delta; return { y: y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 } })
  }
  const hasEntry = (date: string) => {
    const p = data?.presence.get(date)
    return !!p && (p.morningState || p.eveningState || p.sleep || p.meals > 0 || p.cycle || p.context)
  }

  return (
    <div className="screen">
      <header className="calhead">
        <div className="calnav">
          <button className="calnav__btn" aria-label="이전 달" onClick={() => shift(-1)}>‹</button>
          <span className="calhead__m">{ym.y}년 {ym.m + 1}월</span>
          <button className="calnav__btn" aria-label="다음 달" disabled={isCurrentMonth} onClick={() => !isCurrentMonth && shift(1)}>›</button>
        </div>
        {!isCurrentMonth && <button className="caltoday" onClick={() => setYm(nowMonth)}>오늘</button>}
      </header>

      <div className="calcard">
        <div className="dow">{WEEK.map((w, i) => <span key={w} className={i === 0 ? 'dow__sun' : undefined}>{w}</span>)}</div>
        <div className="grid">
          {cells.map((date, i) => {
            if (!date) return <div key={`pad-${i}`} className="cell cell--pad" />
            const period = periodDays.has(date)
            const entry = hasEntry(date)
            const cls = ['cell']
            if (period) cls.push('cell--period')
            if (date === today) cls.push('cell--today')
            if (date === selected) cls.push('cell--sel')
            return (
              <button key={date} className={cls.join(' ')} onClick={() => setSelected(date)}>
                <span className="cell__n">{Number(date.slice(8))}</span>
                {entry && <span className="cell__mark" />}
              </button>
            )
          })}
        </div>
      </div>

      <div className="callegend">
        <span><i className="dot" />기록 있음</span>
        <span><i className="band" />생리(출혈 기간)</span>
      </div>

      {selected && (
        <DayDetailSheet date={selected} onClose={() => setSelected(null)} onRecord={(d) => nav(`/log?date=${d}`)} />
      )}
    </div>
  )
}
