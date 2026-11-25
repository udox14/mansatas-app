const { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs')
const { join, resolve, sep } = require('node:path')
const { spawnSync } = require('node:child_process')

const root = resolve(__dirname, '..')
const openNextDir = resolve(root, '.open-next')
const env = { ...process.env, NEXT_PRIVATE_STANDALONE: 'true' }
const nextCli = join(root, 'node_modules', 'next', 'dist', 'bin', 'next')
const openNextCli = join(root, 'node_modules', '@opennextjs', 'cloudflare', 'dist', 'cli', 'index.js')

// OpenNext 1.20.2 needs these two patches for the Next.js 16.4 runtime.
function patchOpenNextForNext164() {
  const nextVersion = JSON.parse(readFileSync(join(root, 'node_modules', 'next', 'package.json'), 'utf8')).version
  if (nextVersion !== '16.4.2') return

  const patchDir = join(root, 'node_modules', '@opennextjs', 'cloudflare', 'dist', 'cli', 'build', 'patches', 'plugins')
  function replaceOnce(filename, before, after) {
    const patchPath = join(patchDir, filename)
    const source = readFileSync(patchPath, 'utf8')
    if (source.includes(after)) return
    if (source.split(before).length !== 2) {
      throw new Error(`OpenNext ${filename} changed; review Next.js 16.4 compatibility before building.`)
    }
    writeFileSync(patchPath, source.replace(before, after))
  }

  // Next.js 16.4 loads this manifest on every dynamic request.
  const oldGlob = '**/{*-manifest,required-server-files,prefetch-hints}.json'
  const newGlob = '**/{*-manifest,required-server-files,prefetch-hints,preview-props}.json'
  replaceOnce('load-manifest.js', oldGlob, newGlob)

  // The adapter already registers its cache handlers above this line. Next.js 16.4
  // passes handler objects to the remaining loop, which expects string paths.
  const handlersSet = 'globalThis[handlersSetSymbol] = new Set(globalThis[handlersMapSymbol].values());'
  replaceOnce('next-server.js', handlersSet, `${handlersSet}\n  return;`)
}

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

const publicDataDir = join(root, 'public', 'data')
mkdirSync(publicDataDir, { recursive: true })
copyFileSync(join(root, 'data', 'kampus.json'), join(publicDataDir, 'kampus.json'))
copyFileSync(join(root, 'data', 'prodi.json'), join(publicDataDir, 'prodi.json'))

run(process.execPath, [nextCli, 'build', '--webpack'])

patchOpenNextForNext164()

if (!openNextDir.startsWith(`${root}${sep}`)) {
  throw new Error('Refusing to clean an OpenNext directory outside the project root.')
}
rmSync(openNextDir, { recursive: true, force: true })

run(process.execPath, [openNextCli, 'build', '--skipNextBuild'])
