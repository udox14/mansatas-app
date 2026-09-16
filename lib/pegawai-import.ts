export type ImportableRole = {
  value: string
  label: string
}

const normalizeRoleText = (value: unknown) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[._-]+/g, ' ')
  .replace(/\s+/g, ' ')

const ROLE_ALIASES: Record<string, string> = {
  bk: 'guru_bk',
  piket: 'guru_piket',
  ppl: 'guru_ppl',
  praktik: 'guru_ppl',
  praktek: 'guru_ppl',
  'guru mapel': 'guru',
  'guru mata pelajaran': 'guru',
  'guru bk': 'guru_bk',
  'guru piket': 'guru_piket',
  'guru ppl': 'guru_ppl',
  'guru praktik lapangan': 'guru_ppl',
  'guru praktek lapangan': 'guru_ppl',
  'wali kelas': 'wali_kelas',
  walas: 'wali_kelas',
  'kepala madrasah': 'kepsek',
  'kepala sekolah': 'kepsek',
  kepala: 'kepsek',
  'wakil kepala madrasah': 'wakamad',
  'wakil kepala': 'wakamad',
  waka: 'wakamad',
  'tata usaha': 'admin_tu',
  tu: 'admin_tu',
  'staff tata usaha': 'admin_tu',
  'staf tata usaha': 'admin_tu',
  'admin tu': 'admin_tu',
  'operator emis': 'operator',
  'bendahara komite': 'bendahara_komite',
  'pembina ekstrakurikuler': 'pembina_ekstrakurikuler',
}

export function normalizePegawaiImportRow(row: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [
    key.trim().toUpperCase().replace(/[\s-]+/g, '_'),
    value,
  ]))
}

export function resolveImportedRoles(rawValue: unknown, masterRoles: ImportableRole[]) {
  const raw = String(rawValue ?? '').trim()
  if (!raw) return { roles: ['guru'], invalid: [] as string[] }

  const lookup = new Map<string, string>()
  for (const role of masterRoles) {
    lookup.set(normalizeRoleText(role.value), role.value)
    lookup.set(normalizeRoleText(role.label), role.value)
  }
  for (const [alias, role] of Object.entries(ROLE_ALIASES)) {
    if (masterRoles.some(item => item.value === role)) lookup.set(alias, role)
  }

  const wholeMatch = lookup.get(normalizeRoleText(raw))
  if (wholeMatch) return { roles: [wholeMatch], invalid: [] as string[] }

  const roles: string[] = []
  const invalid: string[] = []
  for (const part of raw.split(/[,;|]+/).map(value => value.trim()).filter(Boolean)) {
    const match = lookup.get(normalizeRoleText(part))
    if (!match) invalid.push(part)
    else if (!roles.includes(match)) roles.push(match)
  }
  return { roles, invalid }
}
