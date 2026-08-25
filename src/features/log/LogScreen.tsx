import { useParams, useNavigate } from 'react-router-dom'
import { GlassCard } from '@/design'
import { useData } from '@/app/DataContext'
import { StateForm } from './forms/StateForm'
import { SleepForm } from './forms/SleepForm'
import { MealForm } from './forms/MealForm'
import { CycleForm } from './forms/CycleForm'
import { ContextForm } from './forms/ContextForm'
import { RecoveryForm } from './forms/RecoveryForm'
import './log.css'

const MENU: { kind: string; icon: string; title: string; desc: string; cycleOnly?: boolean }[] = [
  { kind: 'state', icon: '◐', title: '상태 체크인', desc: '아침·저녁 마음과 몸 상태' },
  { kind: 'sleep', icon: '☾', title: '수면', desc: '어젯밤 잠' },
  { kind: 'meal', icon: '🍽', title: '식사', desc: '먹기 전 상태 + 무엇을' },
  { kind: 'context', icon: '⚑', title: '오늘 있었던 일', desc: '스트레스·생활 맥락' },
  { kind: 'recovery', icon: '❍', title: '한 일', desc: '해봤더니 어땠는지' },
  { kind: 'cycle', icon: '❀', title: '생리', desc: '시작·양·통증', cycleOnly: true },
]

export function LogScreen() {
  const { kind } = useParams()
  const nav = useNavigate()
  const { settings } = useData()

  if (kind === 'state') return <StateForm onDone={() => nav('/')} />
  if (kind === 'sleep') return <SleepForm onDone={() => nav('/')} />
  if (kind === 'meal') return <MealForm onDone={() => nav('/')} />
  if (kind === 'cycle') return <CycleForm onDone={() => nav('/')} />
  if (kind === 'context') return <ContextForm onDone={() => nav('/')} />
  if (kind === 'recovery') return <RecoveryForm onDone={() => nav('/')} />

  const menu = MENU.filter((m) => !m.cycleOnly || settings.cycleEnabled)
  return (
    <div className="screen">
      <header className="screen-head">
        <h1 className="screen-head__title">기록</h1>
        <p className="screen-head__sub">무엇을 남길까?</p>
      </header>
      <div className="log-menu">
        {menu.map((m) => (
          <GlassCard key={m.kind}>
            <button className="log-menu__item" onClick={() => nav(`/log/${m.kind}`)}>
              <span className="log-menu__icon" aria-hidden="true">{m.icon}</span>
              <span className="log-menu__body">
                <span className="log-menu__title">{m.title}</span>
                <span className="log-menu__desc">{m.desc}</span>
              </span>
              <span className="log-menu__chev" aria-hidden="true">›</span>
            </button>
          </GlassCard>
        ))}
      </div>
    </div>
  )
}
