const fs = require('fs')

let code = fs.readFileSync('app/portal-ortu/components/portal-ortu-client.tsx', 'utf8')

// The correct renderBeranda string
const correctRenderBeranda = \`  const renderBeranda = () => {
    const activeSummons = (summons.results || []).filter((s: any) => s.status === 'terkirim' && !s.parent_response)
    const activeNotifications = (notifications.results || []).filter((n: any) => !n.is_read)

    return (
      <motion.div
        key="beranda"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        className="space-y-5 pb-24 sm:pb-8"
      >
        {/* Hero Section */}
        <div className="relative bg-gradient-to-br from-slate-900 to-slate-800 rounded-[28px] p-6 sm:p-8 text-white shadow-md overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <GraduationCap className="w-48 h-48 -mt-12 -mr-12" />
          </div>
          
          <Dialog>
            <DialogTrigger asChild>
              <button className="absolute top-4 right-4 w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors z-20 border border-white/10">
                <Settings className="w-4 h-4 text-white" />
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-2xl p-0 border-0 overflow-hidden bg-white">
              <DialogHeader className="p-6 pb-4 border-b border-slate-100">
                <DialogTitle className="text-lg font-semibold text-slate-800">Pengaturan Akun</DialogTitle>
              </DialogHeader>
              <div className="p-6 bg-slate-50">
                <ChangePasswordForm />
              </div>
            </DialogContent>
          </Dialog>

          <div className="flex flex-col sm:flex-row sm:items-center gap-5 relative z-10">
            <div className="relative shrink-0">
              <div className="w-20 aspect-[3/4] rounded-xl border-2 border-white/20 bg-slate-800 flex items-center justify-center overflow-hidden shadow-inner">
                {profil.foto_url ? (
                  <img src={profil.foto_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-3xl font-bold text-slate-400">{initialLetter}</span>
                )}
              </div>
            </div>
            
            <div className="flex-1">
              <p className="text-slate-400 text-xs font-medium tracking-wide uppercase mb-1">Portal Orang Tua</p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2 pr-8">
                {profil.nama_lengkap}
              </h1>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="bg-white/10 border border-white/20 text-slate-100 px-3 py-1 rounded-md text-xs font-medium">
                  Kelas {kelasLabel}
                </span>
                <span className="bg-white/10 border border-white/20 text-slate-100 px-3 py-1 rounded-md text-xs font-medium">
                  NISN {profil.nisn}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Wali Kelas */}
          <div className="col-span-2 sm:col-span-1">
            <StandardCard className="h-full flex flex-col justify-between hover:border-sky-200 transition-colors">
              <div className="flex items-start gap-4">
                <div className="bg-sky-50 text-sky-600 p-3 rounded-xl">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-0.5">Wali Kelas</p>
                  <h3 className="text-sm font-semibold text-slate-800 leading-tight">
                    {waliKelasRow?.nama_lengkap || 'Belum diatur'}
                  </h3>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                {waUrl ? (
                  <a href={waUrl} target="_blank" className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100 transition-colors">
                    <MessageCircle className="h-4 w-4" /> Hubungi via WhatsApp
                  </a>
                ) : (
                  <span className="inline-block text-xs font-medium text-slate-400">Kontak tidak tersedia</span>
                )}
              </div>
            </StandardCard>
          </div>

          {/* Quick Stats */}
          <div className="col-span-2 sm:col-span-1 grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl border border-emerald-100 p-4 flex flex-col items-center justify-center text-center shadow-sm">
              <span className="text-2xl font-bold text-emerald-600">{absensiRekap?.hadir || 0}</span>
              <span className="text-[11px] font-medium text-slate-500 mt-1">Kehadiran</span>
            </div>
            <div className="bg-white rounded-2xl border border-rose-100 p-4 flex flex-col items-center justify-center text-center shadow-sm">
              <span className="text-2xl font-bold text-rose-600">{disiplinRekap?.total_poin || 0}</span>
              <span className="text-[11px] font-medium text-slate-500 mt-1">Poin Min</span>
            </div>
            <div className="col-span-2 bg-white rounded-2xl border border-amber-100 p-4 flex items-center justify-between shadow-sm">
              <div>
                <span className="text-[11px] font-medium text-slate-500 block mb-0.5">Sakit & Izin</span>
                <p className="text-lg font-bold text-amber-600">{(absensiRekap?.sakit || 0) + (absensiRekap?.izin || 0)} <span className="text-xs font-medium text-slate-500">hari</span></p>
              </div>
              <div className="p-2 bg-amber-50 rounded-lg text-amber-500">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Critical Notifications / Summons */}
        {(activeSummons.length > 0 || activeNotifications.length > 0) && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide ml-1">Peringatan Penting</h2>
            
            {activeSummons.map((s: any) => (
              <Dialog key={s.id}>
                <DialogTrigger asChild>
                  <button className="w-full text-left outline-none">
                    <StandardCard className="border-l-4 border-l-rose-500 hover:shadow-md transition-shadow">
                      <div className="flex gap-4 items-center">
                        <div className="p-2 rounded-lg bg-rose-50 text-rose-600 shrink-0">
                          <AlertOctagon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="bg-rose-100 text-rose-700 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">Panggilan Wali</span>
                          </div>
                          <h3 className="text-sm font-semibold text-slate-800 leading-tight">{s.reason}</h3>
                          <p className="text-xs text-slate-500 mt-1">{s.event_date} {s.event_time}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </StandardCard>
                  </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md rounded-2xl p-0 border-0 overflow-hidden bg-white">
                  <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-rose-50/30">
                    <DialogTitle className="text-lg font-semibold text-rose-900 flex items-center gap-2">
                      <AlertOctagon className="w-5 h-5 text-rose-600" /> Panggilan Orang Tua
                    </DialogTitle>
                  </DialogHeader>
                  <div className="p-6 space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800 mb-1">Alasan Pemanggilan</h4>
                      <p className="text-sm text-slate-600 leading-relaxed">{s.reason}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-700 border border-slate-100">
                      <p className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-slate-400"/> {s.event_date || '-'} {s.event_time || ''}</p>
                      {s.location && <p className="flex items-center gap-2 mt-1"><House className="w-4 h-4 text-slate-400"/> {s.location}</p>}
                    </div>
                    {s.note && (
                      <div>
                        <h4 className="text-sm font-semibold text-slate-800 mb-1">Catatan Sekolah</h4>
                        <p className="text-sm text-slate-600 leading-relaxed">{s.note}</p>
                      </div>
                    )}
                    <div className="pt-4 border-t border-slate-100 mt-4">
                      <h4 className="text-sm font-semibold text-slate-800 mb-3">Formulir Tanggapan Anda</h4>
                      <SummonResponseForm summonId={s.id} status={s.status} />
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            ))}

            {activeNotifications.map((n: any) => (
               <StandardCard key={n.id} className={\`border-l-4 \${n.level === 'critical' ? 'border-l-rose-500' : n.level === 'warning' ? 'border-l-amber-500' : 'border-l-sky-500'}\`}>
                 <div className="flex gap-4">
                   <div className={\`mt-0.5 shrink-0 p-2 rounded-lg \${
                     n.level === 'critical' ? 'bg-rose-50 text-rose-600' : n.level === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-sky-50 text-sky-600'
                   }\`}>
                     <Bell className="h-4 w-4" />
                   </div>
                   <div className="flex-1">
                     <h3 className="text-sm font-semibold text-slate-800">{n.title}</h3>
                     <p className="text-sm text-slate-600 mt-1">{n.message}</p>
                   </div>
                   <form action={async () => {
                     await markParentNotificationRead(n.id)
                   }}>
                     <button type="submit" className="text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 hover:bg-slate-100 rounded-full p-2" title="Tandai sudah dibaca">
                       <CheckCircle2 className="w-5 h-5" />
                     </button>
                   </form>
                 </div>
               </StandardCard>
            ))}
          </div>
        )}

        {/* Announcements */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3 ml-1">
            <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">Pengumuman Sekolah</h2>
          </div>
          
          <div className="space-y-3">
            {(pengumumanRows.results || []).length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                <p className="text-sm text-slate-500">Tidak ada pengumuman terbaru.</p>
              </div>
            ) : (pengumumanRows.results || []).map((item: any) => (
              <Dialog key={item.id}>
                <DialogTrigger asChild>
                  <button className="w-full text-left outline-none">
                    <StandardCard className="border-l-4 border-l-sky-500 hover:shadow-md transition-shadow">
                      <div className="flex gap-4 items-center">
                        <div className="p-2 rounded-lg bg-sky-50 text-sky-600 shrink-0">
                          <Megaphone className="w-5 h-5" />
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <h3 className="text-sm font-semibold text-slate-800 truncate">{item.title}</h3>
                          <p className="text-xs text-slate-500 mt-1">{item.publish_at.split(' ')[0]}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      </div>
                    </StandardCard>
                  </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md rounded-2xl p-0 border-0 overflow-hidden bg-white">
                  <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-sky-50/50">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-sky-100 text-sky-600 shrink-0 mt-0.5">
                        <Megaphone className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <DialogTitle className="text-lg font-semibold text-slate-800 leading-tight">
                          {item.title}
                        </DialogTitle>
                        <p className="text-xs text-slate-500 mt-1">{item.publish_at}</p>
                      </div>
                    </div>
                  </DialogHeader>
                  <div className="p-6 max-h-[60vh] overflow-y-auto">
                    <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">{item.body}</p>
                  </div>
                </DialogContent>
              </Dialog>
            ))}
          </div>
        </div>

        {/* Riwayat Komunikasi & Tindak Lanjut */}
        {(notes.results || []).length > 0 && (
          <div className="pt-2">
            <div className="flex items-center justify-between mb-3 ml-1">
              <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">Riwayat Tindak Lanjut</h2>
            </div>
            
            <div className="space-y-3">
              {(notes.results || []).map((note: any) => (
                <StandardCard key={note.id} className="flex gap-4 items-start">
                  <div className={\`p-2 rounded-lg shrink-0 \${note.actor_type === 'orang_tua' ? 'bg-indigo-50 text-indigo-600' : 'bg-sky-50 text-sky-600'}\`}>
                    <MessageSquareText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-slate-800">{note.actor_type === 'orang_tua' ? 'Anda (Orang Tua)' : 'Pihak Sekolah'}</h3>
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md uppercase">{note.note_type.replace('_', ' ')}</span>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{note.content}</p>
                    <p className="text-[11px] text-slate-400 mt-2">{note.created_at}</p>
                  </div>
                </StandardCard>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    )
  }\`

const startIdx = code.indexOf('  const renderBeranda = () => {')
const endIdx = code.indexOf('  const renderJadwal = () => (')
if (startIdx !== -1 && endIdx !== -1) {
  code = code.substring(0, startIdx) + correctRenderBeranda + '\\n\\n' + code.substring(endIdx)
  fs.writeFileSync('app/portal-ortu/components/portal-ortu-client.tsx', code)
}
