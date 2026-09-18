export type EkskulResidenceFilter =
  | { kind: 'all' }
  | { kind: 'pesantren' }
  | { kind: 'non_pesantren' }
  | { kind: 'exact'; value: string }

export type EkskulAnggotaReportRequest = {
  scope: 'all' | 'single'
  ekskulId?: string
  residence: EkskulResidenceFilter
}

export type EkskulAnggotaReport = {
  filterLabel: string
  groups: Array<{
    ekskul_id: string
    ekskul_nama: string
    rows: Array<{
      nama_lengkap: string
      tempat_tinggal: string
    }>
  }>
}

export function parseEkskulResidenceFilter(raw: string | null): EkskulResidenceFilter | null {
  if (!raw || raw === 'all') return { kind: 'all' }
  if (raw === 'pesantren') return { kind: 'pesantren' }
  if (raw === 'non_pesantren') return { kind: 'non_pesantren' }
  if (!raw.startsWith('exact:')) return null

  const value = raw.slice('exact:'.length).trim()
  if (!value || value.length > 100 || /[\u0000-\u001f]/.test(value)) return null
  return { kind: 'exact', value }
}

export function residenceFilterLabel(filter: EkskulResidenceFilter): string {
  if (filter.kind === 'all') return 'Semua tempat tinggal'
  if (filter.kind === 'pesantren') return 'Semua siswa pesantren'
  if (filter.kind === 'non_pesantren') return 'Non-Pesantren'
  return filter.value
}

export function residenceFilterSql(filter: EkskulResidenceFilter, alias = 's') {
  if (filter.kind === 'pesantren') {
    return { clause: ` AND ${alias}.tempat_tinggal LIKE ?`, params: ['Pesantren%'] }
  }
  if (filter.kind === 'non_pesantren') {
    return { clause: ` AND ${alias}.tempat_tinggal = ?`, params: ['Non-Pesantren'] }
  }
  if (filter.kind === 'exact') {
    return { clause: ` AND ${alias}.tempat_tinggal = ?`, params: [filter.value] }
  }
  return { clause: '', params: [] as string[] }
}

export async function getEkskulResidenceOptions(db: D1Database): Promise<string[]> {
  const { results } = await db.prepare(`
    SELECT DISTINCT s.tempat_tinggal
    FROM ekstrakurikuler_anggota a
    JOIN ekstrakurikuler e ON e.id = a.ekstrakurikuler_id
    JOIN siswa s ON s.id = a.siswa_id
    WHERE e.status = 'aktif' AND a.status = 'aktif' AND s.status = 'aktif'
      AND s.tempat_tinggal IS NOT NULL AND trim(s.tempat_tinggal) != ''
    ORDER BY s.tempat_tinggal COLLATE NOCASE ASC
  `).all<{ tempat_tinggal: string }>()

  return (results || []).map(row => row.tempat_tinggal)
}

export async function getEkskulAnggotaReport(
  db: D1Database,
  request: EkskulAnggotaReportRequest,
): Promise<EkskulAnggotaReport> {
  if (request.scope === 'single' && !request.ekskulId) {
    throw new Error('Ekstrakurikuler wajib dipilih.')
  }

  const residence = residenceFilterSql(request.residence)
  const scopeClause = request.scope === 'all' ? `e.status = 'aktif'` : 'e.id = ?'
  const scopeParams = request.scope === 'all' ? [] : [request.ekskulId as string]
  const { results } = await db.prepare(`
    SELECT
      e.id AS ekskul_id,
      e.nama AS ekskul_nama,
      s.nama_lengkap,
      s.tempat_tinggal
    FROM ekstrakurikuler e
    JOIN ekstrakurikuler_anggota a ON a.ekstrakurikuler_id = e.id AND a.status = 'aktif'
    JOIN siswa s ON s.id = a.siswa_id AND s.status = 'aktif'
    WHERE ${scopeClause}${residence.clause}
    ORDER BY e.nama COLLATE NOCASE ASC, s.nama_lengkap COLLATE NOCASE ASC
  `).bind(...scopeParams, ...residence.params).all<{
    ekskul_id: string
    ekskul_nama: string
    nama_lengkap: string
    tempat_tinggal: string
  }>()

  const groups = new Map<string, EkskulAnggotaReport['groups'][number]>()
  for (const row of results || []) {
    let group = groups.get(row.ekskul_id)
    if (!group) {
      group = { ekskul_id: row.ekskul_id, ekskul_nama: row.ekskul_nama, rows: [] }
      groups.set(row.ekskul_id, group)
    }
    group.rows.push({
      nama_lengkap: row.nama_lengkap,
      tempat_tinggal: row.tempat_tinggal || 'Non-Pesantren',
    })
  }

  return {
    filterLabel: residenceFilterLabel(request.residence),
    groups: [...groups.values()],
  }
}
