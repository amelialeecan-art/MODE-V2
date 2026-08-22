import { currentTimezoneOffsetMinutes, toISODateTime, todayLocalDate } from '@/shared/time/time'

/** 신규 manual 입력의 공통 시간/provenance 조각. */
export function nowContext() {
  const now = new Date()
  const tz = currentTimezoneOffsetMinutes(now)
  return {
    localDate: todayLocalDate(tz),
    timezoneOffsetMinutes: tz,
    recordedAt: toISODateTime(now, tz),
    source: 'manual' as const,
  }
}
