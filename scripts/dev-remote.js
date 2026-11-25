const { mkdirSync, readFileSync, writeFileSync } = require('node:fs')
const { spawn } = require('node:child_process')
const { join, resolve } = require('node:path')

const root = resolve(__dirname, '..')
const wranglerDir = join(root, '.wrangler')
mkdirSync(wranglerDir, { recursive: true })

const baseConfig = JSON.parse(readFileSync(join(root, 'wrangler.jsonc'), 'utf8'))
const remoteDevConfig = {
  ...baseConfig,
  kv_namespaces: (baseConfig.kv_namespaces || []).map(kv => ({ ...kv, remote: true })),
  d1_databases: (baseConfig.d1_databases || []).map(db => ({ ...db, remote: true })),
  r2_buckets: (baseConfig.r2_buckets || []).map(r2 => ({ ...r2, remote: true })),
  vars: {
    ...(baseConfig.vars || {}),
    BETTER_AUTH_URL: 'http://localhost:3000',
    ALLOWED_APP_ORIGINS: [
      baseConfig.vars?.ALLOWED_APP_ORIGINS || '',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ].filter(Boolean).join(','),
    CSP_ENFORCE: 'false',
  },
}
delete remoteDevConfig.browser
delete remoteDevConfig.services
delete remoteDevConfig.queues
delete remoteDevConfig.ratelimits

const remoteConfigPath = join(wranglerDir, 'wrangler.remote-dev.json')
writeFileSync(remoteConfigPath, JSON.stringify(remoteDevConfig, null, 2))

const nextCli = join(root, 'node_modules', 'next', 'dist', 'bin', 'next')
const extraArgs = process.argv.slice(2)
const hasBundlerFlag = extraArgs.some(arg => arg === '--webpack' || arg === '--turbopack' || arg === '--turbo')

const child = spawn(
  process.execPath,
  [nextCli, 'dev', ...(hasBundlerFlag ? [] : ['--webpack']), ...extraArgs],
  {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      CLOUDFLARE_REMOTE_CONFIG_PATH: remoteConfigPath,
    },
  },
)

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 0)
})
