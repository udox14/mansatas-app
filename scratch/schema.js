const db = require('better-sqlite3')('database.sqlite');
const table = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='absensi_siswa'").get();
console.log(table ? table.sql : 'not found');
