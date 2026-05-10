const fs = require('fs');
let c = fs.readFileSync('app/portal-ortu/page.tsx', 'utf8');
c = c.replace(
  'const semesterNumeric = semesters.map(s => Number(s.value)).filter(v => !Number.isNaN(v))',
  "const semesterNumeric = semesters.map(s => s.value).filter(v => v !== null && v !== undefined && v !== '').map(Number).filter(v => !Number.isNaN(v))"
);
fs.writeFileSync('app/portal-ortu/page.tsx', c);
