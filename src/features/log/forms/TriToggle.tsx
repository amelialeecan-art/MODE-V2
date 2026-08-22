import type { TriBoolean } from '@/domain/common/types'
import { Segmented } from '@/shared/ui/primitives'

/** 예 / 아니오 / 모름 — TriBoolean 입력. 미입력(null)이 기본. */
export function TriToggle({ label, value, onChange }: { label: string; value: TriBoolean | undefined; onChange: (v: TriBoolean) => void }) {
  const current = value === true ? 'yes' : value === false ? 'no' : value === 'unknown' ? 'unknown' : 'none'
  return (
    <div style={{ margin: '10px 0' }}>
      <div className="scale__name" style={{ marginBottom: 6 }}>{label}</div>
      <Segmented<'yes' | 'no' | 'unknown' | 'none'>
        options={[
          { value: 'yes', label: '예' },
          { value: 'no', label: '아니오' },
          { value: 'unknown', label: '모름' },
          { value: 'none', label: '—' },
        ]}
        value={current}
        onChange={(v) => onChange(v === 'yes' ? true : v === 'no' ? false : v === 'unknown' ? 'unknown' : null)}
      />
    </div>
  )
}
