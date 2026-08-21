const fs = require('node:fs')
const path = require('node:path')

const input = fs.readFileSync(0, 'utf8').trim()
if (!input) {
  console.error('npm audit did not return JSON')
  process.exit(1)
}

let report
try {
  report = JSON.parse(input)
} catch {
  console.error('npm audit returned invalid JSON')
  process.exit(1)
}

if (report.error || !report.vulnerabilities) {
  console.error(`npm audit failed: ${report.error?.summary || report.message || 'unknown error'}`)
  process.exit(1)
}

const configPath = path.join(process.cwd(), 'security', 'dependency-exceptions.json')
const { exceptions } = JSON.parse(fs.readFileSync(configPath, 'utf8'))
const today = new Date().toISOString().slice(0, 10)

function advisoryId(url) {
  return typeof url === 'string' ? url.split('/').pop() : ''
}

function exceptionFor(via) {
  return exceptions.find(exception =>
    exception.package === via.name
    && exception.advisory === advisoryId(via.url)
    && exception.severity === via.severity
    && exception.reviewBy >= today
  )
}

function isExplicitlyAllowed(name, stack = new Set()) {
  if (stack.has(name)) return false
  const vulnerability = report.vulnerabilities[name]
  if (!vulnerability || !Array.isArray(vulnerability.via) || vulnerability.via.length === 0) return false
  const nextStack = new Set(stack).add(name)
  return vulnerability.via.every(via => {
    if (typeof via === 'string') return isExplicitlyAllowed(via, nextStack)
    return Boolean(exceptionFor(via))
  })
}

const blocking = Object.entries(report.vulnerabilities)
  .filter(([, vulnerability]) => ['critical', 'high'].includes(vulnerability.severity))
  .filter(([name]) => !isExplicitlyAllowed(name))

if (blocking.length > 0) {
  for (const [name, vulnerability] of blocking) {
    console.error(`BLOCKED ${vulnerability.severity}: ${name}`)
  }
  process.exit(1)
}

const allowed = Object.keys(report.vulnerabilities).filter(name => isExplicitlyAllowed(name))
console.log(`npm audit passed; explicit reviewed exception chain: ${allowed.join(', ') || 'none'}`)
