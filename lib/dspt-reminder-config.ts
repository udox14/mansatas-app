export const DSPT_REMINDER_EVENT = 'finance_dspt_reminder'
export const DSPT_PAYMENT_URL = '/portal-ortu?tab=keuangan'
export const DSPT_SEND_SETTING = 'keuangan_dspt_notifikasi_enabled'

export type DsptAudience = {
  payment: 'unpaid' | 'all'
  scope: { kind: 'all' } | { kind: 'grade'; grade: number } | { kind: 'class'; classId: string } | { kind: 'students'; studentIds: string[] }
}

export type DsptTemplate = { id: string; name: string; title: string; body: string }

export const DSPT_TEMPLATES: DsptTemplate[] = [
  {
    id: 'pengingat', name: 'Pengingat DSPT', title: 'Pengingat pembayaran DSPT',
    body: 'Silakan cek sisa tagihan DSPT dan status pembayaran di menu Keuangan Portal Orang Tua.',
  },
  {
    id: 'informasi', name: 'Informasi DSPT', title: 'Informasi pembayaran DSPT',
    body: 'Informasi tagihan, pembayaran, dan kuitansi DSPT dapat dilihat di menu Keuangan Portal Orang Tua.',
  },
]
