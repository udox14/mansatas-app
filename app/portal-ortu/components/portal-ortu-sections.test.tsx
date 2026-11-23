import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PortalBiodataSection } from './portal-biodata-section'
import { PortalPsikotesSection } from './portal-psikotes-section'
import { PortalFinanceReminderDialog } from './portal-finance-reminder-dialog'
import { PortalOrtuClient } from './portal-ortu-client'

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open?: boolean; children: React.ReactNode }) => (open ? <div data-testid="dialog-mock">{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('@/components/shared/PushNotificationBanner', () => ({
  PushNotificationBanner: () => null,
}))

vi.mock('@/hooks/use-push-notifications', () => ({
  usePushNotifications: () => ({ supported: false, permission: 'default' }),
}))

function buildPortalData(overrides: Record<string, any> = {}) {
  return {
    initialPortalTab: 'beranda',
    profil: {
      id: 's1',
      nisn: '0091234567',
      nis_lokal: '131232060001240001',
      nama_lengkap: 'Ahmad Fauzan',
      jenis_kelamin: 'L',
      status: 'aktif',
      foto_url: null,
      tahun_masuk: 2025,
      minat_jurusan: 'MIPA',
      nik: '3206010101090001',
      tempat_lahir: 'Tasikmalaya',
      tanggal_lahir: '2009-01-01',
      agama: 'Islam',
      asal_sekolah: 'MTsN 1 Tasikmalaya',
      anak_ke: 1,
      jumlah_saudara: 2,
      status_anak: 'Kandung',
      tempat_tinggal: 'Pesantren Sukahideng',
      asrama: 'Al-Falah',
      kamar: 'B-03',
      alamat_lengkap: 'Kp. Sukarapih',
      rt: '01',
      rw: '02',
      desa_kelurahan: 'Sukarapih',
      kecamatan: 'Sukarame',
      kabupaten_kota: 'Kab. Tasikmalaya',
      provinsi: 'Jawa Barat',
      kode_pos: '46461',
      nomor_whatsapp: '08123456789',
      nomor_kk: '3206010101050002',
      nama_ayah: 'H. Rahmat',
      nik_ayah: '3206010101750001',
      tempat_lahir_ayah: 'Tasikmalaya',
      tanggal_lahir_ayah: '1975-05-10',
      status_ayah: 'Hidup',
      pendidikan_ayah: 'S1',
      pekerjaan_ayah: 'Wiraswasta',
      penghasilan_ayah: 'Rp 3.000.000 - Rp 5.000.000',
      nama_ibu: 'Hj. Aminah',
      nik_ibu: '3206010101780002',
      tempat_lahir_ibu: 'Garut',
      tanggal_lahir_ibu: '1978-08-17',
      status_ibu: 'Hidup',
      pendidikan_ibu: 'SMA',
      pekerjaan_ibu: 'Ibu Rumah Tangga',
      penghasilan_ibu: '-',
    },
    kelasLabel: '11-11 IPS-SOSIO',
    waliKelasRow: { nama_lengkap: 'Ustadz Ali', nomor_kontak: '628123456789' },
    waUrl: 'https://wa.me/628123456789',
    pengumumanRows: { results: [] },
    weeklyAttendanceSummary: { hadir: 5, sakit: 0, izin: 0, alfa: 0, belumLengkap: 0, perluKonfirmasi: 0 },
    todayAttendance: null,
    weekRange: { start: '2026-11-16', end: '2026-11-21' },
    attendanceYears: [],
    attendanceInitial: null,
    disciplineSummary: { totalPoin: 0, totalKasus: 0, levelLabel: 'Baik', lastDate: null, needsFollowUp: false },
    disciplineSettings: { enabled: false },
    disciplineInitial: null,
    semesters: [],
    semesterAvg: null,
    dsptTarget: 0,
    dsptBayar: 0,
    dsptDiskon: 0,
    dsptSisa: 0,
    dsptStatus: 'lunas',
    dsptIsInput: true,
    dsptIsLunas: true,
    dsptNeedsInput: false,
    paymentSubmissions: { results: [] },
    parentSuggestions: { results: [] },
    komitePaymentSettings: { accounts: [], qrisEnabled: false, qrisUrl: '', whatsapp: '628123' },
    sppNominal: 0,
    sppBayar: 0,
    sppSisa: 0,
    transaksiTerbaru: { results: [] },
    notifications: { results: [] },
    summons: { results: [] },
    notes: { results: [] },
    jadwalObject: {},
    documentationArticles: [],
    tkaSummary: null,
    psikotesData: null,
    ...overrides,
  }
}

describe('Portal Orang Tua new sections and financial shortcut', () => {
  it('renders complete biodata fields including asrama, address, and parents', () => {
    const data = buildPortalData()
    const html = renderToStaticMarkup(
      <PortalBiodataSection profil={data.profil} kelasLabel={data.kelasLabel} onGoToSaran={() => {}} />
    )
    expect(html).toContain('Biodata Siswa')
    expect(html).toContain('3206010101090001')
    expect(html).toContain('Pesantren Sukahideng')
    expect(html).toContain('Al-Falah')
    expect(html).toContain('3206010101050002')
    expect(html).toContain('H. Rahmat')
    expect(html).toContain('Hj. Aminah')
    expect(html).toContain('Ajukan Perbaikan Data')
  })

  it('renders empty state when psikotes data is null and full data when present', () => {
    const emptyHtml = renderToStaticMarkup(
      <PortalPsikotesSection psikotesData={null} siswaNama="Ahmad Fauzan" kelasLabel="11-11 IPS-SOSIO" />
    )
    expect(emptyHtml).toContain('Hasil psikotes belum tersedia')

    const fullHtml = renderToStaticMarkup(
      <PortalPsikotesSection
        siswaNama="Ahmad Fauzan"
        kelasLabel="11-11 IPS-SOSIO"
        psikotesData={{
          iq_score: 127,
          iq_klasifikasi: 'Superior',
          mbti: 'ENFJ',
          gaya_belajar: 'VISUAL',
          rekom_jurusan: 'MIPA',
          rekom_raw: 'MIA/IIS',
          riasec: 'SOCIAL, ARTISTIC, REALISTIC',
          mapel_pilihan: 'Matematika, Fisika, Kimia',
          usia_thn: 15,
          usia_bln: 8,
          bakat_ver: 65,
          bakat_num: 80,
          bakat_skl: 75,
          bakat_abs: 55,
          bakat_mek: 85,
          bakat_rr: 65,
          bakat_kkk: 65,
          minat_ps: 80,
          minat_nat: 70,
          minat_mek: 90,
          minat_bis: 30,
          minat_art: 60,
          minat_si: 60,
          minat_v: 50,
          minat_m: 30,
          minat_k: 70,
          updated_at: '2026-03-23 12:23:17',
        }}
      />
    )
    expect(fullHtml).toContain('127')
    expect(fullHtml).toContain('Superior')
    expect(fullHtml).toContain('ENFJ')
    expect(fullHtml).toContain('Protagonis')
    expect(fullHtml).toContain('VISUAL')
    expect(fullHtml).toContain('Social (Sosial)')
    expect(fullHtml).toContain('Matematika')
    expect(fullHtml).toContain('Grafik Radar Profil Bakat')
    expect(fullHtml).toContain('Grafik Radar Profil Minat')
    expect(fullHtml).toContain('Ketelitian Klerikal')
    expect(fullHtml).toContain('Kamus Istilah')
  })

  it('hides Beranda financial shortcut when remaining bill is 0 and shows neutral summary when > 0', () => {
    const zeroHtml = renderToStaticMarkup(<PortalOrtuClient data={buildPortalData()} />)
    expect(zeroHtml).not.toContain('data-tour-id="beranda-keuangan"')
    expect(zeroHtml).toContain('Biodata Siswa')
    expect(zeroHtml).toContain('Hasil Psikotes')

    const billedHtml = renderToStaticMarkup(
      <PortalOrtuClient
        data={buildPortalData({
          dsptTarget: 2000000,
          dsptBayar: 500000,
          dsptSisa: 1500000,
          dsptStatus: 'nyicil',
          dsptIsInput: true,
          dsptIsLunas: false,
          sppNominal: 300000,
          sppBayar: 0,
          sppSisa: 300000,
        })}
      />
    )
    expect(billedHtml).toContain('data-tour-id="beranda-keuangan"')
    expect(billedHtml).toContain('Informasi keuangan')
    expect(billedHtml).toContain('1.800.000')
    expect(billedHtml).toContain('DSPT Rp 1.500.000')
    expect(billedHtml).toContain('Saldo SPP Rp 300.000')
  })

  it('renders neutral financial greeting dialog only when totalSisaTagihan > 0 and includes pending verification note', () => {
    const emptyDialog = renderToStaticMarkup(
      <PortalFinanceReminderDialog
        open
        onOpenChange={() => {}}
        siswaNama="Ahmad Fauzan"
        kelasLabel="11-11 IPS-SOSIO"
        dsptRemaining={0}
        sppRemaining={0}
        totalSisaTagihan={0}
        pendingConfirmationTotal={0}
        onGoToKeuangan={() => {}}
      />
    )
    expect(emptyDialog).toBe('')

    const activeDialog = renderToStaticMarkup(
      <PortalFinanceReminderDialog
        open
        onOpenChange={() => {}}
        siswaNama="Ahmad Fauzan"
        kelasLabel="11-11 IPS-SOSIO"
        dsptRemaining={1500000}
        sppRemaining={300000}
        totalSisaTagihan={1800000}
        pendingConfirmationTotal={500000}
        onGoToKeuangan={() => {}}
      />
    )
    expect(activeDialog).toContain('Informasi Administrasi Keuangan')
    expect(activeDialog).toContain('1.800.000')
    expect(activeDialog).toContain('Sisa DSPT')
    expect(activeDialog).toContain('Saldo Awal SPP')
    expect(activeDialog).toContain('500.000')
    expect(activeDialog).toContain('sedang dalam proses pengecekan oleh bendahara komite')
    expect(activeDialog).toContain('Buka Menu Keuangan')
  })

  it('shows immediate Beranda/Biodata/Keuangan balances and skeletons for unloaded lazy tabs', () => {
    const leanLoaded = ['beranda', 'biodata', 'notifications', 'account']

    const biodataHtml = renderToStaticMarkup(
      <PortalOrtuClient
        data={buildPortalData({
          initialPortalTab: 'biodata',
          loadedTabs: leanLoaded,
        })}
      />
    )
    expect(biodataHtml).toContain('Biodata Siswa')
    expect(biodataHtml).toContain('Pesantren Sukahideng')

    const kehadiranSkeletonHtml = renderToStaticMarkup(
      <PortalOrtuClient
        data={buildPortalData({
          initialPortalTab: 'kehadiran',
          loadedTabs: leanLoaded,
        })}
      />
    )
    expect(kehadiranSkeletonHtml).toContain('Memuat data kehadiran...')
    expect(kehadiranSkeletonHtml).not.toContain('Tingkat kehadiran')

    const keuanganPartialHtml = renderToStaticMarkup(
      <PortalOrtuClient
        data={buildPortalData({
          initialPortalTab: 'keuangan',
          loadedTabs: leanLoaded,
          dsptTarget: 2000000,
          dsptBayar: 500000,
          dsptSisa: 1500000,
          dsptStatus: 'nyicil',
          dsptIsInput: true,
          dsptIsLunas: false,
        })}
      />
    )
    expect(keuanganPartialHtml).toContain('1.500.000')
    expect(keuanganPartialHtml).toContain('Memuat data...')
    expect(keuanganPartialHtml).not.toContain('Belum ada pengajuan pembayaran.')

    const psikotesSkeletonHtml = renderToStaticMarkup(
      <PortalOrtuClient
        data={buildPortalData({
          initialPortalTab: 'psikotes',
          loadedTabs: leanLoaded,
        })}
      />
    )
    expect(psikotesSkeletonHtml).toContain('Memuat hasil psikotes...')
  })
})
