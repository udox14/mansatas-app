import { redirect } from 'next/navigation'
import type { CSSProperties } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { getUserRoles } from '@/lib/features'
import { CKH_DEFAULT_SATUAN, CKH_DEFAULT_VOL, formatCkhDate, formatCkhMonth } from '@/lib/ckh'
import { PrintToolbar } from './print-toolbar'

export const metadata = { title: 'Cetak CKH Massal - MANSATAS App' }
export const dynamic = 'force-dynamic'

type PrintUser = {
  id: string
  nama_lengkap: string
  role: string
  roles: string | null
  nip: string | null
  pangkat_golongan: string | null
  jabatan_cetak: string | null
  signature_url: string | null
  signature_enabled: number
  signature_x_mm: number
  signature_y_mm: number
  signature_width_mm: number
  document_id: string
}

type PrintRow = {
  id: string
  document_id: string
  tanggal: string
  kegiatan_bulanan: string
  catatan_harian: string
  vol: number
  satuan: string
}

type Signer = {
  nama_lengkap: string
  nip: string | null
  jabatan_cetak: string | null
}

const printProfileLabel: CSSProperties = { width: '112px', whiteSpace: 'nowrap' }

function parseIds(value: string | undefined) {
  return Array.from(new Set(String(value || '').split(',').map(id => id.trim()).filter(Boolean)))
}

function upper(value: string | null | undefined) {
  return String(value || '').toUpperCase()
}

function missing() {
  return <span style={{ fontStyle: 'italic' }}>Silakan isi dulu di Profil</span>
}

function th(width?: string): CSSProperties {
  return {
    border: '1px solid #000',
    padding: '4px 3px',
    textAlign: 'center',
    verticalAlign: 'middle',
    fontWeight: 700,
    width,
  }
}

function td(textAlign: 'left' | 'center'): CSSProperties {
  return {
    border: '1px solid #000',
    padding: '4px 4px',
    textAlign,
    verticalAlign: 'middle',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }
}

function shouldUseKepalaTu(user: PrintUser) {
  const roles = new Set([user.role, ...(user.roles || '').split(',')].filter(Boolean))
  const jabatan = String(user.jabatan_cetak || '').toLowerCase()
  return roles.has('admin_tu') ||
    roles.has('operator') ||
    roles.has('pramubakti') ||
    jabatan.includes('staff tu') ||
    jabatan.includes('admin tu') ||
    jabatan.includes('tata usaha') ||
    jabatan.includes('operator emis') ||
    jabatan.includes('pramubakti')
}

function signatureStyle(user: PrintUser): CSSProperties {
  return {
    position: 'absolute',
    left: `${Number(user.signature_x_mm ?? 14)}mm`,
    top: `${Number(user.signature_y_mm ?? 12)}mm`,
    width: `${Number(user.signature_width_mm ?? 38)}mm`,
    height: 'auto',
    maxHeight: '28mm',
    objectFit: 'contain',
    zIndex: 10,
    pointerEvents: 'none',
  }
}

function CkhPrintBlock({
  user,
  rows,
  kepsek,
  kepalaTu,
  year,
  month,
}: {
  user: PrintUser
  rows: PrintRow[]
  kepsek: Signer | null
  kepalaTu: Signer | null
  year: number
  month: number
}) {
  const useTu = shouldUseKepalaTu(user)
  const signer = useTu ? kepalaTu : kepsek
  const signerLabel = useTu ? 'KEPALA TU' : 'KEPALA MAN 1 TASIKMALAYA'
  const missingSignerLabel = useTu ? 'KEPALA TU BELUM DIATUR' : 'KEPALA MADRASAH BELUM DIATUR'
  const lastRow = rows[rows.length - 1]
  const tanggalCetak = lastRow?.tanggal
    ? new Date(lastRow.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date(year, month, 0).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <section className="ckh-page" style={{ fontFamily: 'Tahoma, sans-serif', color: '#000', background: '#fff', fontSize: '10.5pt' }}>
      <div style={{ textAlign: 'center', marginBottom: '10px' }}>
        <div style={{ fontSize: '13pt', fontWeight: 700 }}>CATATAN KINERJA HARIAN</div>
        <div style={{ fontSize: '13pt', fontWeight: 700 }}>ASN MAN 1 TASIKMALAYA</div>
        <div style={{ fontSize: '10pt', fontWeight: 700, marginTop: '2px' }}>BULAN : {formatCkhMonth(year, month)}</div>
      </div>

      <table style={{ marginBottom: '8px', borderCollapse: 'collapse', fontSize: '10pt' }}>
        <tbody>
          <tr><td style={printProfileLabel}>NAMA</td><td style={{ width: '10px' }}>:</td><td>{user.nama_lengkap}</td></tr>
          <tr><td style={printProfileLabel}>NIP</td><td>:</td><td>{user.nip || missing()}</td></tr>
          <tr><td style={printProfileLabel}>PANGKAT / GOL.</td><td>:</td><td>{user.pangkat_golongan || missing()}</td></tr>
          <tr><td style={printProfileLabel}>JABATAN</td><td>:</td><td>{user.jabatan_cetak || missing()}</td></tr>
        </tbody>
      </table>

      <table className="ckh-print-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '10pt' }}>
        <thead>
          <tr>
            <th style={th('7mm')}>NO</th>
            <th style={th('22mm')}>TANGGAL</th>
            <th style={th('44mm')}>KEGIATAN BULANAN</th>
            <th style={th(undefined)}>CATATAN KINERJA HARIAN</th>
            <th style={th('12mm')}>VOL</th>
            <th style={th('20mm')}>SATUAN</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id}>
              <td style={td('center')}>{index + 1}</td>
              <td style={td('center')}>{formatCkhDate(row.tanggal)}</td>
              <td style={td('left')}>{row.kegiatan_bulanan}</td>
              <td style={td('left')}>{row.catatan_harian}</td>
              <td style={td('center')}>{row.vol || CKH_DEFAULT_VOL}</td>
              <td style={td('center')}>{row.satuan || CKH_DEFAULT_SATUAN}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '18mm', fontSize: '10pt' }}>
        <div style={{ width: '46%', textAlign: 'left', paddingLeft: '14mm' }}>
          <div>Mengetahui :</div>
          <div style={{ fontWeight: 700, textTransform: 'uppercase', marginBottom: '20mm' }}>{signerLabel}</div>
          <div style={{ fontWeight: 700, textDecoration: 'underline' }}>{upper(signer?.nama_lengkap) || missingSignerLabel}</div>
          <div>NIP. {signer?.nip || missing()}</div>
        </div>
        <div style={{ width: '46%', textAlign: 'left', paddingLeft: '14mm', position: 'relative' }}>
          {user.signature_enabled && user.signature_url ? <img src={user.signature_url} alt="" style={signatureStyle(user)} /> : null}
          <div>Tasikmalaya, {tanggalCetak}</div>
          <div style={{ fontWeight: 700, textTransform: 'uppercase', marginBottom: '20mm' }}>{user.jabatan_cetak || user.role || 'Pegawai'}</div>
          <div style={{ fontWeight: 700, textDecoration: 'underline' }}>{upper(user.nama_lengkap)}</div>
          <div>NIP. {user.nip || missing()}</div>
        </div>
      </div>
    </section>
  )
}

export default async function PrintCkhPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; users?: string }>
}) {
  const authUser = await getCurrentUser()
  if (!authUser) redirect('/login')

  const db = await getDB()
  const authRoles = await getUserRoles(db, authUser.id)
  if (!authRoles.includes('super_admin') && !authRoles.includes('admin_tu')) redirect('/dashboard')

  const params = await searchParams
  const year = Number(params.year)
  const month = Number(params.month)
  const ids = parseIds(params.users)
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || ids.length === 0) {
    redirect('/dashboard/tpg-dokumen')
  }

  const usersRes = await db.prepare(`
    SELECT
      u.id,
      COALESCE(u.nama_lengkap, u.name) as nama_lengkap,
      u.role,
      GROUP_CONCAT(DISTINCT ur.role) as roles,
      u.nip,
      u.pangkat_golongan,
      u.jabatan_cetak,
      u.signature_url,
      d.signature_enabled,
      d.signature_x_mm,
      d.signature_y_mm,
      d.signature_width_mm,
      d.id as document_id
    FROM ckh_documents d
    JOIN "user" u ON u.id = d.user_id
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    WHERE d.year = ?
      AND d.month = ?
      AND d.status = 'FINAL'
      AND d.user_id IN (${ids.map(() => '?').join(',')})
      AND EXISTS (
        SELECT 1 FROM ckh_rows r
        WHERE r.document_id = d.id
          AND (TRIM(r.kegiatan_bulanan) <> '' OR TRIM(r.catatan_harian) <> '')
      )
    GROUP BY u.id, d.id
    ORDER BY u.nama_lengkap ASC, u.name ASC
  `).bind(year, month, ...ids).all<PrintUser>()

  const users = usersRes.results || []
  const documentIds = users.map(user => user.document_id)
  const rowsByDocument = new Map<string, PrintRow[]>()
  if (documentIds.length > 0) {
    const rowsRes = await db.prepare(`
      SELECT id, document_id, tanggal, kegiatan_bulanan, catatan_harian, vol, satuan
      FROM ckh_rows
      WHERE document_id IN (${documentIds.map(() => '?').join(',')})
      ORDER BY tanggal ASC, row_order ASC, created_at ASC
    `).bind(...documentIds).all<PrintRow>()
    for (const row of rowsRes.results || []) {
      if (!rowsByDocument.has(row.document_id)) rowsByDocument.set(row.document_id, [])
      rowsByDocument.get(row.document_id)!.push(row)
    }
  }

  const [kepsek, kepalaTu] = await Promise.all([
    db.prepare(`
      SELECT COALESCE(u.nama_lengkap, u.name) as nama_lengkap, u.nip, COALESCE(u.jabatan_cetak, 'Kepala Madrasah') as jabatan_cetak
      FROM "user" u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      WHERE u.role = 'kepsek' OR ur.role = 'kepsek'
      ORDER BY u.nama_lengkap ASC
      LIMIT 1
    `).first<Signer>(),
    db.prepare(`
      SELECT COALESCE(u.nama_lengkap, u.name) as nama_lengkap, u.nip, COALESCE(u.jabatan_cetak, 'Kepala TU') as jabatan_cetak
      FROM "user" u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN master_jabatan_struktural mjs ON u.jabatan_struktural_id = mjs.id
      WHERE LOWER(COALESCE(mjs.nama, u.jabatan_cetak, '')) LIKE '%kepala tu%'
         OR LOWER(COALESCE(mjs.nama, u.jabatan_cetak, '')) LIKE '%kepala tata usaha%'
         OR u.role = 'admin_tu'
         OR ur.role = 'admin_tu'
      ORDER BY
        CASE
          WHEN LOWER(COALESCE(mjs.nama, u.jabatan_cetak, '')) LIKE '%kepala tu%' THEN 0
          WHEN LOWER(COALESCE(mjs.nama, u.jabatan_cetak, '')) LIKE '%kepala tata usaha%' THEN 0
          ELSE 1
        END,
        u.nama_lengkap ASC
      LIMIT 1
    `).first<Signer>(),
  ])

  return (
    <div className="bg-slate-100 min-h-screen print:bg-white">
      <style>{`
        @media print {
          @page { size: 215mm 330mm; margin: 15mm 12mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .ckh-page { page-break-after: always; break-after: page; }
          .ckh-page:last-child { page-break-after: auto; break-after: auto; }
          .ckh-print-table tr { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
      <PrintToolbar />
      {users.length === 0 ? (
        <div className="mx-auto mt-8 max-w-xl rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 print:hidden">
          Belum ada CKH yang disimpan untuk pilihan ini.
        </div>
      ) : (
        <main className="mx-auto max-w-[215mm] space-y-4 p-4 print:max-w-none print:p-0">
          {users.map(user => (
            <div key={user.id} className="bg-white p-8 shadow-sm print:p-0 print:shadow-none">
              <CkhPrintBlock
                user={user}
                rows={rowsByDocument.get(user.document_id) || []}
                kepsek={kepsek || null}
                kepalaTu={kepalaTu || null}
                year={year}
                month={month}
              />
            </div>
          ))}
        </main>
      )}
    </div>
  )
}
