/* =====================================================================
   Read query 층 — 모든 read surface(Today/Calendar/Rhythm/Analysis)가
   공유하는 단일 데이터 진입점. 여기 위로는 같은 raw 를 본다.
   ===================================================================== */
import type { Repositories } from '@/data/repositories'
import type {
  StateMeasurement, SleepEpisode, MealEpisode, ActivityEpisode,
  CycleRecord, ContextEvent, RecoveryAction,
} from '@/domain'

export interface DayRecords {
  localDate: string
  state: StateMeasurement[]
  sleep: SleepEpisode[]
  meals: MealEpisode[]
  activities: ActivityEpisode[]
  cycle: CycleRecord[]
  context: ContextEvent[]
  recovery: RecoveryAction[]
}

export async function loadDayRecords(repos: Repositories, localDate: string): Promise<DayRecords> {
  const [state, sleep, meals, activities, cycle, context, recovery] = await Promise.all([
    repos.state.byDate(localDate),
    repos.sleep.byDate(localDate),
    repos.meal.byDate(localDate),
    repos.activity.byDate(localDate),
    repos.cycle.byDate(localDate),
    repos.context.byDate(localDate),
    repos.recovery.byDate(localDate),
  ])
  return { localDate, state, sleep, meals, activities, cycle, context, recovery }
}

export interface RangeRecords {
  from: string
  to: string
  state: StateMeasurement[]
  sleep: SleepEpisode[]
  meals: MealEpisode[]
  activities: ActivityEpisode[]
  cycle: CycleRecord[]
  context: ContextEvent[]
  recovery: RecoveryAction[]
}

export async function loadRange(repos: Repositories, from: string, to: string): Promise<RangeRecords> {
  const [state, sleep, meals, activities, cycle, context, recovery] = await Promise.all([
    repos.state.inRange(from, to),
    repos.sleep.inRange(from, to),
    repos.meal.inRange(from, to),
    repos.activity.inRange(from, to),
    repos.cycle.inRange(from, to),
    repos.context.inRange(from, to),
    repos.recovery.inRange(from, to),
  ])
  return { from, to, state, sleep, meals, activities, cycle, context, recovery }
}

/** 기록이 있는 날짜 집합(캘린더 점 표시용). */
export async function loadRecordDates(repos: Repositories, from: string, to: string): Promise<Map<string, DayPresence>> {
  const r = await loadRange(repos, from, to)
  const map = new Map<string, DayPresence>()
  const ensure = (d: string): DayPresence => {
    let p = map.get(d)
    if (!p) { p = { morningState: false, eveningState: false, sleep: false, meals: 0, cycle: false, context: false }; map.set(d, p) }
    return p
  }
  for (const s of r.state) {
    const p = ensure(s.localDate)
    if (s.checkInType === 'morning') p.morningState = true
    else if (s.checkInType === 'evening') p.eveningState = true
    else p.eveningState = true
  }
  for (const s of r.sleep) ensure(s.localDate).sleep = true
  for (const m of r.meals) ensure(m.localDate).meals += 1
  for (const c of r.cycle) if (c.periodStart || c.periodEnd || c.flowLevel) ensure(c.localDate).cycle = true
  for (const c of r.context) ensure(c.localDate).context = true
  return map
}

export interface DayPresence {
  morningState: boolean
  eveningState: boolean
  sleep: boolean
  meals: number
  cycle: boolean
  context: boolean
}
