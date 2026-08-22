import { useState } from 'react'
import { Card, ScaleInput, Segmented, Chip } from '@/shared/ui/primitives'
import { FormShell } from './FormShell'
import { useData } from '@/app/DataContext'
import { nowContext } from './formUtils'
import type { RatingValue } from '@/domain/common/types'
import { FLOW_LEVEL_LABEL, type FlowLevel } from '@/domain/cycle/cycleRecord'

export function CycleForm({ onDone }: { onDone: () => void }) {
  const { repos, bump } = useData()
  const [periodStart, setPeriodStart] = useState(false)
  const [periodEnd, setPeriodEnd] = useState(false)
  const [flow, setFlow] = useState<FlowLevel | null>('normal')
  const [pain, setPain] = useState<RatingValue | undefined>(undefined)

  async function save() {
    const ctx = nowContext()
    await repos.cycle.put({
      localDate: ctx.localDate,
      timezoneOffsetMinutes: ctx.timezoneOffsetMinutes,
      source: 'manual',
      periodStart,
      periodEnd,
      flowLevel: flow,
      painLevel: pain ?? null,
    })
    bump()
    onDone()
  }

  const flows: FlowLevel[] = ['spotting', 'light', 'normal', 'heavy']
  return (
    <FormShell title="생리" subtitle="사실만 기록해. 시기(배란·황체 등)는 앱이 나중에 계산해." onSave={save}>
      <Card>
        <div className="scale__name" style={{ marginBottom: 8 }}>오늘</div>
        <div className="chips">
          <Chip active={periodStart} onClick={() => setPeriodStart((v) => !v)}>생리 시작</Chip>
          <Chip active={periodEnd} onClick={() => setPeriodEnd((v) => !v)}>생리 종료</Chip>
        </div>
        <div className="scale__name" style={{ margin: '16px 0 8px' }}>출혈량</div>
        <Segmented<FlowLevel | 'none'>
          options={[...flows.map((f) => ({ value: f, label: FLOW_LEVEL_LABEL[f] })), { value: 'none' as const, label: '—' }]}
          value={flow ?? 'none'}
          onChange={(v) => setFlow(v === 'none' ? null : v)}
        />
        <div style={{ marginTop: 16 }}>
          <ScaleInput name="통증" lowLabel="없음" highLabel="매우 심함" value={pain} onChange={setPain} />
        </div>
      </Card>
    </FormShell>
  )
}
