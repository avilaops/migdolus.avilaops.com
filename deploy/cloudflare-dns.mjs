// Cria (se não existir) o registro A do Migdolus Monitor na zona avilaops.com.
// Uso (no Hetzner, onde ficam os tokens):
//   CLOUDFLARE_ENV_FILE=/etc/avilaops/tokens.env CLOUDFLARE_EMAIL=nicolas@avilaops.com \
//   DNS_RECORD=migdolus.avilaops.com DNS_ORIGIN_IP=178.105.82.48 DNS_APPLY=1 node cloudflare-dns.mjs
// Sem DNS_APPLY=1 apenas mostra o que faria. DNS_PROXIED=1 liga o proxy da Cloudflare
// (padrão: DNS-only, como os demais subdomínios atendidos pelo Caddy).
import fs from 'node:fs'

function valuesFromEnvFile(file) {
  if (!file) return {}
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).reduce((values, line) => {
    const separator = line.indexOf('=')
    if (separator < 1 || line.trim().startsWith('#')) return values
    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')
    values[key] = value
    return values
  }, {})
}

const fileEnv = valuesFromEnvFile(process.env.CLOUDFLARE_ENV_FILE)
const token = process.env.CLOUDFLARE_TOKEN || fileEnv.CLOUDFLARE_TOKEN
const globalKey = process.env.CLOUDFLARE_API_GLOBAL_KEY || fileEnv.CLOUDFLARE_API_GLOBAL_KEY
const accountEmail = process.env.CLOUDFLARE_EMAIL || fileEnv.CLOUDFLARE_EMAIL
const zoneName = process.env.DNS_ZONE || 'avilaops.com'
const recordName = process.env.DNS_RECORD || 'migdolus.avilaops.com'
const originIp = process.env.DNS_ORIGIN_IP
const apply = process.env.DNS_APPLY === '1'
const proxied = process.env.DNS_PROXIED === '1'

if (!token && !(globalKey && accountEmail)) throw new Error('Credencial Cloudflare não configurada.')

const tokenHeaders = token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : null
const globalHeaders = globalKey && accountEmail ? { 'X-Auth-Email': accountEmail, 'X-Auth-Key': globalKey, 'Content-Type': 'application/json' } : null
const api = async (path, init) => {
  let response = await fetch(`https://api.cloudflare.com/client/v4${path}`, { ...init, headers: tokenHeaders || globalHeaders })
  if ((response.status === 403 || response.status === 400) && tokenHeaders && globalHeaders) {
    response = await fetch(`https://api.cloudflare.com/client/v4${path}`, { ...init, headers: globalHeaders })
  }
  const data = await response.json()
  if (!response.ok || !data.success) {
    const publicErrors = Array.isArray(data.errors) ? data.errors.map(({ code, message }) => ({ code, message })) : []
    throw new Error(`Cloudflare API falhou: HTTP ${response.status} ${JSON.stringify(publicErrors)}`)
  }
  return data
}

const zones = await api(`/zones?name=${encodeURIComponent(zoneName)}`)
if (zones.result.length !== 1) throw new Error(`Zona ${zoneName} não encontrada de forma unívoca.`)
const zone = zones.result[0]
const records = await api(`/zones/${zone.id}/dns_records?name=${encodeURIComponent(recordName)}`)

if (records.result.length) {
  console.log(JSON.stringify({ action: 'unchanged', record: records.result.map(({ type, name, content, proxied }) => ({ type, name, content, proxied })) }))
} else if (!apply) {
  console.log(JSON.stringify({ action: 'would-create', zone: zone.name, recordName, proxied }))
} else {
  if (!originIp) throw new Error('DNS_ORIGIN_IP é obrigatório para criar o registro.')
  const created = await api(`/zones/${zone.id}/dns_records`, {
    method: 'POST',
    body: JSON.stringify({ type: 'A', name: recordName, content: originIp, ttl: 1, proxied, comment: 'Migdolus Monitor — Hetzner/Caddy' }),
  })
  const { type, name, content } = created.result
  console.log(JSON.stringify({ action: 'created', record: { type, name, content, proxied: created.result.proxied } }))
}
