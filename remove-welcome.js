const fs = require('fs');
const path = require('path');
const dir = 'c:\\DATA\\mansatas-app\\components\\dashboard';
const files = fs.readdirSync(dir).filter(f => f.endsWith('Dashboard.tsx'));

for (const file of files) {
  const filepath = path.join(dir, file);
  let content = fs.readFileSync(filepath, 'utf8');
  
  content = content.replace(/<WelcomeStrip[^>]*\/>/gs, '');
  content = content.replace(/import\s+\{?[^}]*WelcomeStrip[^}]*\}?\s+from\s+['"][^'"]*WelcomeStrip['"];?\r?\n/g, '');
  
  fs.writeFileSync(filepath, content);
}
console.log('Removed WelcomeStrip from all dashboards');
