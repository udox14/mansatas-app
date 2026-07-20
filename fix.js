const fs = require('fs');
const file = 'app/dashboard/agenda/components/agenda-client.tsx';
let content = fs.readFileSync(file, 'utf8');

// Fix 1: Jam -> Jam ke-
content = content.replace(/\(Jam \$\{item\.jam_ke_mulai/g, '(Jam ke-${item.jam_ke_mulai');
content = content.replace(/Jam \{segment\.jam_ke_mulai/g, 'Jam ke-{segment.jam_ke_mulai');
content = content.replace(/Jadwal jam \{block/g, 'Jadwal jam ke-{block');
content = content.replace(/aktif jam \{block/g, 'aktif jam ke-{block');

// Fix 2: Conditional KBM aktif
const findStr = '{!block.is_fully_excepted && <> &middot; KBM aktif jam ke-{block.jam_ke_mulai === block.jam_ke_selesai ? block.jam_ke_mulai : `${block.jam_ke_mulai}-${block.jam_ke_selesai}`} ({block.slot_mulai}-{block.slot_selesai})</>}';
const replaceStr = '{block.exception_segments.length > 0 && !block.is_fully_excepted && <> &middot; KBM aktif jam ke-{block.jam_ke_mulai === block.jam_ke_selesai ? block.jam_ke_mulai : `${block.jam_ke_mulai}-${block.jam_ke_selesai}`} ({block.slot_mulai}-{block.slot_selesai})</>}';

content = content.replace(findStr, replaceStr);

fs.writeFileSync(file, content, 'utf8');
