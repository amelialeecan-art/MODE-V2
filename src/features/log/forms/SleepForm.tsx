import { useState } from 'react'
import { Card, ScaleInput } from '@/shared/ui/primitives'
import { FormShell } from './FormShell'
import { useData } from '@/app/DataContext'
import { nowContext } from './formUtils'
import type { RatingValue } from '@/domain/common/types'
import { addDays, todayLocalDate } from '@/shared/time/time'

/** HH:MM + wake 날짜 기준 → ISO datetime. 낮 12시 이후 시각은 전날로 간주. */
function buildAt(hhmm: string, wakeDate: string, tz: number): string | null {
  if (!hhmm) return null
  const [h] = hhmm.split(':').map(Number)
  const date = h >= 12 ? addDays(wakeDate, -1) : wakeDate
  const sign = tz >= 0 ? '+' : '-'
  const abs = Math.abs(tz)
  const off = `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`
  return `${date}T${hhmm}:00.000${off}`
}

export function SleepForm({ onDone }: { onDone: () => void }) {
  const { repos, bump } = useData()
  const [bed, setBed] = useState('')
  const [onset, setOnset] = useState('')
  const [wake, setWake] = useState('')
  const [awakenings, setAwakenings] = useState<string>('')
  const [satisfaction, setSatisfaction] = useState<RatingValue | undefined>(undefined)

  async function save() {
    const ctx = nowContext()
    const wakeDate = todayLocalDate(ctx.timezoneOffsetMinutes)
    await repos.sleep.put({
      localDate: wakeDate,
      timezoneOffsetMinutes: ctx.timezoneOffsetMinutes,
      source: 'manual',
      wentToBedAt: buildAt(bed, wakeDate, ctx.timezoneOffsetMinutes),
      sleepOnsetAt: buildAt(onset, wakeDate, ctx.timezoneOffsetMinutes),
      wakeAt: buildAt(wake, wakeDate, ctx.timezoneOffsetMinutes),
      awakenings: awakenings === '' ? null : Number(awakenings),
      satisfaction: satisfaction ?? null,
      durationMinutes: null, // 신규는 시각으로 파생. 추정 안 함.
    })
    bump()
    onDone()
  }

  return (
    <FormShell title="수면" subtitle="아는 시각만 넣어도 돼. 비우면 그 값은 계산에 안 써." onSave={save}>
      <Card>
        <label className="stack">
          <span className="scale__name">잠자리에 든 시각</span>
          <input type="time" value={bed} onChange={(e) => setBed(e.target.value)} />
        </label>
        <hr className="soft" />
        <label className="stack">
          <span className="scale__name">잠든 시각</span>
          <input type="time" value={onset} onChange={(e) => setOnset(e.target.value)} />
        </label>
        <hr className="soft" />
        <label className="stack">
          <span className="scale__name">깬 시각</span>
          <input type="time" value={wake} onChange={(e) => setWake(e.target.value)} />
        </label>
        <hr className="soft" />
        <label className="stack">
          <span className="scale__name">밤중에 깬 횟수</span>
          <input type="number" min={0} inputMode="numeric" value={awakenings} onChange={(e) => setAwakenings(e.target.value)} placeholder="모르면 비워둬" />
        </label>
      </Card>
      <Card>
        <ScaleInput name="수면 만족도" lowLabel="많이 부족" highLabel="아주 개운" value={satisfaction} onChange={setSatisfaction} />
      </Card>
    </FormShell>
  )
}
