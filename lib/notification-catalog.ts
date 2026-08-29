export type NotificationChannel = 'fcm' | 'webpush' | 'in_app'

export type NotificationTargetKind =
  | 'staff_role'
  | 'staff_all'
  | 'staff_users'
  | 'parent_student'
  | 'parent_students'
  | 'parent_class'
  | 'parent_grade'
  | 'parents_all'

export type NotificationTargetConfig = {
  kind: NotificationTargetKind
  value?: string | number | null
  ids?: string[]
}

export type NotificationReminderConfig = {
  enabled: boolean
  leadMinutes: number
  frequencyMinutes: number
  daysBefore?: number
  windowStart?: string
  windowEnd?: string
}

export type NotificationEventDefinition = {
  key: string
  label: string
  description: string
  group: 'keuangan' | 'orang_tua' | 'kesiswaan' | 'akademik' | 'agenda' | 'administrasi'
  defaultEnabled: boolean
  defaultTitle: string
  defaultBody: string
  defaultUrl: string
  defaultChannels: NotificationChannel[]
  defaultTarget: NotificationTargetConfig
  defaultLevel: 'info' | 'warning' | 'critical'
  placeholders: string[]
  reminder: NotificationReminderConfig
}

const staffChannels: NotificationChannel[] = ['fcm', 'webpush']
const parentChannels: NotificationChannel[] = ['fcm', 'in_app']

function staffRole(role: string): NotificationTargetConfig {
  return { kind: 'staff_role', value: role }
}

function studentParent(): NotificationTargetConfig {
  return { kind: 'parent_student' }
}

const noReminder: NotificationReminderConfig = {
  enabled: false,
  leadMinutes: 60,
  frequencyMinutes: 1440,
}

const defaultReminder: NotificationReminderConfig = {
  enabled: false,
  leadMinutes: 60,
  frequencyMinutes: 1440,
  daysBefore: 0,
  windowStart: '06:00',
  windowEnd: '20:00',
}

export const NOTIFICATION_EVENT_DEFINITIONS: NotificationEventDefinition[] = [
  {
    key: 'finance_payment_proof_uploaded',
    label: 'Bukti pembayaran diupload',
    description: 'Memberi tahu petugas keuangan bahwa bukti pembayaran menunggu pemeriksaan.',
    group: 'keuangan',
    defaultEnabled: true,
    defaultTitle: 'Bukti pembayaran perlu diperiksa',
    defaultBody: 'Bukti pembayaran DSPT {nama_siswa} sebesar {nominal} sudah diupload dan menunggu pemeriksaan.',
    defaultUrl: '/dashboard/keuangan/dspt',
    defaultChannels: staffChannels,
    defaultTarget: staffRole('bendahara_komite'),
    defaultLevel: 'info',
    placeholders: ['nama_siswa', 'kelas', 'nominal', 'tanggal', 'metode_bayar'],
    reminder: noReminder,
  },
  {
    key: 'finance_payment_confirmed',
    label: 'Pembayaran dikonfirmasi',
    description: 'Memberi tahu orang tua bahwa pembayaran sudah diverifikasi.',
    group: 'keuangan',
    defaultEnabled: true,
    defaultTitle: 'Pembayaran berhasil dikonfirmasi',
    defaultBody: 'Pembayaran DSPT {nama_siswa} sebesar {nominal} telah dikonfirmasi. Kuitansi {nomor_kuitansi} tersedia.',
    defaultUrl: '/portal-ortu',
    defaultChannels: parentChannels,
    defaultTarget: studentParent(),
    defaultLevel: 'info',
    placeholders: ['nama_siswa', 'kelas', 'nominal', 'nomor_kuitansi', 'tanggal'],
    reminder: noReminder,
  },
  {
    key: 'finance_payment_rejected',
    label: 'Bukti pembayaran ditolak',
    description: 'Memberi tahu orang tua bahwa bukti pembayaran perlu diperbaiki.',
    group: 'keuangan',
    defaultEnabled: true,
    defaultTitle: 'Bukti pembayaran perlu diperbaiki',
    defaultBody: 'Bukti pembayaran DSPT {nama_siswa} ditolak. Alasan: {alasan}. Silakan upload ulang bukti yang benar.',
    defaultUrl: '/portal-ortu',
    defaultChannels: parentChannels,
    defaultTarget: studentParent(),
    defaultLevel: 'warning',
    placeholders: ['nama_siswa', 'kelas', 'nominal', 'alasan', 'tanggal'],
    reminder: noReminder,
  },
  {
    key: 'parent_announcement_published',
    label: 'Pengumuman orang tua dipublish',
    description: 'Mengirim pengumuman sekolah kepada orang tua sesuai target.',
    group: 'orang_tua',
    defaultEnabled: true,
    defaultTitle: 'Pengumuman sekolah baru',
    defaultBody: '{judul}: {isi_pengumuman}',
    defaultUrl: '/portal-ortu',
    defaultChannels: parentChannels,
    defaultTarget: { kind: 'parent_students' },
    defaultLevel: 'info',
    placeholders: ['judul', 'isi_pengumuman', 'tanggal'],
    reminder: noReminder,
  },
  {
    key: 'permission_exit_created',
    label: 'Izin keluar kompleks dicatat',
    description: 'Memberi tahu orang tua ketika siswa tercatat keluar kompleks.',
    group: 'kesiswaan',
    defaultEnabled: true,
    defaultTitle: 'Izin keluar kompleks',
    defaultBody: 'Ananda {nama_siswa} tercatat keluar kompleks pada {tanggal} pukul {waktu}. Keterangan: {keterangan}.',
    defaultUrl: '/portal-ortu',
    defaultChannels: parentChannels,
    defaultTarget: studentParent(),
    defaultLevel: 'info',
    placeholders: ['nama_siswa', 'kelas', 'tanggal', 'waktu', 'keterangan'],
    reminder: noReminder,
  },
  {
    key: 'permission_exit_returned',
    label: 'Siswa sudah kembali',
    description: 'Memberi tahu orang tua ketika status izin keluar berubah menjadi sudah kembali.',
    group: 'kesiswaan',
    defaultEnabled: true,
    defaultTitle: 'Siswa sudah kembali',
    defaultBody: 'Ananda {nama_siswa} sudah tercatat kembali ke kompleks pada {tanggal} pukul {waktu}.',
    defaultUrl: '/portal-ortu',
    defaultChannels: parentChannels,
    defaultTarget: studentParent(),
    defaultLevel: 'info',
    placeholders: ['nama_siswa', 'kelas', 'tanggal', 'waktu'],
    reminder: noReminder,
  },
  {
    key: 'attendance_parent_alert',
    label: 'Laporan awal ALFA oleh guru',
    description: 'Memberi tahu orang tua sekali saat seorang guru pertama kali mencatat ALFA; status harian belum final.',
    group: 'orang_tua',
    defaultEnabled: true,
    defaultTitle: 'Laporan awal kehadiran',
    defaultBody: 'Ananda {nama_siswa} tercatat ALFA oleh guru pada {tanggal}. Rekap kehadiran harian masih diproses; silakan buka Portal Orang Tua untuk rincian.',
    defaultUrl: '/portal-ortu',
    defaultChannels: parentChannels,
    defaultTarget: { kind: 'parent_students' },
    defaultLevel: 'warning',
    placeholders: ['nama_siswa', 'kelas', 'status_kehadiran', 'tanggal'],
    reminder: noReminder,
  },
  {
    key: 'attendance_daily_final',
    label: 'Rekap absensi harian selesai',
    description: 'Memberi tahu orang tua yang telah menerima laporan awal ALFA bahwa status kehadiran harian sudah final.',
    group: 'orang_tua',
    defaultEnabled: true,
    defaultTitle: 'Rekap kehadiran harian selesai',
    defaultBody: 'Rekap kehadiran Ananda {nama_siswa} pada {tanggal} telah selesai. Status akhir: {status_kehadiran}.',
    defaultUrl: '/portal-ortu',
    defaultChannels: parentChannels,
    defaultTarget: { kind: 'parent_students' },
    defaultLevel: 'info',
    placeholders: ['nama_siswa', 'kelas', 'status_kehadiran', 'tanggal'],
    reminder: noReminder,
  },
  {
    key: 'discipline_violation_created',
    label: 'Pelanggaran siswa baru',
    description: 'Opsional: memberi tahu orang tua ketika pelanggaran baru dicatat.',
    group: 'kesiswaan',
    defaultEnabled: false,
    defaultTitle: 'Catatan kedisiplinan siswa',
    defaultBody: 'Terdapat catatan kedisiplinan untuk Ananda {nama_siswa}: {nama_pelanggaran}. Mohon koordinasi dengan wali kelas bila diperlukan.',
    defaultUrl: '/portal-ortu',
    defaultChannels: parentChannels,
    defaultTarget: studentParent(),
    defaultLevel: 'warning',
    placeholders: ['nama_siswa', 'kelas', 'nama_pelanggaran', 'poin', 'tanggal', 'keterangan'],
    reminder: noReminder,
  },
  {
    key: 'discipline_sanction_reached',
    label: 'Level sanksi naik',
    description: 'Memberi tahu orang tua ketika akumulasi poin mencapai level sanksi baru.',
    group: 'kesiswaan',
    defaultEnabled: true,
    defaultTitle: 'Level kedisiplinan Ananda berubah',
    defaultBody: 'Ananda {nama_siswa} mencapai level {level_sanksi} dengan akumulasi {total_poin} poin. Mohon koordinasi dengan wali kelas.',
    defaultUrl: '/portal-ortu',
    defaultChannels: parentChannels,
    defaultTarget: studentParent(),
    defaultLevel: 'critical',
    placeholders: ['nama_siswa', 'kelas', 'level_sanksi', 'total_poin', 'tanggal'],
    reminder: noReminder,
  },
  {
    key: 'warning_letter_issued',
    label: 'Surat peringatan diterbitkan',
    description: 'Memberi tahu orang tua bahwa surat peringatan sudah diterbitkan.',
    group: 'kesiswaan',
    defaultEnabled: true,
    defaultTitle: 'Surat peringatan diterbitkan',
    defaultBody: 'Surat peringatan {level_sp} untuk Ananda {nama_siswa} telah diterbitkan. Nomor surat: {nomor_surat}.',
    defaultUrl: '/portal-ortu',
    defaultChannels: parentChannels,
    defaultTarget: studentParent(),
    defaultLevel: 'critical',
    placeholders: ['nama_siswa', 'kelas', 'level_sp', 'nomor_surat', 'alasan', 'tanggal'],
    reminder: noReminder,
  },
  {
    key: 'parent_summon_created',
    label: 'Pemanggilan orang tua dibuat',
    description: 'Memberi tahu orang tua tentang pemanggilan dari wali kelas/BK.',
    group: 'orang_tua',
    defaultEnabled: true,
    defaultTitle: 'Pemanggilan Orang Tua',
    defaultBody: '{alasan} untuk Ananda {nama_siswa}. {catatan} Jadwal: {tanggal} {waktu} di {tempat}.',
    defaultUrl: '/portal-ortu',
    defaultChannels: parentChannels,
    defaultTarget: studentParent(),
    defaultLevel: 'critical',
    placeholders: ['nama_siswa', 'kelas', 'alasan', 'catatan', 'tanggal', 'waktu', 'tempat'],
    reminder: noReminder,
  },
  {
    key: 'parent_summon_cancelled',
    label: 'Pemanggilan orang tua dibatalkan',
    description: 'Memberi tahu orang tua bahwa pemanggilan terakhir dibatalkan.',
    group: 'orang_tua',
    defaultEnabled: true,
    defaultTitle: 'Pemanggilan Dibatalkan',
    defaultBody: 'Pemanggilan orang tua untuk Ananda {nama_siswa} dibatalkan. Catatan: {catatan}.',
    defaultUrl: '/portal-ortu',
    defaultChannels: parentChannels,
    defaultTarget: studentParent(),
    defaultLevel: 'info',
    placeholders: ['nama_siswa', 'kelas', 'catatan', 'tanggal'],
    reminder: noReminder,
  },
  {
    key: 'bk_parent_followup',
    label: 'Tindak lanjut BK melibatkan orang tua',
    description: 'Memberi tahu orang tua ketika tindak lanjut BK memerlukan kolaborasi atau pemanggilan.',
    group: 'orang_tua',
    defaultEnabled: true,
    defaultTitle: 'Tindak lanjut BK',
    defaultBody: 'Ada tindak lanjut BK untuk Ananda {nama_siswa}: {tindak_lanjut}. {catatan}.',
    defaultUrl: '/portal-ortu',
    defaultChannels: parentChannels,
    defaultTarget: studentParent(),
    defaultLevel: 'info',
    placeholders: ['nama_siswa', 'kelas', 'tindak_lanjut', 'catatan', 'tanggal'],
    reminder: noReminder,
  },
  {
    key: 'schedule_changed',
    label: 'Perubahan jadwal mengajar',
    description: 'Memberi tahu guru terdampak ketika jadwal mengajar berubah.',
    group: 'akademik',
    defaultEnabled: true,
    defaultTitle: 'Jadwal mengajar berubah',
    defaultBody: 'Jadwal mengajar Anda berubah. {perubahan} Silakan periksa jadwal akademik.',
    defaultUrl: '/dashboard/akademik',
    defaultChannels: staffChannels,
    defaultTarget: { kind: 'staff_users' },
    defaultLevel: 'info',
    placeholders: ['perubahan', 'kelas', 'mapel', 'hari', 'jam'],
    reminder: noReminder,
  },
  {
    key: 'meeting_invitation',
    label: 'Undangan rapat',
    description: 'Mengirim undangan rapat kepada peserta yang dipilih.',
    group: 'agenda',
    defaultEnabled: true,
    defaultTitle: 'Undangan Rapat Baru',
    defaultBody: 'Agenda: {agenda} pada {tanggal} jam {waktu} di {tempat}. Harap konfirmasi kehadiran Anda.',
    defaultUrl: '/dashboard/rapat',
    defaultChannels: staffChannels,
    defaultTarget: { kind: 'staff_users' },
    defaultLevel: 'info',
    placeholders: ['agenda', 'tanggal', 'waktu', 'tempat'],
    reminder: defaultReminder,
  },
  {
    key: 'meeting_reminder',
    label: 'Pengingat rapat',
    description: 'Mengirim ulang pengingat rapat kepada peserta yang belum merespons.',
    group: 'agenda',
    defaultEnabled: true,
    defaultTitle: 'Pengingat Undangan Rapat',
    defaultBody: 'Agenda: {agenda} pada {tanggal} jam {waktu}. Harap segera konfirmasi kehadiran Anda.',
    defaultUrl: '/dashboard/rapat',
    defaultChannels: staffChannels,
    defaultTarget: { kind: 'staff_users' },
    defaultLevel: 'info',
    placeholders: ['agenda', 'tanggal', 'waktu', 'tempat'],
    reminder: defaultReminder,
  },
  {
    key: 'assignment_delegated',
    label: 'Delegasi/tugas baru',
    description: 'Memberi tahu penerima ketika tugas baru didelegasikan.',
    group: 'agenda',
    defaultEnabled: true,
    defaultTitle: 'Tugas Baru Masuk!',
    defaultBody: 'Ada penugasan piket dari {nama_guru} ({alasan}) untuk {jumlah_sesi} sesi kelas pada tanggal {tanggal}.',
    defaultUrl: '/dashboard/penugasan',
    defaultChannels: staffChannels,
    defaultTarget: { kind: 'staff_users' },
    defaultLevel: 'info',
    placeholders: ['nama_guru', 'alasan', 'jumlah_sesi', 'tanggal'],
    reminder: defaultReminder,
  },
  {
    key: 'attendance_missing_reminder',
    label: 'Pengingat absensi belum diinput',
    description: 'Reminder configurable untuk guru atau admin ketika absensi belum lengkap.',
    group: 'agenda',
    defaultEnabled: false,
    defaultTitle: 'Absensi belum diinput',
    defaultBody: 'Absensi untuk {kelas} pada {tanggal} belum lengkap. Silakan periksa halaman kehadiran.',
    defaultUrl: '/dashboard/kehadiran',
    defaultChannels: staffChannels,
    defaultTarget: { kind: 'staff_users' },
    defaultLevel: 'warning',
    placeholders: ['kelas', 'tanggal', 'nama_guru'],
    reminder: defaultReminder,
  },
  {
    key: 'grade_available',
    label: 'Nilai tersedia',
    description: 'Memberi tahu ketika nilai yang dipilih sudah tersedia di portal.',
    group: 'akademik',
    defaultEnabled: false,
    defaultTitle: 'Nilai sudah tersedia',
    defaultBody: 'Nilai {jenis_nilai} Ananda {nama_siswa} sudah tersedia di portal orang tua.',
    defaultUrl: '/portal-ortu',
    defaultChannels: parentChannels,
    defaultTarget: { kind: 'parent_students' },
    defaultLevel: 'info',
    placeholders: ['nama_siswa', 'kelas', 'jenis_nilai', 'semester', 'tanggal'],
    reminder: noReminder,
  },
  {
    key: 'grade_incomplete_reminder',
    label: 'Nilai belum lengkap',
    description: 'Reminder configurable untuk guru/wali ketika nilai belum lengkap.',
    group: 'akademik',
    defaultEnabled: false,
    defaultTitle: 'Nilai belum lengkap',
    defaultBody: 'Nilai {jenis_nilai} untuk {kelas} belum lengkap. Silakan periksa halaman nilai.',
    defaultUrl: '/dashboard/akademik/nilai',
    defaultChannels: staffChannels,
    defaultTarget: { kind: 'staff_users' },
    defaultLevel: 'warning',
    placeholders: ['kelas', 'jenis_nilai', 'semester', 'tanggal', 'nama_guru'],
    reminder: defaultReminder,
  },
  {
    key: 'task_pending_reminder',
    label: 'Tugas belum selesai',
    description: 'Reminder configurable untuk delegasi tugas yang masih berstatus DIKIRIM.',
    group: 'agenda',
    defaultEnabled: false,
    defaultTitle: 'Tugas belum selesai',
    defaultBody: 'Tugas untuk tanggal {tanggal} masih belum selesai. Silakan periksa penugasan Anda.',
    defaultUrl: '/dashboard/penugasan',
    defaultChannels: staffChannels,
    defaultTarget: { kind: 'staff_users' },
    defaultLevel: 'warning',
    placeholders: ['tanggal', 'nama_guru', 'jumlah_sesi'],
    reminder: defaultReminder,
  },
  {
    key: 'spp_payment_reminder',
    label: 'Reminder SPP reguler',
    description: 'Disiapkan untuk pengingat SPP; nonaktif karena modul SPP reguler belum memiliki tanggal jatuh tempo aktif.',
    group: 'keuangan',
    defaultEnabled: false,
    defaultTitle: 'Pengingat pembayaran SPP',
    defaultBody: 'Pembayaran SPP untuk Ananda {nama_siswa} perlu diperhatikan. Nominal: {nominal}.',
    defaultUrl: '/portal-ortu',
    defaultChannels: parentChannels,
    defaultTarget: studentParent(),
    defaultLevel: 'warning',
    placeholders: ['nama_siswa', 'kelas', 'nominal', 'tanggal'],
    reminder: defaultReminder,
  },
  {
    key: 'document_reminder',
    label: 'Reminder dokumen administrasi',
    description: 'Reminder configurable untuk dokumen yang perlu dilengkapi atau diproses.',
    group: 'administrasi',
    defaultEnabled: false,
    defaultTitle: 'Dokumen perlu ditindaklanjuti',
    defaultBody: 'Dokumen {dokumen} perlu ditindaklanjuti. Silakan buka halaman administrasi terkait.',
    defaultUrl: '/dashboard',
    defaultChannels: staffChannels,
    defaultTarget: { kind: 'staff_role', value: 'admin_tu' },
    defaultLevel: 'info',
    placeholders: ['dokumen', 'tanggal', 'status'],
    reminder: defaultReminder,
  },
]

export const NOTIFICATION_EVENT_MAP = new Map(
  NOTIFICATION_EVENT_DEFINITIONS.map((definition) => [definition.key, definition]),
)

export function getNotificationDefinition(eventKey: string) {
  return NOTIFICATION_EVENT_MAP.get(eventKey)
}

export function defaultNotificationSettings(definition: NotificationEventDefinition) {
  return {
    event_key: definition.key,
    enabled: definition.defaultEnabled ? 1 : 0,
    title_template: definition.defaultTitle,
    body_template: definition.defaultBody,
    url_template: definition.defaultUrl,
    channels_json: JSON.stringify(definition.defaultChannels),
    target_json: JSON.stringify(definition.defaultTarget),
    reminder_json: JSON.stringify(definition.reminder),
    level: definition.defaultLevel,
  }
}
