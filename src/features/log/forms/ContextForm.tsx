import { useState } from 'react'
import { Card, ScaleInput, Chip } from '@/shared/ui/primitives'
import { FormShell } from './FormShell'
import { useData } from '@/app/DataContext'
import { nowContext } from './formUtils'
import type { RatingValue } from '@/domain/common/types'
import { CONTEXT_EVENT_CATALOG, CONTEXT_CATEGORY_LABEL, type ContextCategory } from '@/domain/context/contextEvent'

export function ContextForm({ onDone }: { onDone: () => void }) {
  const { repos, bump } = useData()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [intensity, setIntensity] = useState<RatingValue | undefined>(5)

  function toggle(code: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  async function save() {
    const ctx = nowContext()
    const defs = CONTEXT_EVENT_CATALOG.filter((d) => selected.has(d.code))
    for (const d of defs) {
      await repos.context.put({
        localDate: ctx.localDate,
        timezoneOffsetMinutes: ctx.timezoneOffsetMinutes,
        source: 'manual',
        occurredAt: ctx.recordedAt,
        code: d.code,
        label: d.label,
        category: d.category,
        intensity: intensity ?? null,
        approxWindow: 'today',
      })
    }
    bump()
    onDone()
  }

  const cats = Object.keys(CONTEXT_CATEGORY_LABEL) as ContextCategory[]
  return (
    <FormShell title="오늘 있었던 일" subtitle="해당되는 걸 골라. 강도는 함께 저장돼." onSave={save} canSave={selected.size > 0}>
      {cats.map((cat) => (
        <div key={cat}>
          <div className="section-label">{CONTEXT_CATEGORY_LABEL[cat]}</div>
          <div className="chips">
            {CONTEXT_EVENT_CATALOG.filter((d) => d.category === cat).map((d) => (
              <Chip key={d.code} active={selected.has(d.code)} onClick={() => toggle(d.code)}>{d.label}</Chip>
            ))}
          </div>
        </div>
      ))}
      {selected.size > 0 && (
        <Card>
          <ScaleInput name="전반적 강도" lowLabel="약함" highLabel="강함" value={intensity} onChange={setIntensity} />
        </Card>
      )}
    </FormShell>
  )
}
