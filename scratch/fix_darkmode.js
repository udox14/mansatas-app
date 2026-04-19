const fs = require('fs');
const path = require('path');

const dir = 'C:\\DATA\\mansatas-app\\app\\dashboard';

function walkDir(d, callback) {
    fs.readdirSync(d).forEach(f => {
        let dirPath = path.join(d, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(d, f));
    });
}

const colorMappings = {
    'bg-white': 'bg-slate-900',
    'bg-slate-50': 'bg-slate-800',
    'bg-slate-100': 'bg-slate-800/80',
    'text-slate-900': 'text-slate-50',
    'text-slate-800': 'text-slate-200',
    'text-slate-700': 'text-slate-300',
    'text-slate-600': 'text-slate-400',
    'text-slate-500': 'text-slate-400',
    'text-emerald-800': 'text-emerald-400',
    'text-emerald-700': 'text-emerald-400',
    'bg-emerald-50': 'bg-emerald-950/50',
    'bg-emerald-100': 'bg-emerald-900/50',
    'border-emerald-200': 'border-emerald-800',
    'border-emerald-500': 'border-emerald-500',
    'border-slate-200': 'border-slate-800',
    'border-slate-100': 'border-slate-800',
    'border-slate-300': 'border-slate-700',
};

let changedFiles = 0;

walkDir(dir, (filePath) => {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let original = content;
        
        for (const [lightClass, darkClass] of Object.entries(colorMappings)) {
            const escapedClass = lightClass.replace(/\-/g, '\\-');
            // Matches optional state prefixes, like lg:hover:, then the word boundary
            const regex = new RegExp(`((?:[a-z\\-]+:)*)${escapedClass}\\b`, 'g');
            
            content = content.replace(regex, (match, prefixes) => {
                if (prefixes.includes('dark:')) return match; 
                return `${prefixes}${lightClass} dark:${prefixes}${darkClass}`;
            });
        }
        
        // Remove exact duplicate classes of the form: "dark:class dark:class" -> "dark:class"
        content = content.replace(/(dark:[a-z0-9\-:\/]+)(\s+\1)+/g, "$1");
        
        if (content !== original) {
            fs.writeFileSync(filePath, content, 'utf8');
            changedFiles++;
        }
    }
});
console.log('Total files updated: ' + changedFiles);
