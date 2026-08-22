import { useState } from 'react'
import { Card } from '@/shared/ui/primitives'
import { useData, useAsyncData } from '@/app/DataContext'
import { loadRecordDates } from '@/data/queries/dayQuery'
import { DayDetail } from './DayDetail'
import { todayLocalDate } from '@/shared/time/time'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month, 1))
  const startDow = first.getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  return cells
}

export function CalendarScreen() {
  const { repos, version } = useData()
  const today = todayLocalDate()
  const [ym, setYm] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })
  const [selected, setSelected] = useState<string | null>(today)

  const from = `${ym.y}-${String(ym.m + 1).padStart(2, '0')}-01`
  const lastDay = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate()
  const to = `${ym.y}-${String(ym.m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data: presence } = useAsyncData(() => loadRecordDates(repos, from, to), [repos, version, from, to])
  const cells = monthGrid(ym.y, ym.m)

  function shift(delta: number) {
    setYm(({ y, m }) => {
      const nm = m + delta
      return { y: y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 }
    })
  }

  return (
    <div className="screen">
      <h1 className="screen__title">▦ 캘린더</h1>
      <div className="row-between" style={{ margin: '14px 0' }}>
        <button className="btn btn--ghost" onClick={() => shift(-1)}>‹</button>
        <b>{ym.y}년 {ym.m + 1}월</b>
        <button className="btn btn--ghost" onClick={() => shift(1)}>›</button>
      </div>

      <div className="cal-week">{WEEK.map((w) => <span key={w}>{w}</span>)}</div>
      <div className="cal-grid">
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="cal-cell cal-cell--empty" />
          const p = presence?.get(date)
          const dnum = Number(date.slice(8))
          return (
            <button
              key={date}
              className={`cal-cell ${date === today ? 'today' : ''}`}
              style={{ outline: selected === date ? '2px solid var(--accent)' : 'none' }}
              onClick={() => setSelected(date)}
            >
              <span>{dnum}</span>
              <span className="cal-cell__dots">
                {(p?.morningState || p?.eveningState) && <i className="dot dot--state" />}
                {p?.sleep && <i className="dot dot--sleep" />}
                {p?.meals ? <i className="dot dot--meal" /> : null}
                {p?.cycle && <i className="dot dot--cycle" />}
                {p?.context && <i className="dot dot--context" />}
              </span>
            </button>
          )
        })}
      </div>

      <div className="legend" style={{ marginTop: 12 }}>
        <span><i className="dot dot--state" style={{ width: 8, height: 8, borderRadius: '50%' }} />상태</span>
        <span><i className="dot dot--sleep" style={{ width: 8, height: 8, borderRadius: '50%' }} />수면</span>
        <span><i className="dot dot--meal" style={{ width: 8, height: 8, borderRadius: '50%' }} />식사</span>
        <span><i className="dot dot--cycle" style={{ width: 8, height: 8, borderRadius: '50%' }} />생리</span>
        <span><i className="dot dot--context" style={{ width: 8, height: 8, borderRadius: '50%' }} />맥락</span>
      </div>

      {selected && (
        <div style={{ marginTop: 16 }}>
          <Card><DayDetail date={selected} /></Card>
        </div>
      )}
    </div>
  )
}
