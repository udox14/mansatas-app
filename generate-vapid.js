const fs = require('node:fs');
const path = require('node:path');
const { createECDH } = require('node:crypto');
const { spawnSync } = require('node:child_process');

const projectRoot = __dirname;
const wranglerPath = path.join(projectRoot, 'wrangler.toml');
const envPath = path.join(projectRoot, '.env.local');
const subject = 'mailto:admin@man1tasikmalaya.sch.id';
const shouldApplyToCloudflare = process.argv.includes('--apply-cloudflare');
const shouldApplyExistingToCloudflare = process.argv.includes(
  '--apply-existing-cloudflare',
);

function setEnvValue(source, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');

  if (pattern.test(source)) return source.replace(pattern, line);
  return `${source.trimEnd()}\n${line}\n`;
}

function updateLocalConfiguration(keys) {
  let wrangler = fs.readFileSync(wranglerPath, 'utf8');
  const publicKeyPattern = /^NEXT_PUBLIC_VAPID_PUBLIC_KEY\s*=\s*".*"$/m;

  if (!publicKeyPattern.test(wrangler)) {
    throw new Error('NEXT_PUBLIC_VAPID_PUBLIC_KEY tidak ditemukan di wrangler.toml');
  }

  wrangler = wrangler.replace(
    publicKeyPattern,
    `NEXT_PUBLIC_VAPID_PUBLIC_KEY = "${keys.publicKey}"`,
  );
  fs.writeFileSync(wranglerPath, wrangler, 'utf8');

  let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  env = setEnvValue(env, 'NEXT_PUBLIC_VAPID_PUBLIC_KEY', keys.publicKey);
  env = setEnvValue(env, 'VAPID_PRIVATE_KEY', keys.privateKey);
  env = setEnvValue(env, 'VAPID_SUBJECT', subject);
  fs.writeFileSync(envPath, env, { encoding: 'utf8', mode: 0o600 });
}

function applyPrivateKeyToCloudflare(privateKey) {
  const wranglerCli = path.join(
    projectRoot,
    'node_modules',
    'wrangler',
    'bin',
    'wrangler.js',
  );
  const result = spawnSync(
    process.execPath,
    [wranglerCli, 'secret', 'put', 'VAPID_PRIVATE_KEY', '--config', wranglerPath],
    {
      cwd: projectRoot,
      input: `${privateKey}\n`,
      stdio: ['pipe', 'inherit', 'inherit'],
    },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Wrangler gagal dengan exit code ${result.status}`);
  }
}

let keys;

if (shouldApplyExistingToCloudflare) {
  const env = fs.readFileSync(envPath, 'utf8');
  const publicKey = env.match(/^NEXT_PUBLIC_VAPID_PUBLIC_KEY=(.+)$/m)?.[1]?.trim();
  const privateKey = env.match(/^VAPID_PRIVATE_KEY=(.+)$/m)?.[1]?.trim();

  if (!publicKey || !privateKey) {
    throw new Error('Pasangan VAPID tidak lengkap di .env.local');
  }

  keys = { publicKey, privateKey };
  applyPrivateKeyToCloudflare(keys.privateKey);
} else {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  keys = {
    publicKey: ecdh.getPublicKey().toString('base64url'),
    privateKey: ecdh.getPrivateKey().toString('base64url'),
  };
}

if (shouldApplyToCloudflare) {
  applyPrivateKeyToCloudflare(keys.privateKey);
}

if (!shouldApplyExistingToCloudflare) {
  updateLocalConfiguration(keys);
}

console.log('VAPID public key baru:', keys.publicKey);
console.log(
  shouldApplyToCloudflare || shouldApplyExistingToCloudflare
    ? 'Private key baru sudah dipasang sebagai Cloudflare secret dan disimpan hanya di .env.local.'
    : 'Private key baru disimpan hanya di .env.local; gunakan --apply-cloudflare untuk memasangnya.',
);
