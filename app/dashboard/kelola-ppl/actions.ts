'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB as getRawDB } from '@/utils/db-server'
import { requireActionAccess } from '@/lib/action-security'
import { formatNamaKelas } from '@/lib/utils'
import { currentTimeWIB, nowWIBISO, todayWIB } from '@/lib/time'
import { getEffectiveDatesInRange, getKbmExceptionsForRange, hariNumFromDateString, splitTeachingSlotsByExceptions } from '@/lib/kalender-pendidikan'
import { filterPplAttendanceStatus, summarizePplAttendance, type PplAttendanceItem, type PplAttendanceStatus, type PplCampus } from '@/lib/guru-ppl-attendance'
import type { PolaJam, SlotJam } from '@/app/dashboard/settings/types'

export type {
  PplAssignmentPeriod,
  PplAttendanceItem,
  PplAttendanceOverride,
  PplAttendanceStatus,
  PplAttendanceSummary,
  PplCampus,
} from '@/lib/guru-ppl-attendance'

async function getDB(action: 'read' | 'create' | 'update' | 'delete' = 'read') {
  await requireActionAccess('kelola-ppl', action)
  return getRawDB()
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const OVERRIDE_STATUSES = new Set(['HADIR', 'TELAT', 'SAKIT', 'IZIN', 'ALFA'])
const HARI = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

function assertDate(value: string, label = 'Tanggal') {
  if (!DATE_RE.test(value)) throw new Error(`${label} tidak valid.`)
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} tidak valid.`)
  }
}
function daysBetween(start: string, end: string) { return Math.round((new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) / 86400000) }
function slotsForDay(raw: string | null | undefined, hari: number): SlotJam[] {
  try { return ((JSON.parse(raw || '[]') as PolaJam[]).find(item => item.hari.includes(hari))?.slots || []) } catch { return [] }
}

export type GuruInfo = { id: string; nama_lengkap: string; role: string }
export type PplSummaryItem = { guruUtamaId: string; guruUtamaNama: string; kbm: number; piket: number }
export type PplWithSummary = GuruInfo & {
  kampus_id: string | null; kampus_nama: string | null; kampus_singkatan: string | null
  berlaku_mulai: string | null; berlaku_selesai: string | null
  substitutions: PplSummaryItem[]; totalKbm: number; totalPiket: number
  status: 'aktif' | 'akan_datang' | 'berakhir' | 'belum_ditugaskan'
}
export type PplDutyOption = { id: string; jenis: 'KBM' | 'PIKET'; guru_utama_id: string; guru_utama_nama: string; label: string; jadwal_label: string; conflict_ppl_id: string | null; conflict_ppl_nama: string | null }
export type PplMappingRow = { id: string; guru_ppl_id: string; guru_utama_id: string; guru_utama_nama: string; penugasan_mengajar_id: string | null; jadwal_piket_id: string | null; jenis: 'KBM' | 'PIKET'; label: string; berlaku_mulai: string; berlaku_selesai: string | null }

export async function getDaftarGuruPPLWithSummary(): Promise<PplWithSummary[]> {
  const db = await getDB(); const today = todayWIB()
  const [users, mappings] = await Promise.all([
    db.prepare(`SELECT DISTINCT u.id,u.nama_lengkap,u.role,p.kampus_id,k.nama AS kampus_nama,k.singkatan AS kampus_singkatan FROM "user" u LEFT JOIN user_roles ur ON ur.user_id=u.id LEFT JOIN guru_ppl_profile p ON p.user_id=u.id LEFT JOIN guru_ppl_kampus k ON k.id=p.kampus_id WHERE u.role='guru_ppl' OR ur.role='guru_ppl' ORDER BY u.nama_lengkap`).all<any>(),
    db.prepare(`SELECT m.guru_ppl_id,m.guru_utama_id,u.nama_lengkap AS guru_utama_nama,m.penugasan_mengajar_id,m.jadwal_piket_id,m.berlaku_mulai,m.berlaku_selesai FROM guru_ppl_mapping m JOIN "user" u ON u.id=m.guru_utama_id ORDER BY m.berlaku_mulai DESC`).all<any>(),
  ])
  const all = mappings.results || []
  return (users.results || []).map((ppl: any) => {
    const own = all.filter((row: any) => row.guru_ppl_id === ppl.id)
    const active = own.filter((row: any) => row.berlaku_mulai <= today && (!row.berlaku_selesai || row.berlaku_selesai >= today))
    const upcoming = own.filter((row: any) => row.berlaku_mulai > today)
    const byTeacher = new Map<string, PplSummaryItem>()
    for (const row of active) { if (!byTeacher.has(row.guru_utama_id)) byTeacher.set(row.guru_utama_id,{guruUtamaId:row.guru_utama_id,guruUtamaNama:row.guru_utama_nama,kbm:0,piket:0}); const s=byTeacher.get(row.guru_utama_id)!; row.penugasan_mengajar_id?s.kbm++:s.piket++ }
    const starts=active.map((row:any)=>row.berlaku_mulai).sort();const ends=active.map((row:any)=>row.berlaku_selesai).filter(Boolean).sort()
    return {...ppl,substitutions:[...byTeacher.values()],totalKbm:active.filter((row:any)=>row.penugasan_mengajar_id).length,totalPiket:active.filter((row:any)=>row.jadwal_piket_id).length,berlaku_mulai:starts[0]||upcoming.map((row:any)=>row.berlaku_mulai).sort()[0]||null,berlaku_selesai:active.some((row:any)=>!row.berlaku_selesai)?null:(ends.at(-1)||null),status:active.length?'aktif':upcoming.length?'akan_datang':own.length?'berakhir':'belum_ditugaskan'}
  })
}

/** Kompatibilitas untuk konsumen lama yang hanya membutuhkan daftar akun PPL. */
export async function getDaftarGuruPPL(): Promise<GuruInfo[]> {
  const rows = await getDaftarGuruPPLWithSummary()
  return rows.map(({ id, nama_lengkap, role }) => ({ id, nama_lengkap, role }))
}

export async function getDaftarGuruUtama(): Promise<GuruInfo[]> {
  const db=await getDB(); const result=await db.prepare(`SELECT DISTINCT u.id,u.nama_lengkap,u.role FROM "user" u LEFT JOIN user_roles ur ON ur.user_id=u.id WHERE u.role<>'guru_ppl' AND NOT EXISTS(SELECT 1 FROM user_roles x WHERE x.user_id=u.id AND x.role='guru_ppl') AND (u.role IN ('guru','wali_kelas','guru_bk','guru_piket','wakamad','kepsek') OR ur.role IN ('guru','wali_kelas','guru_bk','guru_piket','wakamad','kepsek')) ORDER BY u.nama_lengkap`).all<GuruInfo>(); return result.results||[]
}

export async function getPplCampuses(): Promise<PplCampus[]> { const db=await getDB();return (await db.prepare('SELECT id,nama,singkatan FROM guru_ppl_kampus ORDER BY nama').all<PplCampus>()).results||[] }

export async function savePplCampus(input:{id?:string;nama:string;singkatan?:string}){
  try{const db=await getDB(input.id?'update':'create');const user=await getCurrentUser();if(!user)return{error:'Unauthorized'};const nama=input.nama.trim(),singkatan=input.singkatan?.trim()||null;if(!nama||nama.length>150||(singkatan&&singkatan.length>30))return{error:'Nama atau singkatan kampus tidak valid.'};if(input.id)await db.prepare('UPDATE guru_ppl_kampus SET nama=?,singkatan=?,updated_by=?,updated_at=? WHERE id=?').bind(nama,singkatan,user.id,nowWIBISO(),input.id).run();else await db.prepare('INSERT INTO guru_ppl_kampus(id,nama,singkatan,created_by,updated_by,updated_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),nama,singkatan,user.id,user.id,nowWIBISO()).run();revalidatePath('/dashboard/kelola-ppl');return{success:'Master kampus berhasil disimpan.'}}catch(error){return{error:error instanceof Error&&error.message.includes('UNIQUE')?'Nama atau singkatan kampus sudah digunakan.':error instanceof Error?error.message:'Gagal menyimpan kampus.'}}
}
export async function deletePplCampus(id:string){try{const db=await getDB('delete');await db.prepare('DELETE FROM guru_ppl_kampus WHERE id=?').bind(id).run();revalidatePath('/dashboard/kelola-ppl');return{success:'Kampus dihapus; tag akun terkait dikosongkan.'}}catch(error){return{error:error instanceof Error?error.message:'Gagal menghapus kampus.'}}}

export async function batchSetPplCampus(userIds:string[],campusId:string|null){
  try{const db=await getDB('update');const actor=await getCurrentUser();if(!actor)return{error:'Unauthorized'};const ids=[...new Set(userIds.filter(Boolean))];const normalizedCampusId=campusId?.trim()||null;if(!ids.length||ids.length>200)return{error:'Pilih 1–200 akun PPL.'};if(normalizedCampusId&&!(await db.prepare('SELECT 1 FROM guru_ppl_kampus WHERE id=?').bind(normalizedCampusId).first()))return{error:'Kampus tidak ditemukan.'};const ph=ids.map(()=>'?').join(',');const valid=await db.prepare(`SELECT DISTINCT u.id FROM "user" u LEFT JOIN user_roles ur ON ur.user_id=u.id WHERE u.id IN (${ph}) AND (u.role='guru_ppl' OR ur.role='guru_ppl')`).bind(...ids).all<any>();if((valid.results||[]).length!==ids.length)return{error:'Pilihan memuat akun yang bukan Guru PPL.'};await db.batch(ids.map(id=>db.prepare(`INSERT INTO guru_ppl_profile(user_id,kampus_id,updated_by,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET kampus_id=excluded.kampus_id,updated_by=excluded.updated_by,updated_at=excluded.updated_at`).bind(id,normalizedCampusId,actor.id,nowWIBISO())));revalidatePath('/dashboard/kelola-ppl');return{success:`${ids.length} akun PPL berhasil diperbarui.`}}catch(error){return{error:error instanceof Error?error.message:'Gagal memperbarui tag kampus.'}}
}

export async function getPplWorkspace(pplUserId:string):Promise<{options:PplDutyOption[];mappings:PplMappingRow[]}>{
  const db=await getDB();const role=await db.prepare(`SELECT 1 FROM "user" u LEFT JOIN user_roles ur ON ur.user_id=u.id WHERE u.id=? AND (u.role='guru_ppl' OR ur.role='guru_ppl')`).bind(pplUserId).first();if(!role)return{options:[],mappings:[]}
  const [kbm,piket,history]=await Promise.all([
    db.prepare(`SELECT pm.id,pm.guru_id,u.nama_lengkap AS guru_nama,mp.nama_mapel,k.tingkat,k.nomor_kelas,k.kelompok,GROUP_CONCAT(jm.hari||':'||jm.jam_ke) AS jadwal_label,(SELECT cm.guru_ppl_id FROM guru_ppl_mapping cm WHERE cm.penugasan_mengajar_id=pm.id AND cm.berlaku_mulai<=date('now','+7 hours') AND (cm.berlaku_selesai IS NULL OR cm.berlaku_selesai>=date('now','+7 hours')) LIMIT 1) AS conflict_ppl_id,(SELECT pu.nama_lengkap FROM guru_ppl_mapping cm JOIN "user" pu ON pu.id=cm.guru_ppl_id WHERE cm.penugasan_mengajar_id=pm.id AND cm.berlaku_mulai<=date('now','+7 hours') AND (cm.berlaku_selesai IS NULL OR cm.berlaku_selesai>=date('now','+7 hours')) LIMIT 1) AS conflict_ppl_nama FROM penugasan_mengajar pm JOIN tahun_ajaran ta ON ta.id=pm.tahun_ajaran_id AND ta.is_active=1 JOIN "user" u ON u.id=pm.guru_id JOIN mata_pelajaran mp ON mp.id=pm.mapel_id JOIN kelas k ON k.id=pm.kelas_id JOIN jadwal_mengajar jm ON jm.penugasan_id=pm.id GROUP BY pm.id ORDER BY u.nama_lengkap,k.tingkat,k.nomor_kelas,mp.nama_mapel`).all<any>(),
    db.prepare(`SELECT j.id,j.user_id,u.nama_lengkap AS guru_nama,j.hari,s.nama_shift,s.jam_mulai,s.jam_selesai FROM jadwal_guru_piket j JOIN "user" u ON u.id=j.user_id JOIN pengaturan_shift_piket s ON s.id=j.shift_id ORDER BY u.nama_lengkap,j.hari,s.jam_mulai`).all<any>(),
    db.prepare(`SELECT m.*,u.nama_lengkap AS guru_utama_nama,mp.nama_mapel,k.tingkat,k.nomor_kelas,k.kelompok,s.nama_shift,j.hari FROM guru_ppl_mapping m JOIN "user" u ON u.id=m.guru_utama_id LEFT JOIN penugasan_mengajar pm ON pm.id=m.penugasan_mengajar_id LEFT JOIN mata_pelajaran mp ON mp.id=pm.mapel_id LEFT JOIN kelas k ON k.id=pm.kelas_id LEFT JOIN jadwal_guru_piket j ON j.id=m.jadwal_piket_id LEFT JOIN pengaturan_shift_piket s ON s.id=j.shift_id WHERE m.guru_ppl_id=? ORDER BY m.berlaku_mulai DESC`).bind(pplUserId).all<any>(),
  ])
  const options:PplDutyOption[]=[...(kbm.results||[]).map((r:any)=>({id:r.id,jenis:'KBM' as const,guru_utama_id:r.guru_id,guru_utama_nama:r.guru_nama,label:`${r.nama_mapel} · ${formatNamaKelas(r.tingkat,r.nomor_kelas,r.kelompok)}`,jadwal_label:r.jadwal_label||'',conflict_ppl_id:r.conflict_ppl_id||null,conflict_ppl_nama:r.conflict_ppl_nama||null})),...(piket.results||[]).map((r:any)=>({id:r.id,jenis:'PIKET' as const,guru_utama_id:r.user_id,guru_utama_nama:r.guru_nama,label:`Piket ${HARI[r.hari]} · ${r.nama_shift}`,jadwal_label:`Jam ${r.jam_mulai}–${r.jam_selesai}`,conflict_ppl_id:null,conflict_ppl_nama:null}))]
  const mappings:PplMappingRow[]=(history.results||[]).map((r:any)=>({...r,jenis:r.penugasan_mengajar_id?'KBM':'PIKET',label:r.penugasan_mengajar_id?`${r.nama_mapel} · ${formatNamaKelas(r.tingkat,r.nomor_kelas,r.kelompok)}`:`Piket ${HARI[r.hari]} · ${r.nama_shift}`}));return{options,mappings}
}

export async function createPplMappings(input:{pplUserId:string;dutyIds:string[];jenis:'KBM'|'PIKET';mulai:string;selesai:string}){
  try{const db=await getDB('create');if(!['KBM','PIKET'].includes(input.jenis))return{error:'Jenis tugas tidak valid.'};assertDate(input.mulai,'Tanggal mulai');assertDate(input.selesai,'Tanggal selesai');if(input.selesai<input.mulai)return{error:'Tanggal selesai tidak boleh lebih awal dari tanggal mulai.'};const ids=[...new Set(input.dutyIds.filter(Boolean))];if(!ids.length||ids.length>100)return{error:'Pilih 1–100 tugas.'};const ppl=await db.prepare(`SELECT 1 FROM "user" u LEFT JOIN user_roles ur ON ur.user_id=u.id WHERE u.id=? AND (u.role='guru_ppl' OR ur.role='guru_ppl')`).bind(input.pplUserId).first();if(!ppl)return{error:'Akun Guru PPL tidak valid.'};const ph=ids.map(()=>'?').join(',');let rows:any[]
    if(input.jenis==='KBM'){rows=(await db.prepare(`SELECT pm.id,pm.guru_id,GROUP_CONCAT(jm.hari||':'||jm.jam_ke) AS snapshot FROM penugasan_mengajar pm JOIN tahun_ajaran ta ON ta.id=pm.tahun_ajaran_id AND ta.is_active=1 JOIN jadwal_mengajar jm ON jm.penugasan_id=pm.id WHERE pm.id IN (${ph}) GROUP BY pm.id`).bind(...ids).all<any>()).results||[];if(rows.length!==ids.length)return{error:'Ada mapel–kelas yang tidak valid atau tidak aktif.'}}
    else{rows=(await db.prepare(`SELECT j.id,j.user_id AS guru_id,j.hari,s.jam_mulai,s.jam_selesai,s.nama_shift FROM jadwal_guru_piket j JOIN pengaturan_shift_piket s ON s.id=j.shift_id WHERE j.id IN (${ph})`).bind(...ids).all<any>()).results||[];if(rows.length!==ids.length)return{error:'Ada jadwal piket yang tidak valid.'}}
    if(rows.some(row=>row.guru_id===input.pplUserId))return{error:'Akun PPL tidak boleh menggantikan dirinya sendiri.'}
    const guruIds=[...new Set(rows.map(row=>row.guru_id).filter(Boolean))];const guruPh=guruIds.map(()=>'?').join(',');if(guruIds.length&&(await db.prepare(`SELECT 1 FROM "user" u LEFT JOIN user_roles ur ON ur.user_id=u.id WHERE u.id IN (${guruPh}) AND (u.role='guru_ppl' OR ur.role='guru_ppl') LIMIT 1`).bind(...guruIds).first()))return{error:'Guru utama harus berasal dari akun guru, bukan akun PPL.'}
    if(input.jenis==='KBM'&&await db.prepare(`SELECT 1 FROM guru_ppl_mapping WHERE penugasan_mengajar_id IN (${ph}) AND berlaku_mulai<=? AND ?<=COALESCE(berlaku_selesai,'9999-12-31') LIMIT 1`).bind(...ids,input.selesai,input.mulai).first())return{error:'Salah satu mapel–kelas sudah ditempati PPL lain pada periode tersebut.'}
    await db.batch(rows.map(r=>db.prepare(`INSERT INTO guru_ppl_mapping(id,guru_ppl_id,guru_utama_id,penugasan_mengajar_id,jadwal_piket_id,berlaku_mulai,berlaku_selesai,jadwal_snapshot,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),input.pplUserId,r.guru_id,input.jenis==='KBM'?r.id:null,input.jenis==='PIKET'?r.id:null,input.mulai,input.selesai,input.jenis==='KBM'?JSON.stringify(String(r.snapshot||'').split(',').filter(Boolean).map((v:string)=>{const [hari,jamKe]=v.split(':').map(Number);return{hari,jamKe}})):JSON.stringify([{hari:r.hari,jamMulai:r.jam_mulai,jamSelesai:r.jam_selesai,shift:r.nama_shift}]),nowWIBISO())));revalidatePath('/dashboard/kelola-ppl');revalidatePath('/dashboard/agenda');revalidatePath('/dashboard/kehadiran');return{success:`${rows.length} penugasan PPL berhasil ditambahkan.`}
  }catch(error){return{error:error instanceof Error?error.message:'Gagal menambahkan penugasan.'}}
}

export async function updatePplMappingPeriod(id:string,mulai:string,selesai:string|null){try{const db=await getDB('update');assertDate(mulai,'Tanggal mulai');if(selesai)assertDate(selesai,'Tanggal selesai');if(selesai&&selesai<mulai)return{error:'Rentang tanggal tidak valid.'};const existing=await db.prepare('SELECT id FROM guru_ppl_mapping WHERE id=?').bind(id).first();if(!existing)return{error:'Mapping tidak ditemukan.'};await db.prepare('UPDATE guru_ppl_mapping SET berlaku_mulai=?,berlaku_selesai=?,updated_at=? WHERE id=?').bind(mulai,selesai,nowWIBISO(),id).run();revalidatePath('/dashboard/kelola-ppl');revalidatePath('/dashboard/agenda');revalidatePath('/dashboard/kehadiran');return{success:'Periode penugasan diperbarui.'}}catch(error){return{error:error instanceof Error?error.message:'Gagal memperbarui periode.'}}}
export async function endPplMapping(id:string,selesai=todayWIB()){const db=await getDB();const row=await db.prepare('SELECT berlaku_mulai FROM guru_ppl_mapping WHERE id=?').bind(id).first<any>();if(!row)return{error:'Mapping tidak ditemukan.'};return updatePplMappingPeriod(id,row.berlaku_mulai,selesai)}

async function buildPplAttendance(db:D1Database,input:{start:string;end:string;campusId?:string;pplUserId?:string}):Promise<PplAttendanceItem[]>{
  assertDate(input.start,'Tanggal mulai');assertDate(input.end,'Tanggal selesai');if(input.end<input.start||daysBetween(input.start,input.end)>366)throw new Error('Rentang monitoring maksimal 366 hari.');const effectiveEnd=input.end>todayWIB()?todayWIB():input.end;if(effectiveEnd<input.start)return[]
  const conditions=[`m.berlaku_mulai<=?`,`COALESCE(m.berlaku_selesai,'9999-12-31')>=?`],params:unknown[]=[effectiveEnd,input.start];if(input.campusId){conditions.push('p.kampus_id=?');params.push(input.campusId)}if(input.pplUserId){conditions.push('m.guru_ppl_id=?');params.push(input.pplUserId)}
  const [mappingRes,dates,exceptions,agendaRes,piketAgendaRes,overrideRes,schoolYears]=await Promise.all([
    db.prepare(`SELECT m.*,ppl.nama_lengkap AS ppl_nama,guru.nama_lengkap AS guru_utama_nama,p.kampus_id,kp.nama AS kampus_nama,kp.singkatan AS kampus_singkatan,pm.kelas_id,kl.tingkat,kl.nomor_kelas,kl.kelompok,kl.kbm_nonaktif_mulai,mp.nama_mapel,jp.hari AS piket_hari,ps.nama_shift,ps.jam_mulai AS piket_mulai,ps.jam_selesai AS piket_selesai,pm.tahun_ajaran_id FROM guru_ppl_mapping m JOIN "user" ppl ON ppl.id=m.guru_ppl_id JOIN "user" guru ON guru.id=m.guru_utama_id LEFT JOIN guru_ppl_profile p ON p.user_id=ppl.id LEFT JOIN guru_ppl_kampus kp ON kp.id=p.kampus_id LEFT JOIN penugasan_mengajar pm ON pm.id=m.penugasan_mengajar_id LEFT JOIN mata_pelajaran mp ON mp.id=pm.mapel_id LEFT JOIN kelas kl ON kl.id=pm.kelas_id LEFT JOIN jadwal_guru_piket jp ON jp.id=m.jadwal_piket_id LEFT JOIN pengaturan_shift_piket ps ON ps.id=jp.shift_id WHERE ${conditions.join(' AND ')}`).bind(...params).all<any>(),
    getEffectiveDatesInRange(db,input.start,effectiveEnd),getKbmExceptionsForRange(db,input.start,effectiveEnd),
    db.prepare('SELECT * FROM agenda_guru WHERE tanggal BETWEEN ? AND ?').bind(input.start,effectiveEnd).all<any>(),db.prepare('SELECT * FROM agenda_piket WHERE tanggal BETWEEN ? AND ?').bind(input.start,effectiveEnd).all<any>(),db.prepare(`SELECT o.*,u.nama_lengkap AS actor_nama FROM guru_ppl_kehadiran_override o LEFT JOIN "user" u ON u.id=o.diubah_oleh WHERE o.tanggal BETWEEN ? AND ?`).bind(input.start,effectiveEnd).all<any>(),db.prepare('SELECT id,jam_pelajaran FROM tahun_ajaran').all<any>(),
  ])
  const mappings=mappingRes.results||[],assignmentIds=[...new Set(mappings.map((m:any)=>m.penugasan_mengajar_id).filter(Boolean))],currentSchedules=assignmentIds.length?(await db.prepare(`SELECT penugasan_id,hari,jam_ke FROM jadwal_mengajar WHERE penugasan_id IN (${assignmentIds.map(()=>'?').join(',')})`).bind(...assignmentIds).all<any>()).results||[]:[],patterns=new Map((schoolYears.results||[]).map((r:any)=>[r.id,r.jam_pelajaran])),agendas=new Map((agendaRes.results||[]).map((r:any)=>[`${r.penugasan_id}:${r.tanggal}`,r])),piketAgendas=new Map((piketAgendaRes.results||[]).map((r:any)=>[`${r.user_id}:${r.jadwal_id}:${r.tanggal}`,r])),overrides=new Map((overrideRes.results||[]).map((r:any)=>[`${r.mapping_id}:${r.tanggal}`,r])),exceptionByDate=new Map<string,any[]>()
  for(const x of exceptions){if(!exceptionByDate.has(x.tanggal))exceptionByDate.set(x.tanggal,[]);exceptionByDate.get(x.tanggal)!.push(x)}const now=currentTimeWIB(),currentMinutes=now.hours*60+now.minutes,items:PplAttendanceItem[]=[]
  for(const m of mappings){let snapshot:any[]=[];try{const parsed=JSON.parse(m.jadwal_snapshot||'[]');snapshot=Array.isArray(parsed)?parsed:[]}catch{}for(const tanggal of dates){if(tanggal<m.berlaku_mulai||(m.berlaku_selesai&&tanggal>m.berlaku_selesai))continue;const hari=hariNumFromDateString(tanggal);let jams:number[]=[],jenis:'KBM'|'PIKET',label:string,jadwal:string,endMinutes:number|null=null
    if(m.penugasan_mengajar_id){jenis='KBM';if(m.kbm_nonaktif_mulai&&m.kbm_nonaktif_mulai<=tanggal)continue;label=`${m.nama_mapel} · ${formatNamaKelas(m.tingkat,m.nomor_kelas,m.kelompok)}`;jams=snapshot.filter((x:any)=>Number(x.hari)===hari).map((x:any)=>Number(x.jamKe));if(!jams.length)jams=currentSchedules.filter((x:any)=>x.penugasan_id===m.penugasan_mengajar_id&&Number(x.hari)===hari).map((x:any)=>Number(x.jam_ke));if(!jams.length)continue;jams=splitTeachingSlotsByExceptions(exceptionByDate.get(tanggal)||[],{id:m.kelas_id,tingkat:Number(m.tingkat)},jams).activeJamKe;if(!jams.length)continue;const end=slotsForDay(patterns.get(m.tahun_ajaran_id) as string,hari).find(s=>s.id===Math.max(...jams));jadwal=`Jam ${Math.min(...jams)}–${Math.max(...jams)}`;if(end?.selesai){const [h,mi]=end.selesai.split(':').map(Number);endMinutes=h*60+mi}}
    else{jenis='PIKET';const row=snapshot.find((x:any)=>Number(x.hari)===hari)||(Number(m.piket_hari)===hari?{jamMulai:m.piket_mulai,jamSelesai:m.piket_selesai,shift:m.nama_shift}:null);if(!row)continue;jams=[Number(row.jamMulai),Number(row.jamSelesai)];label=`Piket · ${row.shift||m.nama_shift}`;jadwal=`Jam ${row.jamMulai}–${row.jamSelesai}`;const raw=[...patterns.values()][0] as string|undefined,end=slotsForDay(raw,hari).find(s=>s.id===Number(row.jamSelesai));if(end?.selesai){const[h,mi]=end.selesai.split(':').map(Number);endMinutes=h*60+mi}}
    const override=overrides.get(`${m.id}:${tanggal}`) as any,agenda=(m.penugasan_mengajar_id?agendas.get(`${m.penugasan_mengajar_id}:${tanggal}`):piketAgendas.get(`${m.guru_ppl_id}:${m.jadwal_piket_id}:${tanggal}`)) as any,teacherAgenda=(!m.penugasan_mengajar_id?piketAgendas.get(`${m.guru_utama_id}:${m.jadwal_piket_id}:${tanggal}`):null) as any;if(!override&&!agenda&&!teacherAgenda&&tanggal===todayWIB()&&endMinutes!==null&&currentMinutes<endMinutes)continue;let status:PplAttendanceStatus='ALFA',waktu:string|null=null,catatan:string|null=null
    if(override){status=override.status;catatan=override.catatan||null}else if(agenda&&((jenis==='PIKET'&&agenda.user_id===m.guru_ppl_id)||(jenis==='KBM'&&agenda.guru_id===m.guru_utama_id&&agenda.ppl_user_id===m.guru_ppl_id))){if(agenda.status==='TELAT')status='TELAT';else if(['TEPAT_WAKTU','HADIR'].includes(agenda.status))status='HADIR';else if(['SAKIT','IZIN','ALFA'].includes(agenda.status))status=agenda.status;waktu=agenda.waktu_input||agenda.waktu_submit||null;catatan=agenda.catatan_admin||null}else if((jenis==='KBM'&&agenda&&agenda.guru_id===m.guru_utama_id&&!agenda.ppl_user_id&&['TEPAT_WAKTU','TELAT'].includes(agenda.status))||(jenis==='PIKET'&&teacherAgenda&&['HADIR','TELAT'].includes(teacherAgenda.status)))status='DIAMBIL_GURU'
    items.push({key:`${m.id}:${tanggal}`,mapping_id:m.id,tanggal,ppl_user_id:m.guru_ppl_id,ppl_nama:m.ppl_nama,kampus_id:m.kampus_id||null,kampus_nama:m.kampus_nama||null,kampus_singkatan:m.kampus_singkatan||null,jenis,guru_utama_id:m.guru_utama_id,guru_utama_nama:m.guru_utama_nama,tugas_label:label,jadwal_label:jadwal,jam_ke_mulai:Math.min(...jams),jam_ke_selesai:Math.max(...jams),waktu_submit:waktu,status,catatan,is_override:!!override,override_actor_name:override?.actor_nama||null})
  }}return items.sort((a,b)=>a.tanggal.localeCompare(b.tanggal)||a.ppl_nama.localeCompare(b.ppl_nama,'id-ID')||a.jam_ke_mulai-b.jam_ke_mulai)
}

export type PplAttendanceQuery = {start:string;end:string;campusId?:string;pplUserId?:string;jenis?:string;status?:string}
export async function getPplAttendance(input:PplAttendanceQuery){try{const db=await getDB();let scopedItems=await buildPplAttendance(db,input);if(input.jenis&&input.jenis!=='semua')scopedItems=scopedItems.filter(i=>i.jenis===input.jenis);const items=filterPplAttendanceStatus(scopedItems,input.status);const[school,campuses,ppl]=await Promise.all([db.prepare("SELECT key,value FROM system_settings WHERE key IN ('nama_madrasah','alamat_madrasah','logo_madrasah','school_name','school_address')").all<{key:string;value:string}>(),db.prepare('SELECT id,nama,singkatan FROM guru_ppl_kampus ORDER BY nama').all<PplCampus>(),db.prepare(`SELECT DISTINCT u.id,u.nama_lengkap,p.kampus_id,k.nama AS kampus_nama,k.singkatan AS kampus_singkatan FROM "user" u LEFT JOIN user_roles ur ON ur.user_id=u.id LEFT JOIN guru_ppl_profile p ON p.user_id=u.id LEFT JOIN guru_ppl_kampus k ON k.id=p.kampus_id WHERE u.role='guru_ppl' OR ur.role='guru_ppl' ORDER BY u.nama_lengkap`).all<any>() ]);const summaries=summarizePplAttendance(scopedItems);const summaryIds=new Set(summaries.map(row=>row.ppl_user_id));for(const row of ppl.results||[]){if(summaryIds.has(row.id)||(input.pplUserId&&input.pplUserId!==row.id)||(input.campusId&&input.campusId!==row.kampus_id))continue;summaries.push({ppl_user_id:row.id,ppl_nama:row.nama_lengkap,kampus_id:row.kampus_id||null,kampus_nama:row.kampus_nama||null,kampus_singkatan:row.kampus_singkatan||null,kewajiban:0,hadir:0,tepat_waktu:0,telat:0,sakit:0,izin:0,alfa:0,diambil_guru:0,persentase:0})}summaries.sort((a,b)=>a.ppl_nama.localeCompare(b.ppl_nama,'id-ID'));return{items,summaries,school:Object.fromEntries((school.results||[]).map(r=>[r.key,r.value])),campuses:campuses.results||[],ppl:ppl.results||[]}}catch(error){return{error:error instanceof Error?error.message:'Gagal memuat monitoring.',items:[],summaries:[],school:{},campuses:[],ppl:[]}}}

/** Rekap cetak memakai agregasi/filter yang sama persis dengan layar monitoring. */
export async function getPplAttendancePrintData(input:PplAttendanceQuery){return getPplAttendance(input)}

export async function setPplAttendanceOverride(input:{mappingId:string;tanggal:string;status:Exclude<PplAttendanceStatus,'DIAMBIL_GURU'>;catatan:string}){try{const db=await getDB('update'),actor=await getCurrentUser();if(!actor)return{error:'Unauthorized'};assertDate(input.tanggal);if(!OVERRIDE_STATUSES.has(input.status))return{error:'Status koreksi tidak valid.'};const catatan=input.catatan.trim();if(!catatan||catatan.length>500)return{error:'Catatan koreksi wajib diisi, maksimal 500 karakter.'};const obligations=await buildPplAttendance(db,{start:input.tanggal,end:input.tanggal});if(!obligations.some(item=>item.mapping_id===input.mappingId))return{error:'Tidak ada kewajiban PPL yang efektif untuk mapping pada tanggal tersebut.'};await db.prepare(`INSERT INTO guru_ppl_kehadiran_override(id,mapping_id,tanggal,status,catatan,diubah_oleh,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(mapping_id,tanggal) DO UPDATE SET status=excluded.status,catatan=excluded.catatan,diubah_oleh=excluded.diubah_oleh,updated_at=excluded.updated_at`).bind(crypto.randomUUID(),input.mappingId,input.tanggal,input.status,catatan,actor.id,nowWIBISO()).run();revalidatePath('/dashboard/kelola-ppl');return{success:'Koreksi kehadiran PPL berhasil disimpan.'}}catch(error){return{error:error instanceof Error?error.message:'Gagal menyimpan koreksi.'}}}
export async function clearPplAttendanceOverride(mappingId:string,tanggal:string){try{const db=await getDB('delete');await db.prepare('DELETE FROM guru_ppl_kehadiran_override WHERE mapping_id=? AND tanggal=?').bind(mappingId,tanggal).run();revalidatePath('/dashboard/kelola-ppl');return{success:'Koreksi dihapus.'}}catch(error){return{error:error instanceof Error?error.message:'Gagal menghapus koreksi.'}}}
