'use client'

import { motion } from 'framer-motion'
import { ChatText, IdentificationCard, MapPin, User, Users } from '@phosphor-icons/react'
import { AvatarSiswa } from '@/components/ui/avatar-siswa'
import { formatTanggalIndoSafe } from '@/lib/time'
import { PortalPageHeader, StandardCard } from './portal-ui'

function BiodataField({
  label,
  value,
  mono = false,
  className = '',
}: {
  label: string
  value: string | number | null | undefined
  mono?: boolean
  className?: string
}) {
  const displayValue = value !== null && value !== undefined && String(value).trim() !== ''
    ? String(value)
    : '-'

  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#6B6B63]">{label}</dt>
      <dd className={`mt-0.5 break-words text-sm font-semibold leading-snug text-[#1A1A18] ${mono ? 'tabular-nums' : ''}`}>
        {displayValue}
      </dd>
    </div>
  )
}

function formatBirthPlaceDate(place: string | null | undefined, date: string | null | undefined) {
  const safePlace = place && String(place).trim() ? String(place).trim() : null
  const formattedDate = date ? formatTanggalIndoSafe(date, '-') : '-'
  if (!safePlace && formattedDate === '-') return '-'
  if (!safePlace) return formattedDate
  if (formattedDate === '-') return safePlace
  return `${safePlace}, ${formattedDate}`
}

export function PortalBiodataSection({
  profil,
  kelasLabel,
  onGoToSaran,
}: {
  profil: any
  kelasLabel: string
  onGoToSaran: () => void
}) {
  const initialLetter = String(profil?.nama_lengkap || 'S').slice(0, 1)
  const isPesantren = Boolean(profil?.tempat_tinggal && profil.tempat_tinggal !== 'Non-Pesantren')
  const statusLabel = profil?.status === 'aktif'
    ? 'Aktif'
    : profil?.status === 'lulus'
      ? 'Lulus'
      : profil?.status === 'keluar'
        ? 'Keluar'
        : (profil?.status || '-')

  return (
    <motion.div
      key="biodata"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="portal-tab-panel space-y-5"
    >
      <PortalPageHeader
        title="Biodata Siswa"
        description="Data lengkap identitas siswa, alamat tempat tinggal, serta keterangan keluarga dan orang tua yang tercatat di madrasah."
        Icon={IdentificationCard}
      />

      {/* Ringkasan Identitas */}
      <section
        data-tour-id="biodata-summary"
        className="overflow-hidden rounded-2xl border border-[#D8D4CC] bg-[#F2F0EC] p-4 sm:p-5"
      >
        <div className="flex items-center gap-4">
          <div className="portal-student-photo h-20 w-16 shrink-0 overflow-hidden rounded-xl border border-[#D8D4CC] bg-[#E8E5E0] sm:h-24 sm:w-[72px]">
            <AvatarSiswa
              fotoUrl={profil?.foto_url}
              nama={profil?.nama_lengkap || initialLetter}
              size="full"
              className="h-full w-full rounded-none border-0 bg-[#E8E5E0] text-[#6B6B63]"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#EEF7F1] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#246142]">
                {statusLabel}
              </span>
              {profil?.tahun_masuk && (
                <span className="rounded-full border border-[#D8D4CC] bg-white px-2.5 py-0.5 text-[10px] font-semibold text-[#6B6B63]">
                  Angkatan {profil.tahun_masuk}
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold leading-snug text-[#1A1A18] sm:text-xl">
              {profil?.nama_lengkap || '-'}
            </h2>
            <p className="text-xs font-medium text-[#6B6B63]">
              Kelas {kelasLabel} · NISN <span className="font-semibold tabular-nums text-[#1A1A18]">{profil?.nisn || '-'}</span>
              {profil?.nis_lokal ? <> · NIS Lokal <span className="font-semibold tabular-nums text-[#1A1A18]">{profil.nis_lokal}</span></> : null}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Data Pribadi */}
        <StandardCard data-tour-id="biodata-personal" className="space-y-4">
          <div className="flex items-center gap-2.5 border-b border-[#D8D4CC] pb-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#FFF1EF] text-[#C2522D]">
              <User className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1A1A18]">Data Pribadi Siswa</h2>
              <p className="text-xs text-[#6B6B63]">Identitas kependudukan dan riwayat masuk madrasah</p>
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <BiodataField label="Nama Lengkap" value={profil?.nama_lengkap} className="sm:col-span-2" />
            <BiodataField label="NISN" value={profil?.nisn} mono />
            <BiodataField label="NIS Lokal" value={profil?.nis_lokal} mono />
            <BiodataField label="NIK" value={profil?.nik} mono className="sm:col-span-2" />
            <BiodataField
              label="Tempat, Tanggal Lahir"
              value={formatBirthPlaceDate(profil?.tempat_lahir, profil?.tanggal_lahir)}
              className="sm:col-span-2"
            />
            <BiodataField
              label="Jenis Kelamin"
              value={profil?.jenis_kelamin === 'L' ? 'Laki-laki' : profil?.jenis_kelamin === 'P' ? 'Perempuan' : profil?.jenis_kelamin}
            />
            <BiodataField label="Agama" value={profil?.agama || 'Islam'} />
            <BiodataField label="Asal Sekolah" value={profil?.asal_sekolah} className="sm:col-span-2" />
            <BiodataField label="Tahun Masuk" value={profil?.tahun_masuk ? `Tahun ${profil.tahun_masuk}` : '-'} />
            <BiodataField label="Minat Jurusan" value={profil?.minat_jurusan} />
            <BiodataField label="Anak Ke" value={profil?.anak_ke ? `Ke-${profil.anak_ke}` : '-'} />
            <BiodataField label="Jumlah Saudara" value={profil?.jumlah_saudara ? `${profil.jumlah_saudara} bersaudara` : '-'} />
            <BiodataField label="Status dalam Keluarga" value={profil?.status_anak} className="sm:col-span-2" />
          </dl>
        </StandardCard>

        {/* Domisili & Alamat */}
        <StandardCard data-tour-id="biodata-domisili" className="space-y-4">
          <div className="flex items-center gap-2.5 border-b border-[#D8D4CC] pb-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#EEF7F1] text-[#246142]">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1A1A18]">Domisili &amp; Alamat</h2>
              <p className="text-xs text-[#6B6B63]">Tempat tinggal saat ini dan kontak yang tercatat</p>
            </div>
          </div>

          <div className="rounded-xl border border-[#D8D4CC] bg-[#FAF9F7] p-3.5 space-y-3">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <BiodataField label="Status Tempat Tinggal" value={profil?.tempat_tinggal} className="sm:col-span-2" />
              {isPesantren && (
                <>
                  <BiodataField label="Asrama" value={profil?.asrama} />
                  <BiodataField label="Kamar" value={profil?.kamar} />
                </>
              )}
            </dl>
          </div>

          <dl className="grid grid-cols-2 gap-3.5">
            <BiodataField label="Alamat Lengkap" value={profil?.alamat_lengkap} className="col-span-2" />
            <BiodataField label="RT" value={profil?.rt} mono />
            <BiodataField label="RW" value={profil?.rw} mono />
            <BiodataField label="Desa / Kelurahan" value={profil?.desa_kelurahan} />
            <BiodataField label="Kecamatan" value={profil?.kecamatan} />
            <BiodataField label="Kabupaten / Kota" value={profil?.kabupaten_kota} />
            <BiodataField label="Provinsi" value={profil?.provinsi} />
            <BiodataField label="Kode Pos" value={profil?.kode_pos} mono />
            <BiodataField label="No. WhatsApp" value={profil?.nomor_whatsapp} mono />
          </dl>
        </StandardCard>

        {/* Data Keluarga & Orang Tua */}
        <StandardCard data-tour-id="biodata-orangtua" className="space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2.5 border-b border-[#D8D4CC] pb-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#F2F0EC] text-[#1A1A18]">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1A1A18]">Data Keluarga &amp; Orang Tua</h2>
              <p className="text-xs text-[#6B6B63]">Nomor Kartu Keluarga serta biodata ayah dan ibu kandung/wali</p>
            </div>
          </div>

          <div className="rounded-xl border border-[#D8D4CC] bg-[#FAF9F7] p-3.5">
            <dl>
              <BiodataField label="Nomor Kartu Keluarga (KK)" value={profil?.nomor_kk} mono />
            </dl>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Data Ayah */}
            <div className="rounded-xl border border-[#D8D4CC] bg-[#FAF9F7] p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-2 border-b border-[#D8D4CC] pb-2.5">
                <h3 className="text-sm font-bold text-[#1A1A18]">Data Ayah</h3>
                {profil?.status_ayah && (
                  <span className="rounded-full border border-[#D8D4CC] bg-white px-2.5 py-0.5 text-[10px] font-bold text-[#6B6B63]">
                    {profil.status_ayah}
                  </span>
                )}
              </div>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <BiodataField label="Nama Ayah" value={profil?.nama_ayah} className="sm:col-span-2" />
                <BiodataField label="NIK Ayah" value={profil?.nik_ayah} mono className="sm:col-span-2" />
                <BiodataField
                  label="Tempat, Tanggal Lahir"
                  value={formatBirthPlaceDate(profil?.tempat_lahir_ayah, profil?.tanggal_lahir_ayah)}
                  className="sm:col-span-2"
                />
                <BiodataField label="Pendidikan Terakhir" value={profil?.pendidikan_ayah} />
                <BiodataField label="Pekerjaan" value={profil?.pekerjaan_ayah} />
                <BiodataField label="Penghasilan" value={profil?.penghasilan_ayah} className="sm:col-span-2" />
              </dl>
            </div>

            {/* Data Ibu */}
            <div className="rounded-xl border border-[#D8D4CC] bg-[#FAF9F7] p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-2 border-b border-[#D8D4CC] pb-2.5">
                <h3 className="text-sm font-bold text-[#1A1A18]">Data Ibu</h3>
                {profil?.status_ibu && (
                  <span className="rounded-full border border-[#D8D4CC] bg-white px-2.5 py-0.5 text-[10px] font-bold text-[#6B6B63]">
                    {profil.status_ibu}
                  </span>
                )}
              </div>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <BiodataField label="Nama Ibu" value={profil?.nama_ibu} className="sm:col-span-2" />
                <BiodataField label="NIK Ibu" value={profil?.nik_ibu} mono className="sm:col-span-2" />
                <BiodataField
                  label="Tempat, Tanggal Lahir"
                  value={formatBirthPlaceDate(profil?.tempat_lahir_ibu, profil?.tanggal_lahir_ibu)}
                  className="sm:col-span-2"
                />
                <BiodataField label="Pendidikan Terakhir" value={profil?.pendidikan_ibu} />
                <BiodataField label="Pekerjaan" value={profil?.pekerjaan_ibu} />
                <BiodataField label="Penghasilan" value={profil?.penghasilan_ibu} className="sm:col-span-2" />
              </dl>
            </div>
          </div>
        </StandardCard>
      </div>

      <StandardCard className="flex flex-col gap-3 bg-[#F2F0EC] p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-[#6B6B63]">
          Jika terdapat data biodata yang perlu diperbaiki atau diperbarui, Bapak/Ibu dapat menyampaikannya melalui Kotak Saran atau menghubungi staf Tata Usaha.
        </p>
        <button
          type="button"
          onClick={onGoToSaran}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#D8D4CC] bg-white px-4 text-xs font-bold text-[#1A1A18] transition-colors hover:bg-[#FAF9F7]"
        >
          <ChatText className="h-4 w-4 text-[#C2522D]" />
          Ajukan Perbaikan Data
        </button>
      </StandardCard>
    </motion.div>
  )
}
