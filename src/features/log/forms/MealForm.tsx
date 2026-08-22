import { useState } from 'react'
import { Card, ScaleInput, Segmented } from '@/shared/ui/primitives'
import { FormShell } from './FormShell'
import { TriToggle } from './TriToggle'
import { useData } from '@/app/DataContext'
import { nowContext } from './formUtils'
import type { RatingValue, TriBoolean } from '@/domain/common/types'
import type { MealAmount, AlcoholLevel } from '@/domain/meal/mealEpisode'

export function MealForm({ onDone }: { onDone: () => void }) {
  const { repos, bump } = useData()
  const [hunger, setHunger] = useState<RatingValue | undefined>(undefined)
  const [craving, setCraving] = useState<RatingValue | undefined>(undefined)
  const [binge, setBinge] = useState<RatingValue | undefined>(undefined)
  const [amount, setAmount] = useState<MealAmount>(null)
  const [protein, setProtein] = useState<TriBoolean>(null)
  const [sweets, setSweets] = useState<TriBoolean>(null)
  const [ultra, setUltra] = useState<TriBoolean>(null)
  const [overate, setOverate] = useState<TriBoolean>(null)
  const [alcohol, setAlcohol] = useState<AlcoholLevel>('none')

  async function save() {
    const ctx = nowContext()
    await repos.meal.put({
      localDate: ctx.localDate,
      timezoneOffsetMinutes: ctx.timezoneOffsetMinutes,
      source: 'manual',
      startedAt: ctx.recordedAt,
      prePhysicalHunger: hunger ?? null,
      preCraving: craving ?? null,
      preBingeUrge: binge ?? null,
      amount,
      proteinIncluded: protein,
      sweetsIncluded: sweets,
      ultraProcessedIncluded: ultra,
      perceivedOvereating: overate,
      alcohol: { level: alcohol },
    })
    bump()
    onDone()
  }

  return (
    <FormShell title="식사" subtitle="먹기 직전 상태와, 무엇을 먹었는지." onSave={save}>
      <div className="section-label">먹기 직전</div>
      <Card>
        <ScaleInput name="배고픔" lowLabel="전혀 안 고픔" highLabel="매우 배고픔" value={hunger} onChange={setHunger} />
        <ScaleInput name="음식 당김" lowLabel="없음" highLabel="매우 강함" value={craving} onChange={setCraving} />
        <ScaleInput name="폭식 충동" lowLabel="없음" highLabel="매우 강함" value={binge} onChange={setBinge} />
      </Card>
      <div className="section-label">무엇을</div>
      <Card>
        <div className="scale__name" style={{ marginBottom: 6 }}>양</div>
        <Segmented<'small' | 'normal' | 'large' | 'none'>
          options={[{ value: 'small', label: '적게' }, { value: 'normal', label: '보통' }, { value: 'large', label: '많이' }, { value: 'none', label: '—' }]}
          value={(amount ?? 'none') as 'small' | 'normal' | 'large' | 'none'}
          onChange={(v) => setAmount(v === 'none' ? null : v)}
        />
        <TriToggle label="단백질 포함" value={protein} onChange={setProtein} />
        <TriToggle label="단 음식 포함" value={sweets} onChange={setSweets} />
        <TriToggle label="초가공식품 포함" value={ultra} onChange={setUltra} />
        <TriToggle label="과식한 느낌" value={overate} onChange={setOverate} />
        <div className="scale__name" style={{ margin: '10px 0 6px' }}>술</div>
        <Segmented<AlcoholLevel>
          options={[
            { value: 'none', label: '안 마심' },
            { value: 'light', label: '가볍게' },
            { value: 'moderate', label: '보통' },
            { value: 'heavy', label: '많이' },
          ]}
          value={alcohol}
          onChange={setAlcohol}
        />
      </Card>
    </FormShell>
  )
}
