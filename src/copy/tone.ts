/* =====================================================================
   말투(tone) — banmal / haeyo 두 가지만. 실제 UI 전체가 이 함수를 통해 문구를 만든다.
   작동하지 않는 설정을 만들지 않는다: 여기 없는 말투는 존재하지 않는다.
   ===================================================================== */
import type { ToneMode } from '@/domain/settings/settings'

export interface Tone {
  mode: ToneMode
  /** 문장 끝맺음: "높은 편이야" / "높은 편이에요" */
  say: (banmal: string, haeyo: string) => string
}

export function makeTone(mode: ToneMode): Tone {
  return {
    mode,
    say: (banmal, haeyo) => (mode === 'haeyo' ? haeyo : banmal),
  }
}

/** 자주 쓰는 문구 사전. */
export function greeting(tone: Tone): string {
  return tone.say('오늘은', '오늘은')
}

export function noDataToday(tone: Tone): string {
  return tone.say('오늘 아직 기록이 없어. 상태를 남겨볼까?', '오늘 아직 기록이 없어요. 상태를 남겨볼까요?')
}

export function comparedToUsual(tone: Tone): string {
  return tone.say('평소와 비교하면', '평소와 비교하면')
}

export function lastNight(tone: Tone): string {
  return tone.say('지난밤', '지난밤')
}
