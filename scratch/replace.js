const fs = require('fs');

let content = fs.readFileSync('app/portal-ortu/page.tsx', 'utf8');

// 1. Replace imports
content = content.replace(
  /import \{ SummonResponseForm \}[\s\S]*?import \{ ScheduleTabs \} from '\.\/components\/schedule-tabs'/,
  "import { PortalOrtuClient } from './components/portal-ortu-client'"
);

// 2. Replace query
content = content.replace(
  'SELECT s.id, s.nisn, s.nama_lengkap, s.status, s.kelas_id',
  'SELECT s.id, s.nisn, s.nama_lengkap, s.status, s.foto_url, s.kelas_id'
);

// 3. Replace return block (the main component return starts around line 396)
const returnBlockStart = content.lastIndexOf('  return (');
if (returnBlockStart !== -1) {
  content = content.substring(0, returnBlockStart) + `  const data = {
    profil,
    kelasLabel,
    waliKelasRow,
    waUrl,
    pengumumanRows,
    absensiRekap,
    absensiTerbaru,
    disiplinRekap,
    disiplinRiwayat,
    semesters,
    semesterAvg,
    dsptTarget,
    dsptBayar,
    dsptDiskon,
    dsptSisa,
    sppNominal,
    sppBayar,
    sppSisa,
    transaksiTerbaru,
    notifications,
    summons,
    notes,
    jadwalObject,
  }

  return <PortalOrtuClient data={data} />
}
`;
}

fs.writeFileSync('app/portal-ortu/page.tsx', content);
