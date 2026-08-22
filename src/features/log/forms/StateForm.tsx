import { useEffect, useState } from 'react'
import { Card, ScaleInput, Segmented } from '@/shared/ui/primitives'
import { FormShell } from './FormShell'
import { useData } from '@/app/DataContext'
import { CORE_STATE_META, promptedMetricsFor, type CoreMetric } from '@/domain/state/coreState'
import type { CoreMetricValues, CheckInType } from '@/domain/state/stateMeasurement'
import type { RatingValue } from '@/domain/common/types'
import { nowContext } from './formUtils'
import { todayLocalDate } from '@/shared/time/time'

export function StateForm({ onDone }: { onDone: () => void }) {
  const { repos, bump } = useData()
  const [checkInType, setCheckInType] = useState<Exclude<CheckInType, 'adhoc'>>('evening')
  const [values, setValues] = useState<CoreMetricValues>({})
  const prompted = promptedMetricsFor(checkInType)

  // 오늘 같은 체크인이 이미 있으면 불러와서 이어서 수정.
  useEffect(() => {
    let alive = true
    repos.state.byDate(todayLocalDate()).then((rows) => {
      if (!alive) return
      const existing = rows.find((r) => r.checkInType === checkInType)
      setValues(existing ? { ...existing.metrics } : {})
    })
    return () => { alive = false }
  }, [repos, checkInType])

  function setMetric(metric: CoreMetric, v: RatingValue | undefined) {
    setValues((prev) => {
      const next = { ...prev }
      if (v === undefined) delete next[metric]
      else next[metric] = v
      return next
    })
  }

  async function save() {
    const ctx = nowContext()
    // 실제로 값이 있거나 'unknown' 인 metric 만 저장. prompted 지만 손 안 댄 건 missing 으로 남긴다.
    const metrics: CoreMetricValues = {}
    const promptedTouched: CoreMetric[] = []
    for (const m of prompted) {
      if (m in values) { metrics[m] = values[m]!; promptedTouched.push(m) }
    }
    await repos.state.upsertCheckIn({
      ...ctx,
      checkInType,
      promptedMetrics: promptedTouched,
      metrics,
    })
    bump()
    onDone()
  }

  return (
    <FormShell
      title="상태 체크인"
      subtitle="지금 느끼는 만큼만. 안 건드린 항목은 '안 물어봄'으로 남아."
      onSave={save}
    >
      <Segmented<'morning' | 'evening'>
        options={[{ value: 'morning', label: '아침' }, { value: 'evening', label: '저녁' }]}
        value={checkInType}
        onChange={setCheckInType}
      />
      <Card className="" >
        {prompted.map((metric) => {
          const meta = CORE_STATE_META[metric]
          return (
            <ScaleInput
              key={metric}
              name={meta.label}
              lowLabel={meta.lowLabel}
              highLabel={meta.highLabel}
              value={values[metric]}
              onChange={(v) => setMetric(metric, v)}
            />
          )
        })}
      </Card>
      <p className="muted tiny" style={{ marginTop: 10 }}>
        슬라이더를 움직이면 그 값이 기록돼. '모름'은 물어봤지만 판단 안 되는 경우야.
      </p>
    </FormShell>
  )
}
