/* =====================================================================
   순수 통계 유틸 — N-of-1 개인 시계열용. 외부 의존 없음.
   ===================================================================== */

export function mean(xs: number[]): number {
  if (xs.length === 0) return NaN
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

/** 표본 표준편차(n-1). n<2 면 NaN. */
export function stdev(xs: number[]): number {
  const n = xs.length
  if (n < 2) return NaN
  const m = mean(xs)
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)
  return Math.sqrt(v)
}

export function median(xs: number[]): number {
  if (xs.length === 0) return NaN
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** z 점수. sd 가 0/NaN 이면 0. */
export function zScore(x: number, m: number, sd: number): number {
  if (!Number.isFinite(sd) || sd === 0) return 0
  return (x - m) / sd
}

/** 두 그룹 평균차의 Cohen's d (pooled sd). 근거 부족 시 null. */
export function cohensD(a: number[], b: number[]): number | null {
  if (a.length < 2 || b.length < 2) return null
  const ma = mean(a)
  const mb = mean(b)
  const va = stdev(a) ** 2
  const vb = stdev(b) ** 2
  const pooled = Math.sqrt(((a.length - 1) * va + (b.length - 1) * vb) / (a.length + b.length - 2))
  if (!Number.isFinite(pooled) || pooled === 0) return null
  return (ma - mb) / pooled
}

/** 효과크기 정성 라벨 (|d|). 사용자 노출은 features 에서 부드럽게. */
export function effectSizeBand(d: number): 'negligible' | 'small' | 'moderate' | 'large' {
  const a = Math.abs(d)
  if (a < 0.2) return 'negligible'
  if (a < 0.5) return 'small'
  if (a < 0.8) return 'moderate'
  return 'large'
}

export function round1(x: number): number {
  return Math.round(x * 10) / 10
}

/** 부호 붙은 문자열 (+2.1 / -1.4 / 0.0). */
export function signed(x: number): string {
  const r = round1(x)
  return r > 0 ? `+${r.toFixed(1)}` : r.toFixed(1)
}
