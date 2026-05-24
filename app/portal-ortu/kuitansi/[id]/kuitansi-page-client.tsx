'use client'

import { Printer } from 'lucide-react'
import { KuitansiPembayarPage, type KuitansiData } from '@/app/dashboard/keuangan/components/kuitansi-print'

export function ParentReceiptPageClient({ data }: { data: KuitansiData }) {
  return (
    <main className="min-h-screen bg-slate-200 px-3 py-4 text-slate-900 print:bg-white print:p-0">
      <style dangerouslySetInnerHTML={{ __html: `
        @page { size: A4 portrait; margin: 0; }
        @media print {
          html, body { width: 210mm; margin: 0; padding: 0; background: #fff; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .no-print { display: none !important; }
          .receipt-shell { box-shadow: none !important; border-radius: 0 !important; }
        }
      ` }} />

      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div>
          <h1 className="text-sm font-bold text-slate-800">Kuitansi {data.kategori}</h1>
          <p className="text-xs text-slate-500">{data.nomorKuitansi}</p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white"
        >
          <Printer className="h-4 w-4" />
          Simpan PDF
        </button>
      </div>

      <div className="receipt-shell mx-auto max-w-[210mm] overflow-hidden rounded-sm bg-white shadow-2xl print:max-w-none">
        <KuitansiPembayarPage data={data} />
      </div>
    </main>
  )
}
