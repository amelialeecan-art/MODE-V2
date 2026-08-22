/* =====================================================================
   시간/타임존 유틸 — localDate 는 항상 "그 사람의 하루" 기준.
   ===================================================================== */
import type { ISODate, ISODateTime } from '@/domain/common/types'

/** 현재 브라우저 타임존의 UTC 대비 offset(분). KST=+540. (getTimezoneOffset 은 부호 반대) */
export function currentTimezoneOffsetMinutes(now: Date = new Date()): number {
  return -now.getTimezoneOffset()
}

/** Date → 로컬 'YYYY-MM-DD' (주어진 offset 기준). */
export function toLocalDate(at: Date, offsetMinutes = currentTimezoneOffsetMinutes(at)): ISODate {
  const shifted = new Date(at.getTime() + offsetMinutes * 60_000)
  return shifted.toISOString().slice(0, 10)
}

/** 오늘 localDate. */
export function todayLocalDate(offsetMinutes = currentTimezoneOffsetMinutes()): ISODate {
  return toLocalDate(new Date(), offsetMinutes)
}

/** Date → offset 를 반영한 ISO datetime 문자열(+09:00 형태). */
export function toISODateTime(at: Date, offsetMinutes = currentTimezoneOffsetMinutes(at)): ISODateTime {
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMinutes)
  const hh = String(Math.floor(abs / 60)).padStart(2, '0')
  const mm = String(abs % 60).padStart(2, '0')
  const shifted = new Date(at.getTime() + offsetMinutes * 60_000)
  return shifted.toISOString().replace('Z', `${sign}${hh}:${mm}`)
}

/** 지금 ISO datetime. */
export function nowISO(): ISODateTime {
  return new Date().toISOString()
}

/** 'YYYY-MM-DD' → Date (로컬 자정, offset 반영). */
export function localDateToDate(date: ISODate, offsetMinutes = currentTimezoneOffsetMinutes()): Date {
  return new Date(new Date(`${date}T00:00:00.000Z`).getTime() - offsetMinutes * 60_000)
}

/** date 에 days 를 더한 localDate. */
export function addDays(date: ISODate, days: number): ISODate {
  const d = new Date(`${date}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** 두 localDate 사이 일수 (b - a). */
export function daysBetween(a: ISODate, b: ISODate): number {
  const ms = new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()
  return Math.round(ms / 86_400_000)
}

/** 두 ISO datetime 사이 분. null 반환 = 계산 불가. */
export function minutesBetween(a?: ISODateTime | null, b?: ISODateTime | null): number | null {
  if (!a || !b) return null
  const ms = new Date(b).getTime() - new Date(a).getTime()
  if (!Number.isFinite(ms)) return null
  return Math.round(ms / 60_000)
}

/** 분 → "N시간 M분". */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return '-'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m}분`
  if (m === 0) return `${h}시간`
  return `${h}시간 ${m}분`
}

/** localDate 를 "8월 22일 (금)" 처럼. */
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
export function formatLocalDate(date: ISODate): string {
  const d = new Date(`${date}T00:00:00Z`)
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${WEEKDAYS[d.getUTCDay()]})`
}

/** ISO datetime → "21:03" (localDate 판단에 쓰인 offset 반영 없이, 문자열 그대로의 시:분). */
export function formatClock(at?: ISODateTime | null): string {
  if (!at) return '-'
  const m = at.match(/T(\d{2}):(\d{2})/)
  return m ? `${m[1]}:${m[2]}` : '-'
}
