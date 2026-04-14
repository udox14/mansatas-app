import Link from 'next/link'
import { getDB } from '@/utils/db'
import { WelcomeStrip } from './shared/WelcomeStrip'
import { FeatureShortcuts } from './shared/FeatureShortcuts'
import { Calendar, PlayCircle, Info, ClipboardList } from 'lucide-react'

type Props = {
  userId: string; nama: string; namaDepan: string; avatarUrl: string | null
  roleLabel: string; roleColor: string; sapaan: string
  taAktif: { id?: string; nama: string; semester: number } | null
}

export async function GuruPPLDashboard({ userId, nama, namaDepan, avatarUrl, roleLabel, roleColor, sapaan, taAktif }: Props) {
  const db = await getDB()
  
  // Ambil data mapping substitusi
  const { results: rawMappings } = await db.prepare(`
    SELECT m.jadwal_mengajar_id, m.jadwal_piket_id, 
           u.nama_lengkap as guru_utama
    FROM guru_ppl_mapping m
    JOIN "user" u ON m.guru_utama_id = u.id
    WHERE m.guru_ppl_id = ?
  `).bind(userId).all<any>()

  const mappings = rawMappings || []
  const tkbm = mappings.filter(m => m.jadwal_mengajar_id !== null).length
  const tpiket = mappings.filter(m => m.jadwal_piket_id !== null).length

  // Ambil list guru utama yang digantikan (unik)
  const guruDigantikan = Array.from(new Set(mappings.map(m => m.guru_utama)))

  return (
    <div className="space-y-3 animate-in fade-in duration-500 pb-12">
      <WelcomeStrip nama={nama} namaDepan={namaDepan} avatarUrl={avatarUrl}
        roleLabel={roleLabel} roleColor={roleColor} taAktif={taAktif} sapaan={sapaan} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Ringkasan Tugas */}
        <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-900/10 shadow-sm overflow-hidden p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-800 border border-emerald-200 dark:border-emerald-700">
              <Info className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">Status Praktik Anda</h3>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">Anda menggantikan {guruDigantikan.length} Guru</p>
            </div>
          </div>
          
          <div className="space-y-2 mb-4">
            {guruDigantikan.length > 0 ? (
              <div className="text-xs text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Menyubstitusi:</span> {guruDigantikan.join(', ')}
              </div>
            ) : (
              <div className="text-xs text-amber-600 italic">Belum ada tugas penggantian yang ditugaskan kepada Anda.</div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 p-2 text-center">
              <p className="text-xl font-bold text-slate-800 dark:text-slate-200">{tkbm}</p>
              <p className="text-[10px] text-slate-500">Sesi KBM</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 p-2 text-center">
              <p className="text-xl font-bold text-slate-800 dark:text-slate-200">{tpiket}</p>
              <p className="text-[10px] text-slate-500">Sesi Piket</p>
            </div>
          </div>
        </div>

        {/* Cepat Menu */}
        <div className="space-y-3">
          <Link href="/dashboard/agenda" className="group flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30">
                <Calendar className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:text-indigo-400 transition-colors">Isi Agenda (KBM)</h4>
                <p className="text-[11px] text-slate-500">Isi agenda harian kelas</p>
              </div>
            </div>
            <PlayCircle className="h-4 w-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
          </Link>

          <Link href="/dashboard/nilai-harian" className="group flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-rose-300 dark:hover:border-rose-700 transition-colors shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-900/30">
                <ClipboardList className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-rose-600 dark:text-rose-400 transition-colors">Nilai Harian</h4>
                <p className="text-[11px] text-slate-500">Input nilai evaluasi siswa</p>
              </div>
            </div>
            <PlayCircle className="h-4 w-4 text-slate-300 group-hover:text-rose-500 transition-colors" />
          </Link>
        </div>
      </div>

      <FeatureShortcuts userId={userId} />
    </div>
  )
}
