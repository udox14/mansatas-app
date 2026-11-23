'use client'

import { motion } from 'framer-motion'
import { Brain, BookOpenText, CheckCircle, Compass, GraduationCap } from '@phosphor-icons/react'
import {
  BAKAT_FIELDS,
  GAYA_BELAJAR_SCORE_FIELDS,
  MINAT_FIELDS,
  PSIKOTES_KAMUS,
  getGayaBelajarInfo,
  getMbtiInfo,
  getRiasecInfo,
} from '@/lib/psikotes-kamus'
import { formatDateWIB } from '@/lib/time'
import { PortalPageHeader, StandardCard } from './portal-ui'

function PortalRadarChart({
  data,
  labels,
  color,
  title,
}: {
  data: number[]
  labels: string[]
  color: string
  title: string
}) {
  const n = data.length
  const cx = 120
  const cy = 120
  const r = 86
  const angles = Array.from({ length: n }, (_, i) => (i * 2 * Math.PI) / n - Math.PI / 2)
  const grids = [25, 50, 75, 100]

  const point = (val: number, i: number) => {
    const clamped = Math.max(0, Math.min(100, val))
    const ratio = clamped / 100
    return [cx + r * ratio * Math.cos(angles[i]), cy + r * ratio * Math.sin(angles[i])]
  }

  const polygon = data.map((v, i) => point(v, i)).map(p => p.join(',')).join(' ')

  return (
    <svg viewBox="0 0 240 240" role="img" aria-label={title} className="w-full max-w-[230px]">
      {grids.map(g => (
        <polygon
          key={g}
          points={angles.map((_, i) => {
            const x = cx + r * (g / 100) * Math.cos(angles[i])
            const y = cy + r * (g / 100) * Math.sin(angles[i])
            return `${x},${y}`
          }).join(' ')}
          fill="none"
          stroke="#D8D4CC"
          strokeWidth="1"
        />
      ))}
      {angles.map((a, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={cx + r * Math.cos(a)}
          y2={cy + r * Math.sin(a)}
          stroke="#D8D4CC"
          strokeWidth="1"
        />
      ))}
      <polygon
        points={polygon}
        fill={color}
        fillOpacity="0.18"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {data.map((v, i) => {
        const [x, y] = point(v, i)
        return <circle key={i} cx={x} cy={y} r="3.5" fill={color} />
      })}
      {labels.map((label, i) => {
        const x = cx + (r + 16) * Math.cos(angles[i])
        const y = cy + (r + 16) * Math.sin(angles[i])
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="9.5"
            fontWeight="700"
            fill="#6B6B63"
          >
            {label}
          </text>
        )
      })}
    </svg>
  )
}

function iqBadgeClass(klasifikasi: string | null | undefined) {
  switch (klasifikasi) {
    case 'Superior':
      return 'bg-[#EEF7F1] text-[#246142] border border-[#BFD7C8]'
    case 'Di atas rata-rata':
      return 'bg-sky-100 text-sky-900 border border-sky-300'
    case 'Rata-rata':
      return 'bg-[#F2F0EC] text-[#1A1A18] border border-[#D8D4CC]'
    case 'Di bawah rata-rata':
      return 'bg-amber-100 text-amber-900 border border-amber-300'
    default:
      return 'bg-[#F2F0EC] text-[#6B6B63] border border-[#D8D4CC]'
  }
}

export function PortalPsikotesSection({
  psikotesData,
  siswaNama,
  kelasLabel,
}: {
  psikotesData: any
  siswaNama: string
  kelasLabel: string
}) {
  if (!psikotesData) {
    return (
      <motion.div
        key="psikotes"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        className="portal-tab-panel space-y-5"
      >
        <PortalPageHeader
          title="Hasil Psikotes"
          description="Ringkasan hasil asesmen psikologis, potensi bakat, minat belajar, tipe kepribadian, dan rekomendasi peminatan siswa."
          Icon={Brain}
        />

        <StandardCard className="py-10 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl border border-[#D8D4CC] bg-[#F2F0EC] text-[#C2522D]">
            <Brain className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-base font-bold text-[#1A1A18]">Hasil psikotes belum tersedia</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-[#6B6B63]">
            Data hasil asesmen psikologis untuk {siswaNama} ({kelasLabel}) belum tersedia di sistem. Silakan hubungi guru BK apabila tes sudah dilaksanakan.
          </p>
        </StandardCard>
      </motion.div>
    )
  }

  const mbtiInfo = getMbtiInfo(psikotesData.mbti)
  const gayaInfo = getGayaBelajarInfo(psikotesData.gaya_belajar)
  const riasecItems = getRiasecInfo(psikotesData.riasec)
  const mapelList = String(psikotesData.mapel_pilihan || '')
    .split(',')
    .map(m => m.trim().replace(/\.$/, ''))
    .filter(Boolean)

  const bakatScores = BAKAT_FIELDS.map(f => Number(psikotesData[f.key] ?? 0))
  const bakatLabels = BAKAT_FIELDS.map(f => f.code)

  const minatScores = MINAT_FIELDS.map(f => Number(psikotesData[f.key] ?? 0))
  const minatLabels = MINAT_FIELDS.map(f => f.code)

  const vmkScores = GAYA_BELAJAR_SCORE_FIELDS.map(f => ({
    ...f,
    value: psikotesData[f.key] !== null && psikotesData[f.key] !== undefined ? Number(psikotesData[f.key]) : null,
  })).filter(item => item.value !== null)

  const kamusCategories = [...new Set(PSIKOTES_KAMUS.map(item => item.kategori))]

  return (
    <motion.div
      key="psikotes"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="portal-tab-panel space-y-5"
    >
      <PortalPageHeader
        title="Hasil Psikotes"
        description="Hasil asesmen kecerdasan, bakat, minat karir, gaya belajar, tipe kepribadian, serta rekomendasi jurusan anak."
        Icon={Brain}
      />

      {/* Info Pelaksanaan Tes */}
      {(psikotesData.usia_thn || psikotesData.updated_at) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#D8D4CC] bg-[#F2F0EC] px-4 py-2.5 text-xs text-[#6B6B63]">
          <span>
            Peserta: <strong className="text-[#1A1A18]">{siswaNama}</strong> ({kelasLabel})
            {psikotesData.usia_thn ? ` · Usia ${psikotesData.usia_thn} tahun ${psikotesData.usia_bln ?? 0} bulan saat tes` : ''}
          </span>
          {psikotesData.updated_at && (
            <span>Diperbarui {formatDateWIB(psikotesData.updated_at)}</span>
          )}
        </div>
      )}

      {/* 4 Kartu Ringkasan Utama */}
      <div data-tour-id="psikotes-summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StandardCard className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#6B6B63]">IQ (CFIT)</p>
          <p className="mt-2 text-3xl font-black tabular-nums leading-none text-[#C2522D]">
            {psikotesData.iq_score ?? '—'}
          </p>
          {psikotesData.iq_klasifikasi && (
            <span className={`mt-2.5 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${iqBadgeClass(psikotesData.iq_klasifikasi)}`}>
              {psikotesData.iq_klasifikasi}
            </span>
          )}
        </StandardCard>

        <StandardCard className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#6B6B63]">Kepribadian MBTI</p>
          <p className="mt-2 text-3xl font-black leading-none text-[#1A1A18]">
            {psikotesData.mbti || '—'}
          </p>
          {mbtiInfo && (
            <p className="mt-2 text-xs font-semibold text-[#C2522D]">{mbtiInfo.nama}</p>
          )}
        </StandardCard>

        <StandardCard className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#6B6B63]">Gaya Belajar</p>
          <p className="mt-2 text-lg font-black leading-tight text-[#246142] sm:text-xl">
            {psikotesData.gaya_belajar || '—'}
          </p>
          {gayaInfo && (
            <p className="mt-1.5 text-xs leading-5 text-[#6B6B63]">{gayaInfo.description}</p>
          )}
        </StandardCard>

        <StandardCard className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#6B6B63]">Rekomendasi Jurusan</p>
          <p className="mt-2 text-xl font-black leading-tight text-[#1A1A18]">
            {psikotesData.rekom_jurusan || psikotesData.rekom_raw || '—'}
          </p>
          {psikotesData.rekom_raw && psikotesData.rekom_jurusan && psikotesData.rekom_raw !== psikotesData.rekom_jurusan && (
            <p className="mt-1.5 text-xs text-[#6B6B63]">Kode hasil tes: {psikotesData.rekom_raw}</p>
          )}
        </StandardCard>
      </div>

      {/* Penjelasan MBTI, RIASEC & Mapel Pilihan */}
      <div className="grid gap-4 lg:grid-cols-2">
        {mbtiInfo && (
          <StandardCard className="space-y-2.5">
            <div className="flex items-center gap-2.5 border-b border-[#D8D4CC] pb-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#FFF1EF] text-[#C2522D]">
                <CheckCircle className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#1A1A18]">Profil Kepribadian {mbtiInfo.kode} ({mbtiInfo.nama})</h2>
                <p className="text-xs text-[#6B6B63]">Gambaran karakter dan kecenderungan belajar anak</p>
              </div>
            </div>
            <p className="text-sm leading-6 text-[#1A1A18]">{mbtiInfo.deskripsi}</p>
          </StandardCard>
        )}

        {riasecItems.length > 0 && (
          <StandardCard className="space-y-3">
            <div className="flex items-center gap-2.5 border-b border-[#D8D4CC] pb-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#EEF7F1] text-[#246142]">
                <Compass className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#1A1A18]">Kematangan Karir (RIASEC)</h2>
                <p className="text-xs text-[#6B6B63]">Tiga kecenderungan lingkungan karir yang paling menonjol</p>
              </div>
            </div>
            <div className="space-y-2">
              {riasecItems.map((item, idx) => (
                <div
                  key={`${item.raw}-${idx}`}
                  className={`rounded-xl border p-3 ${
                    idx === 0
                      ? 'border-[#E6B8AA] bg-[#FFF1EF]'
                      : idx === 1
                        ? 'border-[#BFD7C8] bg-[#EEF7F1]'
                        : 'border-[#D8D4CC] bg-[#FAF9F7]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#1A1A18]">{idx + 1}. {item.label}</span>
                    {idx === 0 && (
                      <span className="rounded-full bg-[#C2522D] px-2 py-0.5 text-[10px] font-bold text-white">Utama</span>
                    )}
                  </div>
                  {item.description && (
                    <p className="mt-1 text-xs leading-5 text-[#6B6B63]">{item.description}</p>
                  )}
                </div>
              ))}
            </div>
          </StandardCard>
        )}
      </div>

      {/* Mata Pelajaran Pilihan */}
      {mapelList.length > 0 && (
        <StandardCard className="space-y-3">
          <div className="flex items-center gap-2.5 border-b border-[#D8D4CC] pb-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#F2F0EC] text-[#C2522D]">
              <GraduationCap className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1A1A18]">Mata Pelajaran Pilihan yang Disarankan</h2>
              <p className="text-xs text-[#6B6B63]">Rekomendasi mata pelajaran penguatan berdasarkan hasil tes</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {mapelList.map((mapel, i) => (
              <span
                key={`${mapel}-${i}`}
                className="rounded-lg border border-[#D8D4CC] bg-[#FAF9F7] px-3 py-1.5 text-xs font-semibold text-[#1A1A18]"
              >
                {mapel}
              </span>
            ))}
          </div>
        </StandardCard>
      )}

      {/* Profil Bakat & Profil Minat (Radar Chart + Skor Lengkap) */}
      <div data-tour-id="psikotes-charts" className="grid gap-4 lg:grid-cols-2">
        {/* Profil Bakat */}
        <StandardCard className="space-y-4">
          <div className="border-b border-[#D8D4CC] pb-3">
            <h2 className="text-sm font-bold text-[#1A1A18]">Profil Bakat (7 Aspek)</h2>
            <p className="text-xs text-[#6B6B63]">Potensi kemampuan dasar pada masing-masing aspek (skala 0–100)</p>
          </div>

          <div className="flex justify-center rounded-xl border border-[#D8D4CC] bg-[#FAF9F7] p-3">
            <PortalRadarChart
              data={bakatScores}
              labels={bakatLabels}
              color="#C2522D"
              title="Grafik Radar Profil Bakat"
            />
          </div>

          <div className="space-y-3">
            {BAKAT_FIELDS.map((field, index) => {
              const score = bakatScores[index] ?? 0
              return (
                <div key={field.key} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[#1A1A18]">
                      {field.label} <span className="font-mono text-[11px] text-[#6B6B63]">({field.code})</span>
                    </span>
                    <span className="font-black tabular-nums text-[#C2522D]">{score}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#F2F0EC]">
                    <div
                      className="h-full rounded-full bg-[#C2522D]"
                      style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-[#6B6B63]">{field.description}</p>
                </div>
              )
            })}
          </div>
        </StandardCard>

        {/* Profil Minat & Gaya Belajar V/M/K */}
        <StandardCard className="space-y-4">
          <div className="border-b border-[#D8D4CC] pb-3">
            <h2 className="text-sm font-bold text-[#1A1A18]">Profil Minat &amp; Gaya Belajar</h2>
            <p className="text-xs text-[#6B6B63]">Kecenderungan ketertarikan bidang dan modalitas belajar anak</p>
          </div>

          <div className="flex justify-center rounded-xl border border-[#D8D4CC] bg-[#FAF9F7] p-3">
            <PortalRadarChart
              data={minatScores}
              labels={minatLabels}
              color="#246142"
              title="Grafik Radar Profil Minat"
            />
          </div>

          <div className="space-y-3">
            {MINAT_FIELDS.map((field, index) => {
              const score = minatScores[index] ?? 0
              return (
                <div key={field.key} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[#1A1A18]">
                      {field.label} <span className="font-mono text-[11px] text-[#6B6B63]">({field.code})</span>
                    </span>
                    <span className="font-black tabular-nums text-[#246142]">{score}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#F2F0EC]">
                    <div
                      className="h-full rounded-full bg-[#246142]"
                      style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-[#6B6B63]">{field.description}</p>
                </div>
              )
            })}
          </div>

          {vmkScores.length > 0 && (
            <div className="rounded-xl border border-[#D8D4CC] bg-[#FAF9F7] p-3.5 space-y-2.5">
              <p className="text-xs font-bold text-[#1A1A18]">Rincian Skor Gaya Belajar (V · M · K)</p>
              <div className="grid grid-cols-3 gap-2">
                {vmkScores.map(item => (
                  <div key={item.key} className="rounded-lg border border-[#D8D4CC] bg-white p-2.5 text-center">
                    <p className="text-[10px] font-bold uppercase text-[#6B6B63]">{item.label} ({item.code})</p>
                    <p className="mt-1 text-lg font-black tabular-nums text-[#1A1A18]">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </StandardCard>
      </div>

      {/* Kamus Istilah Psikotes (Collapsible, tanpa heading di dalam <summary>) */}
      <details data-tour-id="psikotes-kamus" className="rounded-2xl border border-[#D8D4CC] bg-white p-4 text-sm text-[#6B6B63]">
        <summary className="flex cursor-pointer items-center gap-2 font-semibold text-[#1A1A18]">
          <BookOpenText className="h-4 w-4 text-[#C2522D]" />
          Kamus Istilah &amp; Cara Membaca Hasil Psikotes
        </summary>
        <div className="mt-4 space-y-4 border-t border-[#D8D4CC] pt-4">
          {kamusCategories.map(kategori => (
            <div key={kategori} className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#C2522D]">{kategori}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {PSIKOTES_KAMUS.filter(item => item.kategori === kategori).map(item => (
                  <div key={item.kode} className="rounded-xl border border-[#D8D4CC] bg-[#FAF9F7] p-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded border border-[#D8D4CC] bg-white px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#1A1A18]">
                        {item.kode.split(' ')[0]}
                      </span>
                      <span className="text-xs font-bold text-[#1A1A18]">{item.nama}</span>
                    </div>
                    <p className="mt-1.5 text-xs leading-5 text-[#6B6B63]">{item.deskripsi}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </details>
    </motion.div>
  )
}
