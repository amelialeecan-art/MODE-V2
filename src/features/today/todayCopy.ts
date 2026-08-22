/* Today 문구 생성 — 내부 변수명 노출 금지, 말투 통일. 하나의 유형으로 압축하지 않는다. */
import type { Tone } from '@/copy/tone'
import { CORE_STATE_META } from '@/domain/state/coreState'
import type { DayMetricValue, Level } from '@/analysis/day/daySummary'

const LEVEL_RANK: Record<Level, number> = { none: 0, low: 1, mid: 2, high: 3, veryHigh: 4 }

/** 한 metric 을 자연스러운 구절로. valence 로 좋음/부담 어감 반영. */
function phraseFor(m: DayMetricValue, tone: Tone): string | null {
  if (m.level == null) return null
  const meta = CORE_STATE_META[m.metric]
  const name = meta.label
  const strong = m.level === 'high' || m.level === 'veryHigh'
  const weak = m.level === 'none' || m.level === 'low'

  if (meta.valence === 'capacity' || meta.valence === 'positive') {
    if (strong) return tone.say(`${name}는 높은 편이야`, `${name}는 높은 편이에요`)
    if (weak) return tone.say(`${name}는 낮은 편이야`, `${name}는 낮은 편이에요`)
    return null
  }
  // symptom
  if (strong) return tone.say(`${name}가 꽤 있었어`, `${name}가 꽤 있었어요`)
  if (weak) return tone.say(`${name}는 낮은 편이야`, `${name}는 낮은 편이에요`)
  return null
}

/** 두드러진 상태 2~3개를 골라 한 문단으로. */
export function narrateState(metrics: DayMetricValue[], tone: Tone): string[] {
  const scored = metrics
    .filter((m) => m.level != null)
    .map((m) => ({ m, extremity: Math.abs(LEVEL_RANK[m.level!] - 2) }))
    .sort((a, b) => b.extremity - a.extremity)
  const phrases: string[] = []
  for (const { m, extremity } of scored) {
    if (extremity < 1) continue // 보통은 생략
    const p = phraseFor(m, tone)
    if (p) phrases.push(p)
    if (phrases.length >= 3) break
  }
  return phrases
}
