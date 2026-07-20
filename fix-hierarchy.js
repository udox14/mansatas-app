const fs = require('fs');

// 1. agenda-client.tsx
const file1 = 'app/dashboard/agenda/components/agenda-client.tsx';
let c1 = fs.readFileSync(file1, 'utf8');
c1 = c1.replace(
  '<span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{block.mapel_nama}</span>\n                  <span className="text-xs bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">{block.kelas_label}</span>',
  '<span className="text-base font-bold text-slate-800 dark:text-slate-100">{block.kelas_label}</span>\n                  <span className="text-xs bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full max-w-[200px] truncate">{block.mapel_nama}</span>'
);
fs.writeFileSync(file1, c1, 'utf8');

// 2. absensi-client.tsx
const file2 = 'app/dashboard/kehadiran/components/absensi-client.tsx';
let c2 = fs.readFileSync(file2, 'utf8');
const find2 = '<p className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100">{block.mapel_nama}</p>\n              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">\n                {block.kelas_label} &middot; Jadwal';
const replace2 = `<div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className="text-base font-bold text-slate-800 dark:text-slate-100">{block.kelas_label}</span>
                <span className="text-xs bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full max-w-[200px] truncate">{block.mapel_nama}</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Jadwal`;
c2 = c2.replace(find2, replace2);
fs.writeFileSync(file2, c2, 'utf8');

// 3. JadwalMengajarToday.tsx
const file3 = 'components/dashboard/shared/JadwalMengajarToday.tsx';
let c3 = fs.readFileSync(file3, 'utf8');
const find3 = '<p className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate">{j.nama_mapel}</p>\n                  <p className="text-[10px] text-slate-400 dark:text-slate-500">\n                    Kelas {j.tingkat}{j.kelompok ?? \'\'}-{j.nomor_kelas}\n                  </p>';
const replace3 = `<div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Kelas {j.tingkat}{j.kelompok ?? ''}-{j.nomor_kelas}</span>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded-full truncate max-w-[150px]">{j.nama_mapel}</span>
                  </div>`;
c3 = c3.replace(find3, replace3);
fs.writeFileSync(file3, c3, 'utf8');

console.log("Done");
