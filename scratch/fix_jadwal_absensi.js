const fs = require('fs');

let content = fs.readFileSync('app/portal-ortu/page.tsx', 'utf8');

// 1. Add today's attendance query before jamMap
content = content.replace(
  'const jamMap = parseJamPelajaran(taAktif?.jam_pelajaran)',
  `const todayRaw = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
  const todayDayMap = new Date(todayRaw).getDay()
  const todayDay = todayDayMap === 0 ? 7 : todayDayMap

  const todayAbsensiRows = await db.prepare(\`
    SELECT penugasan_id, status, catatan
    FROM absensi_siswa
    WHERE siswa_id = ? AND tanggal = ?
  \`).bind(siswaId, todayRaw).all()
  
  const todayAbsensiMap = new Map()
  for (const row of todayAbsensiRows.results || []) {
    todayAbsensiMap.set(row.penugasan_id, { status: row.status, catatan: row.catatan })
  }

  const jamMap = parseJamPelajaran(taAktif?.jam_pelajaran)`
);

// 2. Add penugasan_id to jadwal query
content = content.replace(
  'SELECT jm.hari, jm.jam_ke, mp.nama_mapel, u.nama_lengkap AS guru_nama',
  'SELECT jm.hari, jm.jam_ke, mp.nama_mapel, u.nama_lengkap AS guru_nama, pm.id AS penugasan_id'
);

// 3. Attach absensi info to the mapped jadwal
content = content.replace(
  /jadwalByDay\.get\(hari\)\!\.push\(\{[\s\S]*?\}\)/,
  `let absensi = null
    if (hari === todayDay) {
      const absRecord = todayAbsensiMap.get(row.penugasan_id)
      if (absRecord) {
        absensi = absRecord
      } else {
        absensi = { status: 'HADIR', catatan: null }
      }
    }

    jadwalByDay.get(hari)!.push({
      jam_ke: row.jam_ke,
      waktu: slot ? \`\${slot.mulai} - \${slot.selesai}\` : '-',
      mapel: row.nama_mapel,
      guru: row.guru_nama || '-',
      absensi,
      isToday: hari === todayDay
    })`
);

fs.writeFileSync('app/portal-ortu/page.tsx', content);
