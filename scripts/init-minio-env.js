// Cria/verifica o arquivo .env com variáveis do MinIO
// Uso: node scripts/init-minio-env.js

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ENV_PATH = resolve(process.cwd(), '.env')

const VARS = [
  'MINIO_URL',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
  'MINIO_BUCKET',
  'MINIO_PREFIX',
  'MINIO_ALIAS',
  'MINIO_REMOVE_EXTRA',
]

function parseEnv(content) {
  const out = {}
  const lines = content.split(/\r?\n/)
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx < 1) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
    out[key] = value
  }
  return out
}

function templateEnv() {
  return `# Configurações do MinIO para deploy
# NUNCA comitar credenciais reais. Este arquivo deve estar no .gitignore

MINIO_URL=http://localhost:9000
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=
MINIO_BUCKET=

# Opcional: subpasta dentro do bucket (ex: widgets/info)
MINIO_PREFIX=

# Opcional: nome do alias no mc (padrão: minio)
MINIO_ALIAS=minio

# Opcional: defina 1 para remover arquivos que não existem mais em dist/
MINIO_REMOVE_EXTRA=
`
}

function printVars(values) {
  console.log('Variáveis atuais em .env:')
  for (const k of VARS) {
    const v = values[k] ?? ''
    console.log(`${k}=${v}`)
  }
}

function main() {
  if (existsSync(ENV_PATH)) {
    console.log(`.env já existe em: ${ENV_PATH}`)
    const parsed = parseEnv(readFileSync(ENV_PATH, 'utf8'))
    printVars(parsed)
    return
  }

  writeFileSync(ENV_PATH, templateEnv(), { encoding: 'utf8' })
  console.log(`.env criado em: ${ENV_PATH}`)
  console.log('Preencha as variáveis e rode: npm run builddeploy')
}

main()

