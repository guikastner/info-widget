// Node deploy script for MinIO using MinIO SDK (no external mc binary)

import { existsSync, readFileSync, statSync, readdirSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE_DIR = process.env.SOURCE_DIR || 'dist'

function log(msg, color = '36') {
  console.log(`\x1b[${color}m==> ${msg}\x1b[0m`)
}

function error(msg) {
  console.error(`\x1b[31m${msg}\x1b[0m`)
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
  log(`Deploy para MinIO (SDK) a partir de '${SOURCE_DIR}'`)

  // Load .env if present
  loadDotEnv()

  // Validate env
  requireEnv(['MINIO_URL', 'MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY', 'MINIO_BUCKET'])

  // Validate source directory
  const absSource = resolve(process.cwd(), SOURCE_DIR)
  if (!existsSync(absSource)) {
    error(`Diretório de origem não encontrado: ${SOURCE_DIR}. Rode o build antes (npm run build).`)
    process.exit(1)
  }

  const url = new URL(process.env.MINIO_URL)
  const useSSL = url.protocol === 'https:'
  const endPoint = url.hostname
  const port = url.port ? Number(url.port) : useSSL ? 443 : 80
  const accessKey = process.env.MINIO_ACCESS_KEY
  const secretKey = process.env.MINIO_SECRET_KEY
  const bucket = process.env.MINIO_BUCKET
  const prefix = (process.env.MINIO_PREFIX || '').replace(/^\/+|\/+$/g, '')
  const region = process.env.MINIO_REGION || undefined
  const removeExtra = process.env.MINIO_REMOVE_EXTRA === '1'

  const { Client } = await import('minio')
  const client = new Client({ endPoint, port, useSSL, accessKey, secretKey, region })

  // Ensure bucket exists
  log(`Verificando bucket: ${bucket}`)
  let exists
  try {
    exists = await client.bucketExists(bucket)
  } catch (e) {
    const msg = e?.message || String(e)
    error(`Falha ao verificar bucket '${bucket}': ${msg}`)
    if (/API port/i.test(msg)) {
      console.log('Dica: a variável MINIO_URL deve apontar para a porta da API S3 (ex.: http://host:9000), não a porta do Console (ex.: 9001).')
    }
    process.exit(1)
  }
  if (!exists) {
    log(`Criando bucket: ${bucket}`)
    try {
      await client.makeBucket(bucket, region)
    } catch (e) {
      const msg = e?.message || String(e)
      error(`Falha ao criar bucket '${bucket}': ${msg}`)
      if (/API port/i.test(msg)) {
        console.log('Dica: use o endpoint da API S3 (ex.: http://host:9000) em MINIO_URL, não o Console (ex.: 9001).')
      }
      process.exit(1)
    }
  }

  // Walk local files
  function walk(dir, base, acc = []) {
    const entries = readdirSync(dir)
    for (const name of entries) {
      const full = resolve(dir, name)
      const st = statSync(full)
      if (st.isDirectory()) {
        walk(full, base, acc)
      } else if (st.isFile()) {
        const rel = relative(base, full).split('\\').join('/')
        acc.push({ full, rel })
      }
    }
    return acc
  }

  const files = walk(absSource, absSource)
  const localSet = new Set(files.map(({ rel }) => (prefix ? `${prefix}/${rel}` : rel)))

  // Optionally remove remote extras
  if (removeExtra) {
    log('Listando objetos remotos para limpeza...')
    await new Promise((resolvePromise, reject) => {
      const toDelete = []
      const stream = client.listObjectsV2(bucket, prefix || '', true)
      stream.on('data', (obj) => {
        if (obj?.name && !localSet.has(obj.name)) toDelete.push(obj.name)
      })
      stream.on('error', reject)
      stream.on('end', async () => {
        if (toDelete.length === 0) return resolvePromise()
        log(`Removendo ${toDelete.length} objeto(s) que não existem em '${SOURCE_DIR}'`)
        // Delete em lotes pequenos
        const chunk = 1000
        for (let i = 0; i < toDelete.length; i += chunk) {
          const batch = toDelete.slice(i, i + chunk).map((name) => ({ name }))
          await client.removeObjects(bucket, batch)
        }
        resolvePromise()
      })
    })
  }

  // Upload files
  log(`Enviando ${files.length} arquivo(s) para '${bucket}/${prefix || ''}'`)

  const mime = (name) => {
    const lower = name.toLowerCase()
    if (lower.endsWith('.html')) return 'text/html'
    if (lower.endsWith('.js')) return 'application/javascript'
    if (lower.endsWith('.css')) return 'text/css'
    if (lower.endsWith('.json')) return 'application/json'
    if (lower.endsWith('.svg')) return 'image/svg+xml'
    if (lower.endsWith('.png')) return 'image/png'
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
    if (lower.endsWith('.ico')) return 'image/x-icon'
    return 'application/octet-stream'
  }

  for (const { full, rel } of files) {
    const objectName = prefix ? `${prefix}/${rel}` : rel
    await client.fPutObject(bucket, objectName, full, { 'Content-Type': mime(rel) })
  }

  log('Deploy concluído com sucesso.', '32')
}

main().catch((e) => {
  error(e?.message || String(e))
  process.exit(1)
})
