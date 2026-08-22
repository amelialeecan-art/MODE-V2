import type { ReactNode } from 'react'
import type { RatingValue } from '@/domain/common/types'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="section-label">{children}</div>
}

export function Segmented<T extends string>({
  options, value, onChange,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="group">
      {options.map((o) => (
        <button key={o.value} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/**
 * 0~10 척도 입력 — slider + 값 표시 + "안 물어봄/모름" 구분.
 * value: number | 'unknown' | null(=미입력). onChange 로 삼분값 전달.
 */
export function ScaleInput({
  name, lowLabel, highLabel, value, onChange,
}: {
  name: string
  lowLabel: string
  highLabel: string
  value: RatingValue | undefined
  onChange: (v: RatingValue | undefined) => void
}) {
  const isNum = typeof value === 'number'
  const isUnknown = value === 'unknown'
  return (
    <div className="scale">
      <div className="scale__head">
        <span className="scale__name">{name}</span>
        <span className={`scale__val ${isNum ? '' : 'scale__val--unset'}`}>
          {isNum ? value : isUnknown ? '모름' : '—'}
        </span>
      </div>
      <div className="scale__row">
        <input
          type="range" min={0} max={10} step={1}
          value={isNum ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={name}
        />
        <button
          className="scale__skip" aria-pressed={isUnknown}
          onClick={() => onChange(isUnknown ? undefined : 'unknown')}
          title="물어봤지만 잘 모르겠음"
        >모름</button>
      </div>
      <div className="scale__ends tiny dim">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  )
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button className="chip" aria-pressed={active} onClick={onClick}>{children}</button>
  )
}

export function Button({
  children, onClick, variant = 'default', block, disabled, type,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'default' | 'primary' | 'ghost'
  block?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  const cls = `btn ${variant === 'primary' ? 'btn--primary' : variant === 'ghost' ? 'btn--ghost' : ''} ${block ? 'btn--block' : ''}`
  return <button type={type ?? 'button'} className={cls} onClick={onClick} disabled={disabled}>{children}</button>
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="center-empty">{children}</div>
}
