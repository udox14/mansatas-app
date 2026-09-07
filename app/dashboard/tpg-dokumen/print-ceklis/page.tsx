import { redirect } from 'next/navigation'
import type { CSSProperties } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { getUserRoles } from '@/lib/features'
import { ensureTpgSchema } from '@/lib/tpg-schema'
import { monthName, previousMonthPeriod, TPG_CKH_ROLES } from '@/lib/tpg'
import { PrintCeklisToolbar } from './print-ceklis-toolbar'

export const metadata = { title: 'Cetak Lembar Ceklis TPG - MANSATAS App' }
export const dynamic = 'force-dynamic'

type TeacherProfile = {
  id: string
  nama_lengkap: string
  role: string
  roles: string | null
  nip: string | null
  nuptk: string | null
  nrg: string | null
  pangkat_golongan: string | null
  nomor_whatsapp: string | null
  no_urut: string | null
}

interface PageProps {
  searchParams: Promise<{
    year?: string
    month?: string
    date?: string
    city?: string
    users?: string
  }>
}

function parseIds(value: string | undefined) {
  return Array.from(new Set(String(value || '').split(',').map(id => id.trim()).filter(Boolean)))
}

export default async function PrintCeklisPage({ searchParams }: PageProps) {
  const params = await searchParams
  const authUser = await getCurrentUser()
  if (!authUser) redirect('/login')

  const db = await getDB()
  await ensureTpgSchema(db)

  const roles = await getUserRoles(db, authUser.id)
  const canManage = roles.includes('super_admin') || roles.includes('admin_tu')

  const fallbackPeriod = previousMonthPeriod()
  const year = Number(params.year) || fallbackPeriod.year
  const month = Number(params.month) || fallbackPeriod.month
  const city = params.city?.trim() || 'Tasikmalaya'
  const dateText = params.date?.trim() || ''

  const requestedUserIds = parseIds(params.users)

  let teachers: TeacherProfile[] = []

  if (!canManage) {
    // Non-admin can only print their own checklist
    const res = await db.prepare(`
      SELECT
        u.id,
        COALESCE(u.nama_lengkap, u.name) as nama_lengkap,
        u.role,
        GROUP_CONCAT(DISTINCT ur.role) as roles,
        u.nip,
        u.nuptk,
        u.nrg,
        u.pangkat_golongan,
        u.nomor_whatsapp,
        u.no_urut
      FROM "user" u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      WHERE u.id = ? AND COALESCE(u.banned, 0) = 0
      GROUP BY u.id
    `).bind(authUser.id).all<TeacherProfile>()
    teachers = res.results || []
  } else if (requestedUserIds.length > 0) {
    // Admin printed selected users
    const placeholders = requestedUserIds.map(() => '?').join(',')
    const res = await db.prepare(`
      SELECT
        u.id,
        COALESCE(u.nama_lengkap, u.name) as nama_lengkap,
        u.role,
        GROUP_CONCAT(DISTINCT ur.role) as roles,
        u.nip,
        u.nuptk,
        u.nrg,
        u.pangkat_golongan,
        u.nomor_whatsapp,
        u.no_urut
      FROM "user" u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      WHERE u.id IN (${placeholders}) AND COALESCE(u.banned, 0) = 0
      GROUP BY u.id
      ORDER BY
        CASE
          WHEN u.no_urut IS NOT NULL AND TRIM(u.no_urut) <> ''
          THEN CAST(u.no_urut AS INTEGER)
          ELSE 999999
        END ASC,
        u.nama_lengkap ASC
    `).bind(...requestedUserIds).all<TeacherProfile>()
    teachers = res.results || []
  } else {
    // Admin printed ALL teachers
    const rolePlaceholders = TPG_CKH_ROLES.map(() => '?').join(',')
    const res = await db.prepare(`
      SELECT
        u.id,
        COALESCE(u.nama_lengkap, u.name) as nama_lengkap,
        u.role,
        GROUP_CONCAT(DISTINCT ur.role) as roles,
        u.nip,
        u.nuptk,
        u.nrg,
        u.pangkat_golongan,
        u.nomor_whatsapp,
        u.no_urut
      FROM "user" u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      WHERE (
        u.role IN (${rolePlaceholders})
        OR EXISTS (
          SELECT 1 FROM user_roles ur2
          WHERE ur2.user_id = u.id AND ur2.role IN (${rolePlaceholders})
        )
      ) AND COALESCE(u.banned, 0) = 0
      GROUP BY u.id
      ORDER BY
        CASE
          WHEN u.no_urut IS NOT NULL AND TRIM(u.no_urut) <> ''
          THEN CAST(u.no_urut AS INTEGER)
          ELSE 999999
        END ASC,
        u.nama_lengkap ASC
    `).bind(...TPG_CKH_ROLES, ...TPG_CKH_ROLES).all<TeacherProfile>()
    teachers = res.results || []
  }

  const namaBulan = monthName(month)
  const namaBulanUpper = namaBulan.toUpperCase()

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white text-black font-sans antialiased">
      <style>{`
        @media print {
          @page {
            size: 210mm 297mm;
            margin: 12mm 15mm;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background: white !important;
          }
          .ceklis-sheet {
            page-break-after: always;
            break-after: page;
          }
          .ceklis-sheet:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          .no-break {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>

      <PrintCeklisToolbar teacherCount={teachers.length} />

      {teachers.length === 0 ? (
        <div className="mx-auto mt-8 max-w-xl rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 print:hidden">
          Tidak ada data guru yang ditemukan untuk dicetak.
        </div>
      ) : (
        <main className="mx-auto max-w-[210mm] space-y-6 p-4 print:max-w-none print:p-0 print:space-y-0">
          {teachers.map(teacher => (
            <div key={teacher.id} className="space-y-6 print:space-y-0">
              {/* Sheet 1: ASLI */}
              <SingleCeklisSheet
                type="ASLI"
                teacher={teacher}
                year={year}
                monthName={namaBulan}
                monthNameUpper={namaBulanUpper}
                city={city}
                dateText={dateText}
              />
              {/* Sheet 2: SALINAN */}
              <SingleCeklisSheet
                type="SALINAN"
                teacher={teacher}
                year={year}
                monthName={namaBulan}
                monthNameUpper={namaBulanUpper}
                city={city}
                dateText={dateText}
              />
            </div>
          ))}
        </main>
      )}
    </div>
  )
}

interface SheetProps {
  type: 'ASLI' | 'SALINAN'
  teacher: TeacherProfile
  year: number
  monthName: string
  monthNameUpper: string
  city: string
  dateText: string
}

function SingleCeklisSheet({
  type,
  teacher,
  year,
  monthName,
  monthNameUpper,
  city,
  dateText,
}: SheetProps) {
  const cellBorder: CSSProperties = { border: '1px solid #000' }

  return (
    <div className="ceklis-sheet relative bg-white p-8 shadow-sm print:p-0 print:shadow-none print:w-full text-[13px] leading-relaxed text-black font-sans">
      {/* Top Header: Box ASLI/SALINAN & Box No. Urut */}
      <div className="flex justify-end gap-2 mb-3">
        <div className="border border-black px-4 py-1 text-center font-bold text-xs tracking-wider min-w-[75px]">
          {type}
        </div>
        <div className="border border-black px-4 py-1 text-center font-bold text-xs min-w-[85px]">
          No.{teacher.no_urut ? teacher.no_urut : ''}
        </div>
      </div>

      {/* Main Title */}
      <div className="text-center font-bold text-[13.5px] leading-snug tracking-wide uppercase">
        <div>CEKLIST KELENGKAPAN</div>
        <div>PERSYARATAN PENCAIRAN TUNJANGAN PROFESI GURU MADRASAH/RA</div>
        <div>KABUPATEN TASIKMALAYA PERIODE {monthNameUpper} {year}</div>
      </div>

      {/* Thick Black Line under Title */}
      <div className="w-[82%] mx-auto border-b-[4px] border-black mt-1.5 mb-3" />

      {/* Right Status Box: PNS / PPPK / INPASSING / NON INPASSING *) */}
      <div className="flex justify-end mb-4">
        <div className="border border-black px-4 py-1.5 text-center text-[11px] font-medium leading-snug whitespace-nowrap">
          <div>PNS &nbsp;&nbsp;/&nbsp;&nbsp; PPPK &nbsp;&nbsp;/</div>
          <div>INPASSING &nbsp;&nbsp;/&nbsp;&nbsp; NON INPASSING *)</div>
        </div>
      </div>

      {/* Teacher Details with aligned colons */}
      <div className="space-y-0.5 text-[12.5px] mb-5">
        <div className="flex">
          <span className="w-[170px] shrink-0 font-medium">NAMA</span>
          <span className="w-[16px] shrink-0 text-center">:</span>
          <span className="font-bold">{teacher.nama_lengkap}</span>
        </div>

        <div className="flex">
          <span className="w-[170px] shrink-0 font-medium">NIP</span>
          <span className="w-[16px] shrink-0 text-center">:</span>
          <span>{teacher.nip || '-'}</span>
        </div>

        <div className="flex">
          <span className="w-[170px] shrink-0 font-medium">NUPTK</span>
          <span className="w-[16px] shrink-0 text-center">:</span>
          <span>{teacher.nuptk || '-'}</span>
        </div>

        <div className="flex">
          <span className="w-[170px] shrink-0 font-medium">NRG</span>
          <span className="w-[16px] shrink-0 text-center">:</span>
          <span>{teacher.nrg || '-'}</span>
        </div>

        <div className="flex">
          <span className="w-[170px] shrink-0 font-medium">PANGKAT/GOLONGAN</span>
          <span className="w-[16px] shrink-0 text-center">:</span>
          <span>{teacher.pangkat_golongan || '-'}</span>
        </div>

        <div className="flex">
          <span className="w-[170px] shrink-0 font-medium">TEMPAT TUGAS</span>
          <span className="w-[16px] shrink-0 text-center">:</span>
          <span>MAN 1 Tasikmalaya</span>
        </div>

        <div className="flex items-start">
          <span className="w-[170px] shrink-0 font-medium">ALAMAT TEMPAT TUGAS</span>
          <span className="w-[16px] shrink-0 text-center">:</span>
          <div>
            <div>Kec. Sukarame Kab. Tasikmalaya</div>
            <div>Jln. Pahlawan KHZ Musthafa Sukamanah Desa Sukarapih</div>
          </div>
        </div>

        <div className="flex pt-1.5">
          <span className="w-[170px] shrink-0 font-medium">TELP/HP</span>
          <span className="w-[16px] shrink-0 text-center">:</span>
          <span className="italic">
            {teacher.nomor_whatsapp ? `${teacher.nomor_whatsapp} (WhatsApp)` : '-'}
          </span>
        </div>
      </div>

      {/* Checklist Table */}
      <table className="w-full border-collapse text-[12.5px] mb-2" style={cellBorder}>
        <thead>
          <tr className="bg-transparent">
            <th style={cellBorder} className="w-[38px] py-1.5 px-1 text-center font-bold">
              No.
            </th>
            <th style={cellBorder} className="py-1.5 px-3 text-center font-bold">
              URAIAN
            </th>
            <th style={cellBorder} className="w-[95px] py-1.5 px-1 text-center font-bold">
              CHECKLIST
            </th>
            <th style={cellBorder} className="w-[65px] py-1.5 px-1 text-center font-bold">
              KET
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={cellBorder} className="py-1.5 px-1 text-center align-middle font-medium">
              1
            </td>
            <td style={cellBorder} className="py-1.5 px-3 align-middle">
              FC SKAKPT (S36b/c) bulan {monthName} {year}
            </td>
            <td style={cellBorder} className="py-1.5 px-1 text-center align-middle font-bold text-base">
              &#10003;
            </td>
            <td style={cellBorder} className="py-1.5 px-1 text-center align-middle">
            </td>
          </tr>
          <tr>
            <td style={cellBorder} className="py-1.5 px-1 text-center align-middle font-medium">
              2
            </td>
            <td style={cellBorder} className="py-1.5 px-3 align-middle">
              FC Rekap Absen EMISGTK (S35) {monthName} {year}
            </td>
            <td style={cellBorder} className="py-1.5 px-1 text-center align-middle font-bold text-base">
              &#10003;
            </td>
            <td style={cellBorder} className="py-1.5 px-1 text-center align-middle">
            </td>
          </tr>
          <tr>
            <td style={cellBorder} className="py-1.5 px-1 text-center align-middle font-medium">
              3
            </td>
            <td style={cellBorder} className="py-1.5 px-3 align-middle">
              FC Laporan Kinerja Harian {monthName} {year}
            </td>
            <td style={cellBorder} className="py-1.5 px-1 text-center align-middle font-bold text-base">
              &#10003;
            </td>
            <td style={cellBorder} className="py-1.5 px-1 text-center align-middle">
            </td>
          </tr>
          <tr>
            <td style={cellBorder} className="py-1.5 px-1 text-center align-middle font-medium">
              4
            </td>
            <td style={cellBorder} className="py-1.5 px-3 align-middle">
              FC Surat Tugas, Cuti , Sakit , alasan penting (jika ada)
            </td>
            <td style={cellBorder} className="py-1.5 px-1 text-center align-middle font-bold text-base">
              -
            </td>
            <td style={cellBorder} className="py-1.5 px-1 text-center align-middle">
            </td>
          </tr>
        </tbody>
      </table>

      {/* Note below table */}
      <div className="text-[12px] mb-8">
        Ket : Berkas disusun per-PTK
      </div>

      {/* Signature Section on the Bottom Right */}
      <div className="flex justify-end text-[12.5px]">
        <div className="w-[240px] text-left leading-normal">
          <div>
            {city}, {dateText ? dateText : `.................................... ${year}`}
          </div>
          <div className="mt-0.5">Penerima Berkas</div>
          <div className="h-[75px]" />
          <div className="tracking-tighter">....................................................</div>
        </div>
      </div>
    </div>
  )
}
