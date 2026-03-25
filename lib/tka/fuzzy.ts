// lib/tka/fuzzy.ts
// Levenshtein fuzzy name matcher — client-side only, zero dependency

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return dp[m][n]
}

function normalize(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

export function similarityScore(a: string, b: string): number {
  const na = normalize(a), nb = normalize(b)
  if (na === nb) return 100
  const dist = levenshtein(na, nb)
  const maxLen = Math.max(na.length, nb.length)
  if (maxLen === 0) return 100
  return Math.round((1 - dist / maxLen) * 100)
}

export type SiswaCandidate = { id: string; nama_lengkap: string }

export type MatchResult = {
  siswa_id: string | null
  nama_matched: string | null
  confidence: number
  needs_review: boolean
  candidates: { siswa_id: string; nama: string; score: number }[]
}

export const CONFIDENCE_THRESHOLD = 85

export function matchName(rawName: string, candidates: SiswaCandidate[]): MatchResult {
  const scored = candidates
    .map(s => ({ siswa_id: s.id, nama: s.nama_lengkap, score: similarityScore(rawName, s.nama_lengkap) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  const best = scored[0]
  if (!best || best.score < 50) {
    return { siswa_id: null, nama_matched: null, confidence: 0, needs_review: true, candidates: scored }
  }

  return {
    siswa_id: best.score >= CONFIDENCE_THRESHOLD ? best.siswa_id : null,
    nama_matched: best.score >= CONFIDENCE_THRESHOLD ? best.nama : null,
    confidence: best.score,
    needs_review: best.score < CONFIDENCE_THRESHOLD,
    candidates: scored,
  }
}
