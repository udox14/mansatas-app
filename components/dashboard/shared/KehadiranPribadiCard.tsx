// components/dashboard/shared/KehadiranPribadiCard.tsx
import { getDB } from '@/utils/db'
import { todayWIB } from '@/lib/time'
import { UserCheck, BookOpen } from 'lucide-react'
import { Clock } from 'lucide-react'

type Props = { userId: string }

function BaseCard({ title, subtitle, hadir, sakit, izin, alfa, total, telat, icon: Icon, iconBg, iconColor, telatMsg }: any) {
  const pct = total > 0 ? Math.round((hadir / total) * 100) : null
  const pctColor = pct === null ? 'text-slate-400' : pct >= 90 ? 'text-emerald-600' : pct >= 75 ? 'text-amber-600' : 'text-rose-600'

  return (
    <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
        <div className={`p-1.5 rounded-md border ${iconBg}`}>
          <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{title}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">{subtitle}</p>
        </div>
        {pct !== null && (
          <span className={`text-xl font-bold tabular-nums ${pctColor}`}>{pct}%</span>
        )}
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1.5 py-6">
          <p className="text-xs text-slate-400 dark:text-slate-500">Belum ada data bulan ini</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 divide-x divide-slate-100 dark:divide-slate-800">
          {[
            { label: 'Hadir', val: hadir, color: 'text-emerald-600' },
            { label: 'Sakit', val: sakit, color: 'text-amber-600'   },
            { label: 'Izin',  val: izin,  color: 'text-blue-600'    },
            { label: 'Alfa',  val: alfa,  color: 'text-rose-600'    },
          ].map(({ label, val, color }) => (
            <div key={label} className="flex flex-col items-center gap-0.5 py-3">
              <span className={`text-xl font-bold leading-none tabular-nums ${color}`}>{val}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">{label}</span>
            </div>
          ))}
        </div>
      )}

      {telat > 0 && (
        <div className="flex items-center gap-1.5 px-4 py-2 border-t border-surface-2 bg-amber-50/60 dark:bg-amber-900/10">
          <Clock className="h-3 w-3 text-amber-500 shrink-0" />
          <p className="text-[10px] text-amber-700 dark:text-amber-400">
            Terlambat <span className="font-bold">{telat}×</span> {telatMsg || 'bulan ini'}
          </p>
        </div>
      )}
    </div>
  )
}

export async function KehadiranPribadiCard({ userId }: Props) {
  const db = await getDB()
  const today = todayWIB()
  const yearMonth = today.substring(0, 7)

  const monthLabel = new Date(yearMonth + '-01').toLocaleDateString('id-ID', {
    month: 'long', year: 'numeric',
  })

  // Cek role user
  const user = await db.prepare(`
    SELECT role,
    (SELECT GROUP_CONCAT(role) FROM user_roles WHERE user_id = u.id) as secondary_roles
    FROM "user" u WHERE id = ?
  `).bind(userId).first<any>() || {}

  const secRoles = user.secondary_roles ? user.secondary_roles.split(',') : []
  const allRoles = [user.role, ...secRoles].filter(Boolean)
  const isGuru = allRoles.includes('guru')

  // Data Agenda Mengajar (Khusus Guru)
  let dataGuru: any = null
  if (isGuru) {
    dataGuru = await db.prepare(`
      SELECT
        COUNT(CASE WHEN status IN ('TEPAT_WAKTU', 'TELAT') THEN 1 END) as hadir,
        COUNT(CASE WHEN status = 'SAKIT' THEN 1 END) as sakit,
        COUNT(CASE WHEN status = 'IZIN'  THEN 1 END) as izin,
        COUNT(CASE WHEN status = 'ALFA'  THEN 1 END) as alfa,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'TELAT' THEN 1 END) as telat
      FROM agenda_guru
      WHERE guru_id = ? AND strftime('%Y-%m', tanggal) = ?
    `).bind(userId, yearMonth).first<any>()
  }

  if (!isGuru) return null

  return (
    <div className="flex flex-col gap-4">
      <BaseCard
        title="Kehadiran Mengajar (Agenda)"
        subtitle={`${monthLabel} (berdasarkan blok sesi)`}
        hadir={dataGuru?.hadir ?? 0}
        sakit={dataGuru?.sakit ?? 0}
        izin={dataGuru?.izin ?? 0}
        alfa={dataGuru?.alfa ?? 0}
        total={dataGuru?.total ?? 0}
        telat={dataGuru?.telat ?? 0}
        icon={BookOpen}
        iconBg="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800"
        iconColor="text-emerald-600 dark:text-emerald-400"
        telatMsg="sesi mengajar bulan ini"
      />
    </div>
  )
}
