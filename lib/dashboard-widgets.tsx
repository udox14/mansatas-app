// lib/dashboard-widgets.tsx
// Registry komponen widget (SERVER-ONLY — komponen query DB).
// Hanya di-import dari server components (mis. app/dashboard/page.tsx).
// Untuk metadata yang aman di client, pakai lib/dashboard-widgets-meta.ts.
import type { WidgetProps } from './dashboard-widgets-meta'
import { RekapKehadiranGuruWidget } from '@/components/dashboard/widgets/RekapKehadiranGuruWidget'
import { KehadiranSiswaSekolahWidget } from '@/components/dashboard/widgets/KehadiranSiswaSekolahWidget'
import { TrenPelanggaranSekolahWidget } from '@/components/dashboard/widgets/TrenPelanggaranSekolahWidget'

export type { WidgetProps } from './dashboard-widgets-meta'

type WidgetComponent = (props: WidgetProps) => Promise<React.ReactElement> | React.ReactElement

export const WIDGET_COMPONENTS: Record<string, WidgetComponent> = {
  rekap_kehadiran_guru: RekapKehadiranGuruWidget,
  kehadiran_siswa_sekolah: KehadiranSiswaSekolahWidget,
  tren_pelanggaran_sekolah: TrenPelanggaranSekolahWidget,
}
