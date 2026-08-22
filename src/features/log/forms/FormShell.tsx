import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/shared/ui/primitives'

export function FormShell({
  title, subtitle, children, onSave, saveLabel = '저장', canSave = true,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  onSave: () => void
  saveLabel?: string
  canSave?: boolean
}) {
  const nav = useNavigate()
  return (
    <div className="screen">
      <button className="muted tiny" onClick={() => nav(-1)} style={{ marginBottom: 8 }}>‹ 뒤로</button>
      <h1 className="screen__title">{title}</h1>
      {subtitle && <p className="screen__subtitle">{subtitle}</p>}
      <div style={{ marginTop: 16 }}>{children}</div>
      <div className="btn-row">
        <Button variant="ghost" onClick={() => nav(-1)}>취소</Button>
        <Button variant="primary" block onClick={onSave} disabled={!canSave}>{saveLabel}</Button>
      </div>
    </div>
  )
}
