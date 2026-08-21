export const VERIFICATION_ROLES = ['super_admin', 'kepsek', 'wakamad'] as const
export const VERIFICATION_SETTINGS_ID = 'student_verification_thresholds_v1'

export type RiskLevel = 'aman' | 'perhatian' | 'kritis'

export type VerificationThresholds = {
  version: 1
  attendanceWarning: number
  attendanceCritical: number
}

export type DomainIndicator = {
  domain: 'kehadiran' | 'kedisiplinan' | 'bk'
  level: RiskLevel
  label: string
  reason: string
  actual: string
  threshold: string
}

export const DEFAULT_VERIFICATION_THRESHOLDS: VerificationThresholds = {
  version: 1,
  attendanceWarning: 90,
  attendanceCritical: 80,
}

const RISK_WEIGHT: Record<RiskLevel, number> = { aman: 0, perhatian: 1, kritis: 2 }

export function normalizeVerificationThresholds(value: unknown): VerificationThresholds {
  const source = value && typeof value === 'object' ? value as Partial<VerificationThresholds> : {}
  const warning = Number(source.attendanceWarning)
  const critical = Number(source.attendanceCritical)
  if (
    source.version !== 1 ||
    !Number.isFinite(warning) || !Number.isFinite(critical) ||
    critical < 0 || critical > 100 || warning < 0 || warning > 100 || critical >= warning
  ) return { ...DEFAULT_VERIFICATION_THRESHOLDS }
  return {
    version: 1,
    attendanceWarning: warning,
    attendanceCritical: critical,
  }
}

export function parseVerificationThresholds(raw?: string | null): VerificationThresholds {
  if (!raw) return { ...DEFAULT_VERIFICATION_THRESHOLDS }
  try { return normalizeVerificationThresholds(JSON.parse(raw)) } catch { return { ...DEFAULT_VERIFICATION_THRESHOLDS } }
}

export function worstRisk(indicators: DomainIndicator[]): RiskLevel {
  return indicators.reduce<RiskLevel>((worst, item) =>
    RISK_WEIGHT[item.level] > RISK_WEIGHT[worst] ? item.level : worst, 'aman')
}

export function attendanceIndicator(present: number, total: number, settings: VerificationThresholds): DomainIndicator {
  if (total <= 0) return {
    domain: 'kehadiran', level: 'perhatian', label: 'Perlu Perhatian',
    reason: 'Belum ada rekaman kehadiran pada periode ini.', actual: '0 rekaman',
    threshold: `Perhatian <${settings.attendanceWarning}% · Kritis <${settings.attendanceCritical}%`,
  }
  const percentage = present / total * 100
  const level: RiskLevel = percentage < settings.attendanceCritical ? 'kritis' : percentage < settings.attendanceWarning ? 'perhatian' : 'aman'
  return {
    domain: 'kehadiran', level, label: riskLabel(level),
    reason: level === 'aman' ? 'Persentase kehadiran memenuhi ambang.' : `Persentase kehadiran berada di bawah ambang ${level === 'kritis' ? 'kritis' : 'perhatian'}.`,
    actual: `${percentage.toFixed(1)}% (${present}/${total})`,
    threshold: `Perhatian <${settings.attendanceWarning}% · Kritis <${settings.attendanceCritical}%`,
  }
}

export function disciplineIndicator(points: number, highestSp?: string | null, criticalPoints = 75): DomainIndicator {
  const severeSp = /sp\s*[23]|sp[23]/i.test(highestSp || '')
  const level: RiskLevel = points >= criticalPoints || severeSp ? 'kritis' : points >= 25 || Boolean(highestSp) ? 'perhatian' : 'aman'
  return {
    domain: 'kedisiplinan', level, label: riskLabel(level),
    reason: severeSp ? `${highestSp?.toUpperCase()} tercatat pada periode ini.` : points > 0 ? `Akumulasi ${points} poin pelanggaran.` : 'Tidak ada poin pelanggaran pada periode ini.',
    actual: `${points} poin${highestSp ? ` · ${highestSp.toUpperCase()}` : ''}`,
    threshold: `Perhatian ≥25 poin · Kritis ≥${criticalPoints} poin atau SP2/SP3`,
  }
}

export function counselingIndicator(openCases: number, criticalCases = 0): DomainIndicator {
  const level: RiskLevel = criticalCases > 0 ? 'kritis' : openCases > 0 ? 'perhatian' : 'aman'
  return {
    domain: 'bk', level, label: riskLabel(level),
    reason: criticalCases > 0 ? 'Terdapat penanganan BK dengan klasifikasi berat/darurat.' : openCases > 0 ? 'Terdapat penanganan BK yang belum selesai.' : 'Tidak ada penanganan BK terbuka.',
    actual: `${openCases} penanganan terbuka`,
    threshold: 'Perhatian bila ada penanganan terbuka · Kritis hanya dari klasifikasi eksplisit',
  }
}

export function riskLabel(level: RiskLevel) {
  return level === 'aman' ? 'Aman' : level === 'kritis' ? 'Kritis' : 'Perlu Perhatian'
}

export function academicYearDates(name: string) {
  const match = name.match(/(\d{4})\s*\/\s*(\d{4})/)
  return match ? { startDate: `${match[1]}-07-01`, endDate: `${match[2]}-06-30` } : { startDate: null, endDate: null }
}

export function relevantSemesterKeys(grade: number) {
  const first = (grade - 10) * 2 + 1
  return first >= 1 && first <= 5 ? [`nilai_smt${first}`, `nilai_smt${first + 1}`] : []
}

export function summarizeRdmAcademic(record: Record<string, unknown> | null, grade: number, fallbackKkm = 75) {
  const keys = relevantSemesterKeys(grade)
  const semesters = keys.map(key => parseObject(record?.[key]))
  const subjects = Array.from(new Set(semesters.flatMap(item => Object.keys(item)))).sort()
  let problematic = 0
  const rows = subjects.map(subject => {
    const values = semesters.map(item => numeric(item[subject]))
    const missing = values.some(value => value === null)
    const below = values.some(value => value !== null && value < fallbackKkm)
    if (missing || below) problematic += 1
    const available = values.filter((value): value is number => value !== null)
    return {
      subject,
      semester1: values[0],
      semester2: values[1],
      average: available.length ? available.reduce((sum, value) => sum + value, 0) / available.length : null,
      problematic: missing || below,
      reason: missing ? 'Nilai semester belum lengkap' : below ? `Ada nilai di bawah KKM ${fallbackKkm}` : 'Tuntas',
    }
  })
  return { total: subjects.length, problematic, rows }
}

function parseObject(value: unknown): Record<string, unknown> {
  if (!value) return {}
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  try {
    const parsed = JSON.parse(String(value))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch { return {} }
}

function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}
