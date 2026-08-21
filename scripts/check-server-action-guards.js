const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const allowlistPath = path.join(root, 'security', 'server-action-public-allowlist.json')
const allowlist = fs.existsSync(allowlistPath)
  ? JSON.parse(fs.readFileSync(allowlistPath, 'utf8'))
  : {}
const guardPattern = /\b(requireActionAccess|requireUser|getSession|getCurrentUser|getAppSession|isCurrentUserPlayReviewer|verify[A-Z]\w*Access|require[A-Z]\w*(?:Access|Session|Permission)|assert[A-Z]\w*Access|getAuthContext)\s*\(/

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) return ['node_modules', '.next', '.open-next'].includes(entry.name) ? [] : walk(target)
    return /\.(ts|tsx)$/.test(entry.name) ? [target] : []
  })
}

const failures = []
for (const file of walk(path.join(root, 'app'))) {
  const sourceText = fs.readFileSync(file, 'utf8')
  if (!/^\s*(['"])use server\1/m.test(sourceText)) continue
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true)
  const functions = new Map()
  for (const node of source.statements) {
    const exported = Boolean(node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword))
    let name = null
    let body = null
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      name = node.name.text
      body = node.body
    } else if (ts.isVariableStatement(node)) {
      const declaration = node.declarationList.declarations[0]
      if (declaration && ts.isIdentifier(declaration.name) && declaration.initializer &&
          (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))) {
        name = declaration.name.text
        body = declaration.initializer.body
      }
    }
    if (name && body) functions.set(name, { node, body, exported, text: body.getText(source) })
  }

  const guarded = new Set()
  for (const [name, fn] of functions) if (guardPattern.test(fn.text)) guarded.add(name)
  let changed = true
  while (changed) {
    changed = false
    for (const [name, fn] of functions) {
      if (guarded.has(name)) continue
      if ([...guarded].some(guardName => new RegExp(`\\b${guardName}\\s*\\(`).test(fn.text))) {
        guarded.add(name)
        changed = true
      }
    }
  }

  for (const [name, fn] of functions) {
    if (!fn.exported) continue
    const relative = path.relative(root, file).replace(/\\/g, '/')
    const key = `${relative}#${name}`
    const allowedReason = allowlist[key]
    if (!guarded.has(name) && !(typeof allowedReason === 'string' && allowedReason.trim().length >= 12)) {
      const line = source.getLineAndCharacterOfPosition(fn.node.getStart(source)).line + 1
      failures.push(`${relative}:${line} ${name}`)
    }
  }
}

if (failures.length) {
  console.error('Exported Server Actions without a recognized guard or reviewed public allowlist entry:')
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}
console.log('Server Action guard check passed.')
