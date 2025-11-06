// Node deploy script for MinIO using MinIO Client (mc)
// Requires: mc available in PATH

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

const SOURCE_DIR = process.env.SOURCE_DIR || 'dist'

function log(msg, color = '36') { // 36 = cyan
  // simple ANSI coloring; CLI may strip if unsupported
  console.log(`\x1b[${color}m==> ${msg}\x1b[0m`)
}

function error(msg) {
  console.error(`\x1b[31m${msg}\x1b[0m`)
}

function run(cmd, args, opts = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: false, ...opts })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolvePromise(undefined)
      else reject(new Error(`${cmd} exited with code ${code}`))
    })
  })
}

function tryFindMc() {
  return new Promise((resolvePromise) => {
    const child = spawn('mc', ['--version'], { stdio: 'ignore', shell: false })
    child.on('error', () => resolvePromise(false))
    child.on('close', (code) => resolvePromise(code === 0))
  })
}

function loadDotEnv() {
  const envPath = resolve(process.cwd(), '.env')
  if (!existsSync(envPath)) return
  log(`Carregando variáveis de '${envPath}'`)
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx < 1) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

function requireEnv(keys) {
  const missing = keys.filter((k) => !process.env[k] || !String(process.env[k]).trim())
  if (missing.length) {
    for (const name of missing) error(`Variável de ambiente obrigatória não definida: ${name}`)
    console.log('Defina as variáveis e rode novamente:')
    console.log('  MINIO_URL (ex: http://localhost:9000)')
    console.log('  MINIO_ACCESS_KEY')
    console.log('  MINIO_SECRET_KEY')
    console.log('  MINIO_BUCKET')
    process.exit(1)
  }
}

async function main() {
  log(`Deploy para MinIO a partir de '${SOURCE_DIR}'`)

  // Load .env if present
  loadDotEnv()

  // Verify mc availability
  if (!(await tryFindMc())) {
    error("MinIO Client 'mc' não encontrado no PATH.")
    console.log('Instale o mc ou adicione ao PATH: https://min.io/docs/minio/linux/reference/minio-mc.html')
    process.exit(1)
  }

  // Validate env
  requireEnv(['MINIO_URL', 'MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY', 'MINIO_BUCKET'])

  // Validate source directory
  if (!existsSync(resolve(process.cwd(), SOURCE_DIR))) {
    error(`Diretório de origem não encontrado: ${SOURCE_DIR}. Rode o build antes (npm run build).`)
    process.exit(1)
  }

  const alias = (process.env.MINIO_ALIAS && process.env.MINIO_ALIAS.trim()) || 'minio'
  const url = process.env.MINIO_URL
  const access = process.env.MINIO_ACCESS_KEY
  const secret = process.env.MINIO_SECRET_KEY
  const bucket = process.env.MINIO_BUCKET
  const prefix = (process.env.MINIO_PREFIX || '').replace(/^\/+|\/+$/g, '')
  const removeExtra = process.env.MINIO_REMOVE_EXTRA === '1'

  log(`Configurando alias '${alias}' -> ${url}`)
  await run('mc', ['alias', 'set', alias, url, access, secret])

  log(`Criando bucket (se necessário): ${bucket}`)
  await run('mc', ['mb', '--ignore-existing', `${alias}/${bucket}`])

  const dest = prefix ? `${alias}/${bucket}/${prefix}` : `${alias}/${bucket}`
  log(`Espelhando '${SOURCE_DIR}' -> '${dest}'`)

  const mirrorArgs = ['mirror', '--overwrite']
  if (removeExtra) mirrorArgs.push('--remove')
  mirrorArgs.push(SOURCE_DIR, dest)

  await run('mc', mirrorArgs)
  log('Deploy concluído com sucesso.', '32') // green
}

main().catch((e) => {
  error(e?.message || String(e))
  process.exit(1)
})

