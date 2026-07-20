const fs = require('fs');

// 1. absensi-client.tsx
const file2 = 'app/dashboard/kehadiran/components/absensi-client.tsx';
let c2 = fs.readFileSync(file2, 'utf8');

c2 = c2.replace(
  '<p className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100">{block.mapel_nama}</p>\r\n              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">\r\n                {block.kelas_label} &middot; Jadwal',
  `<div className="flex items-center gap-2 flex-wrap mb-0.5">\r\n                <span className="text-base font-bold text-slate-800 dark:text-slate-100">{block.kelas_label}</span>\r\n                <span className="text-xs bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full truncate max-w-[200px]">{block.mapel_nama}</span>\r\n              </div>\r\n              <p className="text-[11px] text-slate-500 dark:text-slate-400">\r\n                Jadwal`
);
c2 = c2.replace(
  '<p className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100">{block.mapel_nama}</p>\n              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">\n                {block.kelas_label} &middot; Jadwal',
  `<div className="flex items-center gap-2 flex-wrap mb-0.5">\n                <span className="text-base font-bold text-slate-800 dark:text-slate-100">{block.kelas_label}</span>\n                <span className="text-xs bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full truncate max-w-[200px]">{block.mapel_nama}</span>\n              </div>\n              <p className="text-[11px] text-slate-500 dark:text-slate-400">\n                Jadwal`
);
fs.writeFileSync(file2, c2, 'utf8');


// 2. JadwalMengajarToday.tsx
const file3 = 'components/dashboard/shared/JadwalMengajarToday.tsx';
let c3 = fs.readFileSync(file3, 'utf8');

c3 = c3.replace(
  '<p className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate">{j.nama_mapel}</p>\r\n                  <p className="text-[10px] text-slate-400 dark:text-slate-500">\r\n                    Kelas {j.tingkat}{j.kelompok ?? \'\'}-{j.nomor_kelas}\r\n                  </p>',
  `<div className="flex items-center gap-1.5 flex-wrap mb-0.5">\r\n                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Kelas {j.tingkat}{j.kelompok ?? ''}-{j.nomor_kelas}</span>\r\n                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded-full truncate max-w-[150px]">{j.nama_mapel}</span>\r\n                  </div>`
);
c3 = c3.replace(
  '<p className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate">{j.nama_mapel}</p>\n                  <p className="text-[10px] text-slate-400 dark:text-slate-500">\n                    Kelas {j.tingkat}{j.kelompok ?? \'\'}-{j.nomor_kelas}\n                  </p>',
  `<div className="flex items-center gap-1.5 flex-wrap mb-0.5">\n                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Kelas {j.tingkat}{j.kelompok ?? ''}-{j.nomor_kelas}</span>\n                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded-full truncate max-w-[150px]">{j.nama_mapel}</span>\n                  </div>`
);

fs.writeFileSync(file3, c3, 'utf8');
