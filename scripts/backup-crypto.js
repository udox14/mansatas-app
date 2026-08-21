#!/usr/bin/env node

const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { pipeline } = require('node:stream/promises')

const MAGIC = Buffer.from('MANSBK01')
const IV_BYTES = 12
const TAG_BYTES = 16

function keyFromEnvironment() {
  const value = process.env.MANSATAS_BACKUP_KEY
  if (!value) throw new Error('MANSATAS_BACKUP_KEY is required')
  const key = Buffer.from(value, 'base64')
  if (key.length !== 32) throw new Error('MANSATAS_BACKUP_KEY must decode to 32 bytes')
  return key
}

async function encrypt(source, destination) {
  const key = keyFromEnvironment()
  const iv = crypto.randomBytes(IV_BYTES)
  const temporary = `${destination}.partial`
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  const output = fs.createWriteStream(temporary, { flags: 'wx' })
  output.write(MAGIC)
  output.write(iv)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  await pipeline(fs.createReadStream(source), cipher, output)
  fs.appendFileSync(temporary, cipher.getAuthTag())
  fs.renameSync(temporary, destination)
}

async function decrypt(source, destination) {
  const key = keyFromEnvironment()
  const descriptor = fs.openSync(source, 'r')
  try {
    const stat = fs.fstatSync(descriptor)
    if (stat.size <= MAGIC.length + IV_BYTES + TAG_BYTES) throw new Error('Invalid backup file')
    const header = Buffer.alloc(MAGIC.length + IV_BYTES)
    fs.readSync(descriptor, header, 0, header.length, 0)
    if (!header.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Invalid backup magic')
    const tag = Buffer.alloc(TAG_BYTES)
    fs.readSync(descriptor, tag, 0, TAG_BYTES, stat.size - TAG_BYTES)
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, header.subarray(MAGIC.length))
    decipher.setAuthTag(tag)
    await pipeline(
      fs.createReadStream(source, { start: header.length, end: stat.size - TAG_BYTES - 1 }),
      decipher,
      fs.createWriteStream(destination, { flags: 'wx' })
    )
  } finally {
    fs.closeSync(descriptor)
  }
}

async function main() {
  const [mode, source, destination] = process.argv.slice(2)
  if (!['encrypt', 'decrypt'].includes(mode) || !source || !destination) {
    throw new Error('Usage: backup-crypto.js <encrypt|decrypt> <source> <destination>')
  }
  if (mode === 'encrypt') await encrypt(source, destination)
  else await decrypt(source, destination)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Backup encryption failed')
  process.exitCode = 1
})
