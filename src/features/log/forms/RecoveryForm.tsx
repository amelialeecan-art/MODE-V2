import { useState } from 'react'
import { Card, Chip, Segmented } from '@/shared/ui/primitives'
import { FormShell } from './FormShell'
import { useData } from '@/app/DataContext'
import { nowContext } from './formUtils'
import {
  RECOVERY_ACTION_CATALOG, RECOVERY_CATEGORY_LABEL, RECOVERY_EFFECT_LABEL,
  type RecoveryCategory, type RecoveryEffect,
} from '@/domain/recovery/recoveryAction'

export function RecoveryForm({ onDone }: { onDone: () => void }) {
  const { repos, bump } = useData()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [effect, setEffect] = useState<RecoveryEffect>('little_better')

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
    const defs = RECOVERY_ACTION_CATALOG.filter((d) => selected.has(d.code))
    for (const d of defs) {
      await repos.recovery.put({
        localDate: ctx.localDate,
        timezoneOffsetMinutes: ctx.timezoneOffsetMinutes,
        source: 'manual',
        occurredAt: ctx.recordedAt,
        code: d.code,
        label: d.label,
        category: d.category,
        effect,
      })
    }
    bump()
    onDone()
  }

  const effects: RecoveryEffect[] = ['much_better', 'little_better', 'same', 'worse', 'unknown']
  const cats = Object.keys(RECOVERY_CATEGORY_LABEL) as RecoveryCategory[]
  return (
    <FormShell title="한 일" subtitle="해봤더니 어땠는지 남겨." onSave={save} canSave={selected.size > 0}>
      {cats.map((cat) => (
        <div key={cat}>
          <div className="section-label">{RECOVERY_CATEGORY_LABEL[cat]}</div>
          <div className="chips">
            {RECOVERY_ACTION_CATALOG.filter((d) => d.category === cat).map((d) => (
              <Chip key={d.code} active={selected.has(d.code)} onClick={() => toggle(d.code)}>{d.label}</Chip>
            ))}
          </div>
        </div>
      ))}
      {selected.size > 0 && (
        <Card>
          <div className="scale__name" style={{ marginBottom: 8 }}>그래서 어땠어?</div>
          <Segmented<RecoveryEffect>
            options={effects.map((e) => ({ value: e, label: RECOVERY_EFFECT_LABEL[e] }))}
            value={effect}
            onChange={setEffect}
          />
        </Card>
      )}
    </FormShell>
  )
}
