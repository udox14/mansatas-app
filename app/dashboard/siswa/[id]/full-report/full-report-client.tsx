'use client'

/* eslint-disable @next/next/no-img-element -- raw img keeps arbitrary R2 URLs and print clones reliable */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckSquare, Printer, RotateCcw, ShieldAlert, Square, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { printHtmlNative } from '@/lib/native-print'
import type { FullReportData, FullReportSectionId, ReportSection } from './report-data'

const SECTION_LABELS: Record<FullReportSectionId, string> = {
  identitas: 'Identitas & Riwayat',
  akademik: 'Akademik & Minat',
  kehadiran: 'Kehadiran & Izin',
  kedisiplinan: 'Kedisiplinan',
  bk_catatan: 'BK & Catatan Internal',
  program: 'Tahfidz & Ekstrakurikuler',
  keuangan: 'Keuangan',
  komunikasi: 'Komunikasi & Administrasi',
}

function display(value: unknown) {
  return value === null || value === undefined || value === '' ? '-' : String(value)
}

function dateId(value: string | null | undefined) {
  if (!value) return '-'
  const source = value.slice(0, 10)
  const parsed = new Date(`${source}T00:00:00`)
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

function address(student: Record<string, any>) {
  return [
    student.alamat_lengkap,
    student.rt ? `RT ${student.rt}` : null,
    student.rw ? `RW ${student.rw}` : null,
    student.desa_kelurahan,
    student.kecamatan,
    student.kabupaten_kota,
    student.provinsi,
    student.kode_pos,
  ].filter(Boolean).join(', ') || '-'
}

function EmptyData() {
  return <div className="report-empty">Tidak ada data pada periode yang dipilih.</div>
}

function ReportSectionView({ section, index }: { section: ReportSection; index: number }) {
  const hasRows = section.tables.some(table => table.rows.length > 0)
  return (
    <section className="report-section">
      <div className="section-heading">
        <span>{index}</span>
        <div>
          <h2>{section.title}</h2>
          <p>{section.description}</p>
        </div>
      </div>

      <div className="metric-grid">
        {section.metrics.map(metric => (
          <div className="metric-card" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            {metric.detail ? <small>{metric.detail}</small> : null}
          </div>
        ))}
      </div>

      {!hasRows ? <EmptyData /> : section.tables.map(table => table.rows.length ? (
        <div className="table-block" key={table.title}>
          <h3>{table.title}</h3>
          <div className="table-scroll">
            <table>
              <thead><tr>{table.headers.map(header => <th key={header}>{header}</th>)}</tr></thead>
              <tbody>
                {table.rows.map((row, rowIndex) => (
                  <tr key={`${table.title}-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null)}
    </section>
  )
}

function SignatureBlock({
  role,
  signer,
  locationDate,
}: {
  role: string
  signer: FullReportData['principal']
  locationDate?: string
}) {
  return (
    <div className="signature-block">
      <p>{locationDate || '\u00a0'}</p>
      <p>{role},</p>
      <div className="signature-space">
        {signer?.signature_url ? <img data-report-image src={signer.signature_url} alt={`Tanda tangan ${role}`} /> : null}
      </div>
      <strong>{signer?.nama || '........................................................'}</strong>
      <span>NIP. {signer?.nip || '........................................................'}</span>
    </div>
  )
}

export function FullReportClient({ report }: { report: FullReportData }) {
  const router = useRouter()
  const allIds = useMemo(() => report.sections.map(section => section.id), [report.sections])
  const [selected, setSelected] = useState<Set<FullReportSectionId>>(() => new Set(allIds))
  const [photoFailed, setPhotoFailed] = useState(false)
  const [printing, setPrinting] = useState(false)

  const visibleSections = report.sections.filter(section => selected.has(section.id))
  const generated = new Date(report.generatedAt).toLocaleString('id-ID', {
    dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta',
  })
  const printDate = new Date(report.generatedAt).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta',
  })

  function toggle(id: FullReportSectionId) {
    setSelected(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function changePeriod(value: string) {
    const href = value === 'all'
      ? `/dashboard/siswa/${report.student.id}/full-report`
      : `/dashboard/siswa/${report.student.id}/full-report?periode=${encodeURIComponent(value)}`
    router.replace(href)
  }

  async function waitForImages() {
    const images = Array.from(document.querySelectorAll<HTMLImageElement>('[data-report-image]'))
    await Promise.all(images.map(image => image.complete
      ? Promise.resolve()
      : new Promise<void>(resolve => {
          const timer = window.setTimeout(resolve, 3500)
          image.addEventListener('load', () => { window.clearTimeout(timer); resolve() }, { once: true })
          image.addEventListener('error', () => { window.clearTimeout(timer); resolve() }, { once: true })
        })))
  }

  async function handlePrint() {
    if (!visibleSections.length) return
    const printWindow = window.open('', '_blank')
    setPrinting(true)
    try {
      await waitForImages()
      const paper = document.querySelector<HTMLElement>('.report-paper')
      if (!paper) throw new Error('Dokumen laporan tidak ditemukan.')
      const styles = Array.from(document.querySelectorAll('style')).map(style => style.outerHTML).join('')
      const html = `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Full Report Siswa</title>${styles}</head><body><div class="full-report-shell">${paper.outerHTML}</div></body></html>`
      const nativeStarted = await printHtmlNative(html, `Full Report - ${report.student.nama_lengkap}`)
      if (nativeStarted) {
        printWindow?.close()
        return
      }
      if (!printWindow) {
        window.alert('Popup diblokir browser. Izinkan popup untuk mencetak laporan.')
        return
      }
      printWindow.document.open()
      printWindow.document.write(html)
      printWindow.document.close()
      const popupImages = Array.from(printWindow.document.images)
      await Promise.all(popupImages.map(image => image.complete
        ? Promise.resolve()
        : new Promise<void>(resolve => {
            image.onload = () => resolve()
            image.onerror = () => resolve()
          })))
      printWindow.focus()
      printWindow.print()
    } catch {
      printWindow?.close()
      window.alert('Laporan gagal disiapkan untuk dicetak. Silakan muat ulang halaman dan coba lagi.')
    } finally {
      setPrinting(false)
    }
  }

  const executive = [
    report.sections.find(section => section.id === 'akademik')?.metrics[0],
    report.sections.find(section => section.id === 'kehadiran')?.metrics[1],
    report.sections.find(section => section.id === 'kedisiplinan')?.metrics[1],
    report.sections.find(section => section.id === 'keuangan')?.metrics[0],
  ].filter(Boolean)

  return (
    <div className="full-report-shell">
      <div className="report-toolbar print-hidden">
        <div className="toolbar-top">
          <Link href={`/dashboard/siswa/${report.student.id}`} className="back-link">
            <ArrowLeft className="h-4 w-4" /> Kembali ke Buku Induk
          </Link>
          <div className="toolbar-actions">
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set(allIds))} className="gap-1.5">
              <CheckSquare className="h-4 w-4" /> Pilih Semua
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set())} className="gap-1.5">
              <Square className="h-4 w-4" /> Kosongkan
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setSelected(new Set(allIds)); changePeriod('all') }} className="gap-1.5">
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>
            <Button size="sm" disabled={printing || !visibleSections.length} onClick={handlePrint} className="gap-1.5 bg-emerald-700 hover:bg-emerald-800">
              <Printer className="h-4 w-4" /> {printing ? 'Menyiapkan...' : 'Cetak / Simpan PDF'}
            </Button>
          </div>
        </div>

        <div className="toolbar-config">
          <label>
            <span>Periode laporan</span>
            <select value={report.period?.id || 'all'} onChange={event => changePeriod(event.target.value)}>
              <option value="all">Seluruh Riwayat</option>
              {report.periods.map(period => <option key={period.id} value={period.id}>{period.label}</option>)}
            </select>
          </label>
          <fieldset>
            <legend>Bagian yang dicetak ({selected.size}/{allIds.length})</legend>
            <div className="section-options">
              {allIds.map(id => (
                <label key={id} className={selected.has(id) ? 'selected' : ''}>
                  <input type="checkbox" checked={selected.has(id)} onChange={() => toggle(id)} />
                  {SECTION_LABELS[id]}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        {!visibleSections.length ? <p className="toolbar-warning">Pilih minimal satu bagian sebelum mencetak.</p> : null}
      </div>

      <main className="report-paper">
        <header className="official-header">
          <img data-report-image src="/kopsurat.png" alt="Kop MAN 1 Tasikmalaya" />
        </header>

        <div className="confidential"><ShieldAlert /> RAHASIA — DOKUMEN INTERNAL</div>
        <div className="report-title">
          <h1>Laporan Lengkap Perkembangan Siswa</h1>
          <p>Periode: {report.period?.label || 'Seluruh Riwayat'}</p>
        </div>

        <section className="student-identity">
          <div className="student-photo">
            {report.student.foto_url && !photoFailed ? (
              <img
                data-report-image
                src={report.student.foto_url}
                alt={`Foto ${report.student.nama_lengkap}`}
                onError={() => setPhotoFailed(true)}
              />
            ) : (
              <div className="photo-placeholder">
                <UserRound />
                <strong>{display(report.student.nama_lengkap).split(/\s+/).slice(0, 2).map(part => part[0]).join('')}</strong>
                <span>Foto belum tersedia</span>
              </div>
            )}
          </div>
          <div className="identity-content">
            <h2>{display(report.student.nama_lengkap)}</h2>
            <div className="identity-grid">
              <dl><dt>NISN / NIS</dt><dd>{display(report.student.nisn)} / {display(report.student.nis_lokal)}</dd></dl>
              <dl><dt>Kelas / Status</dt><dd>{report.className} / {display(report.student.status).toUpperCase()}</dd></dl>
              <dl><dt>Tempat, Tanggal Lahir</dt><dd>{display(report.student.tempat_lahir)}, {dateId(report.student.tanggal_lahir)}</dd></dl>
              <dl><dt>Jenis Kelamin / Agama</dt><dd>{report.student.jenis_kelamin === 'P' ? 'Perempuan' : 'Laki-laki'} / {display(report.student.agama)}</dd></dl>
              <dl><dt>Orang Tua</dt><dd>{display(report.student.nama_ayah)} / {display(report.student.nama_ibu)}</dd></dl>
              <dl><dt>Kontak</dt><dd>{display(report.student.nomor_whatsapp)}</dd></dl>
              <dl className="wide"><dt>Alamat</dt><dd>{address(report.student)}</dd></dl>
            </div>
          </div>
        </section>

        <section className="executive-summary">
          <h2>Ringkasan Eksekutif</h2>
          <div className="executive-grid">
            {executive.map(metric => metric ? (
              <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></div>
            ) : null)}
          </div>
          <div className="contents-list">
            <strong>Bagian laporan:</strong>
            <ol>{visibleSections.map(section => <li key={section.id}>{section.title}</li>)}</ol>
          </div>
        </section>

        {visibleSections.map((section, index) => <ReportSectionView key={section.id} section={section} index={index + 1} />)}

        <section className="report-approval">
          <h2>Pengesahan</h2>
          <p>Laporan ini dicetak dari data terkini Sistem Informasi Manajemen MAN 1 Tasikmalaya untuk penggunaan internal yang berwenang.</p>
          <div className="signature-grid">
            <SignatureBlock role="Kepala Madrasah" signer={report.principal} />
            <SignatureBlock role="Wali Kelas" signer={report.homeroom} locationDate={`Tasikmalaya, ${printDate}`} />
          </div>
        </section>

        <footer className="report-footer">
          Dicetak melalui MANSATAS App • {generated} WIB • Data bersifat rahasia
        </footer>
      </main>

      <style jsx global>{`
        .full-report-shell{min-height:100vh;background:#e8edf2;padding:24px;color:#172033;font-family:Arial,Helvetica,sans-serif}
        .report-toolbar{max-width:1120px;margin:0 auto 20px;background:#fff;border:1px solid #d9e1e8;border-radius:16px;padding:16px;box-shadow:0 8px 30px rgba(15,23,42,.08)}
        .toolbar-top,.toolbar-actions,.toolbar-config,.section-options{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.toolbar-top{justify-content:space-between}.back-link{display:inline-flex;align-items:center;gap:6px;color:#475569;font-size:13px;font-weight:700}.toolbar-config{align-items:flex-start;margin-top:16px;padding-top:14px;border-top:1px solid #e2e8f0}.toolbar-config>label{min-width:250px}.toolbar-config span,.toolbar-config legend{display:block;margin-bottom:6px;color:#64748b;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em}.toolbar-config select{height:38px;width:100%;border:1px solid #cbd5e1;border-radius:8px;background:#fff;padding:0 10px;font-size:13px}.toolbar-config fieldset{min-width:0;flex:1}.section-options label{display:flex;align-items:center;gap:6px;border:1px solid #dbe3ea;border-radius:999px;padding:7px 10px;color:#64748b;font-size:11px;font-weight:700;cursor:pointer}.section-options label.selected{border-color:#86bfa5;background:#eef8f2;color:#12623f}.toolbar-warning{margin-top:10px;color:#b42318;font-size:12px;font-weight:700}
        .report-paper{box-sizing:border-box;width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:12mm 14mm 11mm;color:#000;line-height:1.4;box-shadow:0 12px 40px rgba(15,23,42,.13)}
        .official-header img{display:block;width:100%;height:auto}.confidential{display:flex;align-items:center;justify-content:center;gap:5px;margin:5mm auto 2mm;width:max-content;border:1px solid #000;color:#000;padding:3px 9px;font-size:8pt;font-weight:800;letter-spacing:.08em}.confidential svg{width:12px;height:12px}.report-title{text-align:center;margin:3mm 0 7mm}.report-title h1{margin:0;text-transform:uppercase;font-family:"Times New Roman",serif;font-size:17pt;letter-spacing:.03em}.report-title p{margin:2mm 0 0;font-size:9pt;color:#000}
        .student-identity{display:grid;grid-template-columns:32mm 1fr;gap:6mm;border:1px solid #000;padding:5mm;background:#fff}.student-photo{width:32mm;height:43mm;border:1px solid #000;background:#fff;overflow:hidden}.student-photo>img{width:100%;height:100%;object-fit:cover;object-position:center top}.photo-placeholder{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#000;text-align:center}.photo-placeholder svg{width:16mm;height:16mm;opacity:1}.photo-placeholder strong{font-size:14pt}.photo-placeholder span{margin-top:2mm;font-size:8pt}.identity-content h2{margin:0 0 3mm;font-family:"Times New Roman",serif;font-size:16pt;border-bottom:2px solid #000;padding-bottom:2mm}.identity-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2.3mm 5mm}.identity-grid dl{display:grid;grid-template-columns:29mm minmax(0,1fr);column-gap:2mm;margin:0;font-size:8pt}.identity-grid dl.wide{grid-column:1/-1}.identity-grid dt{overflow-wrap:anywhere;font-weight:700;color:#000}.identity-grid dd{margin:0;font-weight:600}
        .executive-summary{margin-top:7mm;border:1px solid #000;padding:4mm;break-inside:avoid}.executive-summary>h2,.report-approval>h2{margin:0 0 3mm;font-family:"Times New Roman",serif;text-transform:uppercase;font-size:12pt;color:#000}.executive-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:2mm}.executive-grid>div{border:1px solid #000;background:#fff;padding:2.5mm}.executive-grid span{display:block;font-size:8pt;color:#000;text-transform:uppercase;font-weight:700}.executive-grid strong{display:block;margin-top:1mm;font-size:10pt}.contents-list{margin-top:3mm;font-size:8pt}.contents-list ol{display:grid;grid-template-columns:1fr 1fr;margin:1.5mm 0 0;padding-left:6mm;gap:1mm 5mm}
        .report-section{margin-top:8mm;break-before:page}.section-heading{display:flex;align-items:flex-start;gap:3mm;border-bottom:2px solid #000;padding-bottom:2mm;margin-bottom:3mm}.section-heading>span{flex-shrink:0;display:grid;place-items:center;width:8mm;height:8mm;border-radius:50%;border:1px solid #000;background:#fff;color:#000;font-family:"Times New Roman",serif;font-weight:700}.section-heading h2{margin:0;font-family:"Times New Roman",serif;font-size:13pt;text-transform:uppercase}.section-heading p{margin:1mm 0 0;color:#000;font-size:8pt}.metric-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2mm;margin-bottom:4mm}.metric-card{border:1px solid #000;padding:2.5mm;break-inside:avoid}.metric-card span{display:block;color:#000;font-size:8pt;text-transform:uppercase;font-weight:700}.metric-card strong{display:block;margin-top:1mm;font-size:10pt}.metric-card small{font-size:8pt;color:#000}.table-block{margin:4mm 0;break-inside:auto}.table-block h3{margin:0 0 1.5mm;font-family:"Times New Roman",serif;font-size:10pt;color:#000}.table-scroll{overflow:visible}.table-block table{width:100%;border-collapse:collapse;font-size:8pt}.table-block thead{display:table-header-group}.table-block tr{break-inside:avoid}.table-block th,.table-block td{border:1px solid #000;padding:1.5mm;vertical-align:top;overflow-wrap:anywhere}.table-block th{background:#fff;text-align:left;font-weight:800}.table-block tbody tr:nth-child(even){background:#fff}.report-empty{border:1px dashed #000;background:#fff;padding:5mm;text-align:center;color:#000;font-size:8pt;font-style:italic}
        .report-approval{margin-top:10mm;break-before:page}.report-approval>p{font-size:8pt;line-height:1.5}.signature-grid{display:grid;grid-template-columns:1fr 1fr;gap:22mm;margin-top:8mm}.signature-block{font-size:8pt}.signature-block p{margin:0 0 1mm}.signature-space{height:22mm;position:relative}.signature-space img{display:block;max-height:22mm;max-width:45mm;object-fit:contain}.signature-block strong,.signature-block span{display:block}.signature-block strong{text-decoration:underline}.report-footer{margin-top:12mm;border-top:1px solid #000;padding-top:2mm;text-align:center;color:#000;font-size:8pt}
        .report-paper,.report-paper *{box-sizing:border-box}
        .report-paper h2,.report-paper h3,.section-heading{break-after:avoid}
        .report-paper img{filter:grayscale(1)}
        .signature-space img{filter:grayscale(1) contrast(1.4)}
        .metric-card strong,.identity-grid dd{overflow-wrap:anywhere}
        @media screen and (max-width:900px){.full-report-shell{padding:10px}.report-paper{width:100%;padding:18px}.toolbar-actions{width:100%}.toolbar-actions>*{flex:1}.student-identity{grid-template-columns:100px 1fr}.student-photo{width:100px;height:133px}.identity-grid{grid-template-columns:1fr}.identity-grid dl.wide{grid-column:auto}.executive-grid,.metric-grid{grid-template-columns:1fr 1fr}}
        @page{size:A4 portrait;margin:12mm 14mm 10mm}
        @media print{
          html,body{margin:0!important;padding:0!important;background:#fff!important}.print-hidden{display:none!important}.full-report-shell{padding:0!important;background:#fff!important}.report-paper{width:auto;min-height:0;margin:0;padding:0;box-shadow:none!important;color:#000!important;-webkit-print-color-adjust:economy;print-color-adjust:economy}.report-section{break-before:page}.table-scroll{overflow:visible!important}.official-header img{max-height:37mm;object-fit:contain}.report-footer{break-inside:avoid}
        }
      `}</style>
    </div>
  )
}
