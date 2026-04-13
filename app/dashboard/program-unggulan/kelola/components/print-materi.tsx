import React from 'react'

export const PrintLayout = React.forwardRef<HTMLDivElement, { materi: any }>(({ materi }, ref) => {
  if (!materi) return <div ref={ref} />

  let konten: any = {}
  try {
    konten = typeof materi.konten === 'string' ? JSON.parse(materi.konten) : materi.konten
  } catch (e) {}

  const HARI_NAMES = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

  const renderTahfidz = () => {
    const hari = konten.hari || {}
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', flex: 1, marginTop: '10px' }}>
        {[1, 2, 3, 4, 5, 6].map(h => (
          <div key={h} style={{ border: '2px solid #059669', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ borderBottom: '2px dashed #059669', paddingBottom: '8px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '18px', color: '#065f46' }}>{HARI_NAMES[h]}</strong>
              <span style={{ fontSize: '14px', backgroundColor: '#d1fae5', color: '#065f46', padding: '4px 10px', borderRadius: '20px', fontWeight: 'bold' }}>
                Ayat {hari[h]?.dari || '?'} - {hari[h]?.sampai || '?'}
              </span>
            </div>
            <div style={{ flex: 1, fontFamily: '"Amiri", "Traditional Arabic", serif', fontSize: '32px', textAlign: 'right', direction: 'rtl', lineHeight: '2', padding: '5px' }}>
              {hari[h]?.teks_arab || ''}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderBahasaArab = () => {
    const hari = konten.hari || {}
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', flex: 1, marginTop: '10px' }}>
        {[1, 2, 3, 4, 5, 6].map(h => {
          const list = hari[h] || []
          return (
            <div key={h} style={{ border: '2px solid #2563eb', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ borderBottom: '2px dashed #2563eb', paddingBottom: '8px', marginBottom: '8px' }}>
                <strong style={{ fontSize: '18px', color: '#1e40af' }}>{HARI_NAMES[h]}</strong>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {list.map((item: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#eff6ff', padding: '8px 12px', borderRadius: '8px' }}>
                    <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e40af' }}>{item.arti}</span>
                    <span style={{ fontSize: '28px', fontFamily: '"Amiri", "Traditional Arabic", serif', direction: 'rtl', color: '#1e3a8a' }}>{item.kata}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderBahasaInggris = () => {
    const hari = konten.hari || {}
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', flex: 1, marginTop: '10px' }}>
        {[1, 2, 3, 4, 5, 6].map(h => {
          const item = hari[h] || { vocab: [], phrasal: {} }
          const vocabs = item.vocab || []
          const phrasal = item.phrasal || {}
          return (
            <div key={h} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '4px 10px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <strong style={{ fontSize: '15px', color: '#6d28d9' }}>{HARI_NAMES[h]}</strong>
              </div>
              
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead style={{ backgroundColor: '#f2a900', color: '#000' }}>
                  <tr>
                    <th style={{ padding: '4px', border: '1px solid rgba(0,0,0,0.15)', width: '30px', textAlign: 'center' }}>No</th>
                    <th style={{ padding: '4px', border: '1px solid rgba(0,0,0,0.15)', width: '20%' }}>Word</th>
                    <th style={{ padding: '4px', border: '1px solid rgba(0,0,0,0.15)', width: '20%' }}>Phonetic Symbol</th>
                    <th style={{ padding: '4px', border: '1px solid rgba(0,0,0,0.15)', width: '15%' }}>Cara Baca</th>
                    <th style={{ padding: '4px', border: '1px solid rgba(0,0,0,0.15)', width: '15%', textAlign: 'center' }}>Part of Speech</th>
                    <th style={{ padding: '4px', border: '1px solid rgba(0,0,0,0.15)' }}>Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  {vocabs.map((v: any, i: number) => (
                     <tr key={i}>
                      <td style={{ padding: '3px 4px', border: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b' }}>{i + 1}</td>
                      <td style={{ padding: '3px 4px', border: '1px solid #e2e8f0', color: '#334155' }}>{v.word}</td>
                      <td style={{ padding: '3px 4px', border: '1px solid #e2e8f0', color: '#334155' }}>{v.phonetic}</td>
                      <td style={{ padding: '3px 4px', border: '1px solid #e2e8f0', color: '#334155' }}>{v.cara_baca}</td>
                      <td style={{ padding: '3px 4px', border: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b' }}>{v.pos}</td>
                      <td style={{ padding: '3px 4px', border: '1px solid #e2e8f0', color: '#334155' }}>{v.meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {(phrasal.verb || phrasal.arti) && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '-1px' }}>
                  <thead style={{ backgroundColor: '#f2a900', color: '#000' }}>
                    <tr>
                      <th style={{ padding: '4px', border: '1px solid rgba(0,0,0,0.15)', width: '30px' }}></th>
                      <th style={{ padding: '4px', border: '1px solid rgba(0,0,0,0.15)', width: '25%', textAlign: 'center' }}>Phrasal Verb</th>
                      <th style={{ padding: '4px', border: '1px solid rgba(0,0,0,0.15)', width: '25%', textAlign: 'center' }}>Arti</th>
                      <th style={{ padding: '4px', border: '1px solid rgba(0,0,0,0.15)', textAlign: 'center' }}>Contoh Kalimat</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '3px 4px', border: '1px solid #e2e8f0', writingMode: 'vertical-rl', transform: 'rotate(180deg)', textAlign: 'center', fontSize: '10px', fontWeight: 'bold', color: '#f2a900' }}>PHRASAL VERB</td>
                      <td style={{ padding: '3px 4px', border: '1px solid #e2e8f0', color: '#334155', textAlign: 'center' }}>{phrasal.verb}</td>
                      <td style={{ padding: '3px 4px', border: '1px solid #e2e8f0', color: '#334155', textAlign: 'center' }}>{phrasal.arti}</td>
                      <td style={{ padding: '3px 4px', border: '1px solid #e2e8f0', color: '#334155', fontStyle: 'italic' }}>{phrasal.contoh}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div ref={ref} style={{ fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#000', backgroundColor: '#fff', width: '215mm', padding: 0 }}>
      {/* 
        component is printed. The background is white. 
      */}
      <style>{`
        @media print { 
          @page { size: 215mm 330mm; margin: 0; } 
          body { -webkit-print-color-adjust: exact; margin: 0; padding: 0; background: white; width: 215mm; height: 330mm; }
          * { box-sizing: border-box; }
        }
      `}</style>
      
      {/* KOP SURAT (FULL WIDTH) */}
      <img src="/kopsurat.png" alt="Kop Surat" style={{ display: 'block', width: '100%', marginBottom: '10px' }} />
      
      <div style={{ padding: '0 15mm 15mm 15mm', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ textAlign: 'center', margin: '20px 0 15px 0' }}>
          <h2 style={{ margin: '0 0 5px 0', fontSize: '24px', fontWeight: '900', textTransform: 'uppercase' }}>
            MATERI {materi.program?.replace('_', ' ')}
          </h2>
          <p style={{ margin: 0, fontSize: '16px' }}>
            Minggu Mulai: <strong>{materi.minggu_mulai}</strong> {materi.kelas_labels ? `| Kelas: ${materi.kelas_labels}` : ''}
          </p>
          {materi.program === 'tahfidz' && konten.surat && (
            <p style={{ margin: '8px 0 0 0', fontSize: '20px', fontWeight: 'bold' }}>Surah {konten.surat} ({konten.nama_arab})</p>
          )}
        </div>

        {materi.program === 'tahfidz' && renderTahfidz()}
        {materi.program === 'bahasa_arab' && renderBahasaArab()}
        {materi.program === 'bahasa_inggris' && renderBahasaInggris()}

      </div>
    </div>
  )
})
PrintLayout.displayName = 'PrintLayout'
