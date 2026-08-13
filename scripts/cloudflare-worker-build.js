const { rmSync } = require('node:fs')
const { join, resolve, sep } = require('node:path')
const { spawnSync } = require('node:child_process')

const root = resolve(__dirname, '..')
const openNextDir = resolve(root, '.open-next')
const env = { ...process.env, NEXT_PRIVATE_STANDALONE: 'true' }
const nextCli = join(root, 'node_modules', 'next', 'dist', 'bin', 'next')
const openNextCli = join(root, 'node_modules', '@opennextjs', 'cloudflare', 'dist', 'cli', 'index.js')

function run(command, args) {
  const result = process.platform === 'win32'
    ? spawnSync([command, ...args].map(arg => `"${arg}"`).join(' '), {
        cwd: root,
        env,
        stdio: 'inherit',
        shell: true,
      })
    : spawnSync(command, args, { cwd: root, env, stdio: 'inherit' })

  if (result.status !== 0) process.exit(result.status || 1)
}

run(process.execPath, [nextCli, 'build', '--webpack'])

if (!openNextDir.startsWith(`${root}${sep}`)) {
  throw new Error('Refusing to clean an OpenNext directory outside the project root.')
}
rmSync(openNextDir, { recursive: true, force: true })

run(process.execPath, [openNextCli, 'build', '--skipNextBuild'])
