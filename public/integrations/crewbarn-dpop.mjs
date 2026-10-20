#!/usr/bin/env node
/** CrewBarn integration signing helper. Node 22+, built-in modules only. */
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, randomUUID, sign } from 'node:crypto'
import { readFile, open } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export const API_ORIGIN = 'https://api.crewbarn.com'
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')

/** Select public members explicitly: private JWK members must never leave the signer. */
export function publicJwk(value) {
  if (value?.kty !== 'EC' || value.crv !== 'P-256'
    || !/^[A-Za-z0-9_-]{43}$/.test(value.x ?? '') || !/^[A-Za-z0-9_-]{43}$/.test(value.y ?? '')) {
    throw new Error('An ES256 P-256 public key is required')
  }
  const jwk = { kty: 'EC', crv: 'P-256', x: value.x, y: value.y }
  createPublicKey({ key: jwk, format: 'jwk' }) // Reject points outside the curve.
  return jwk
}

export async function pemSigner(path) {
  if (!path) throw new Error('Set CREWBARN_SIGNING_KEY_FILE to a private PEM file')
  const key = createPrivateKey(await readFile(path))
  const jwk = publicJwk(createPublicKey(key).export({ format: 'jwk' }))
  return { publicJwk: jwk, sign: input => sign('sha256', input, { key, dsaEncoding: 'ieee-p1363' }) }
}

/** New files only. POSIX mode 0600; on Windows also restrict the directory/file ACL. */
export async function generateKeyFile(path) {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const file = await open(path, 'wx', 0o600)
  try { await file.writeFile(privateKey.export({ type: 'pkcs8', format: 'pem' })) }
  finally { await file.close() }
  return publicJwk(publicKey.export({ format: 'jwk' }))
}

function destination(value, origin, allowLoopbackForTests) {
  const base = new URL(origin)
  const loopback = allowLoopbackForTests && base.protocol === 'http:'
    && ['127.0.0.1', '[::1]'].includes(base.hostname)
  if ((!loopback && base.href !== API_ORIGIN + '/') || base.username || base.password || base.search || base.hash
    || base.pathname !== '/') throw new Error('Only the canonical CrewBarn API origin is allowed')
  const url = new URL(value, base)
  if (url.origin !== base.origin || url.username || url.password || url.hash || !url.pathname.startsWith('/v1/')) {
    throw new Error('Request must target /v1/ on the configured API without credentials or fragment')
  }
  return url
}

/** sign(input) must return the 64-byte IEEE P1363 ES256 signature (r || s). */
export async function createProof({ method, url, token, signer, iat }) {
  if (typeof token !== 'string' || !/^[\x21-\x7e]+$/.test(token)) throw new Error('An ASCII token without whitespace is required')
  if (!/^[A-Z]+$/.test(method) || !Number.isSafeInteger(iat)) throw new Error('Invalid proof method or time')
  const htu = new URL(url)
  htu.search = ''; htu.hash = ''
  const header = { typ: 'dpop+jwt', alg: 'ES256', jwk: publicJwk(signer.publicJwk) }
  const payload = { htm: method, htu: htu.href, iat, jti: randomUUID(), ath: createHash('sha256').update(token, 'ascii').digest('base64url') }
  const input = Buffer.from(`${encode(header)}.${encode(payload)}`, 'ascii')
  const signature = Buffer.from(await signer.sign(input))
  if (signature.length !== 64) throw new Error('Signer must return a 64-byte IEEE P1363 signature')
  return `${input.toString('ascii')}.${signature.toString('base64url')}`
}

async function clockSeconds(origin, fetchImpl) {
  const url = origin + '/v1/health'
  const start = performance.now()
  const response = await fetchImpl(url, {
    headers: { Accept: 'application/json' }, redirect: 'error', cache: 'no-store',
    credentials: 'omit', signal: AbortSignal.timeout(5000),
  })
  const age = response.headers.get('age')
  if (!response.ok || response.redirected || response.url !== url
    || !/\bno-store\b/i.test(response.headers.get('cache-control') ?? '')
    || (age !== null && !/^0+$/.test(age.trim()))
    || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')
    || !response.body || Number(response.headers.get('content-length') ?? 0) > 4096) throw new Error('Untrusted API clock response')
  let size = 0
  const chunks = []
  const reader = response.body.getReader()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 4096) throw new Error('Oversized API clock response')
      chunks.push(Buffer.from(value))
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error }
  finally { reader.releaseLock() }
  const { timestamp } = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  if (typeof timestamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(timestamp)) throw new Error('Invalid API timestamp')
  const time = Date.parse(timestamp)
  const calendar = new Date(timestamp.slice(0, 10) + 'T00:00:00Z')
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== timestamp.slice(0, 10)) throw new Error('Invalid API calendar date')
  const elapsed = performance.now() - start
  const date = response.headers.get('date')
  if (!Number.isFinite(time) || elapsed < 0 || elapsed > 5000
    || (date !== null && (!Number.isFinite(Date.parse(date)) || Math.abs(Date.parse(date) - time) > 5000))) throw new Error('Invalid API clock')
  return Math.floor((time + elapsed / 2) / 1000)
}

/** Never redirects or retries. A fresh health read and proof are made for each call. */
export function createClient({ token, signer, origin = API_ORIGIN, allowLoopbackForTests = false, fetchImpl = fetch }) {
  if (typeof token !== 'string' || !/^[\x21-\x7e]+$/.test(token)) throw new Error('An ASCII token without whitespace is required')
  destination('/v1/health', origin, allowLoopbackForTests)
  const base = new URL(origin).origin
  async function prepare(method, value, options = {}) {
    const url = destination(value, origin, allowLoopbackForTests)
    method = method.toUpperCase()
    if (!/^[A-Z]+$/.test(method)) throw new Error('Invalid HTTP method')
    const headers = new Headers(options.headers)
    for (const name of ['authorization', 'dpop', 'host', 'cookie', 'proxy-authorization']) {
      if (headers.has(name)) throw new Error('Credential and routing headers are managed by the helper')
    }
    const iat = await clockSeconds(base, fetchImpl)
    headers.set('Accept', 'application/json')
    headers.set('Authorization', `DPoP ${token}`)
    headers.set('DPoP', await createProof({ method, url, token, signer, iat }))
    return { url: url.href, method, headers }
  }
  return {
    prepare,
    async request(method, url, { headers, body, signal = AbortSignal.timeout(30000) } = {}) {
      const request = await prepare(method, url, { headers })
      return fetchImpl(request.url, { method: request.method, headers: request.headers, body, signal,
        redirect: 'error', credentials: 'omit', cache: 'no-store' })
    },
  }
}

async function main(args) {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Node 22 or newer is required')
  const [command, methodOrPath, url, bodyFile] = args
  if (command === 'generate-key' && args.length === 2) {
    console.log(JSON.stringify(await generateKeyFile(methodOrPath), null, 2)); return
  }
  if (!['public-jwk', 'request', 'curl'].includes(command)) {
    throw new Error('Usage: crewbarn-dpop.mjs generate-key NEW_PEM_PATH | public-jwk | request METHOD URL [JSON_FILE] | curl METHOD URL [JSON_FILE]')
  }
  const signer = await pemSigner(process.env.CREWBARN_SIGNING_KEY_FILE)
  if (command === 'public-jwk' && args.length === 1) { console.log(JSON.stringify(signer.publicJwk, null, 2)); return }
  if (!['request', 'curl'].includes(command) || args.length < 3 || args.length > 4) throw new Error('Invalid command arguments')
  const client = createClient({ token: process.env.CREWBARN_API_TOKEN, signer })
  const body = bodyFile ? await readFile(bodyFile, 'utf8') : undefined
  if (body !== undefined) JSON.parse(body)
  const headers = body !== undefined ? { 'Content-Type': 'application/json' } : {}
  if (command === 'curl') {
    const request = await client.prepare(methodOrPath, url, { headers })
    // Secrets travel over stdin, never as process arguments or printed headers.
    const quote = value => '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n') + '"'
    const config = [`url = ${quote(request.url)}`, `request = ${quote(request.method)}`,
      ...[...request.headers].map(([name, value]) => `header = ${quote(`${name}: ${value}`)}`),
      ...(body !== undefined ? [`data = ${quote(body)}`] : [])].join('\n') + '\n'
    // -q must be first: ignore ~/.curlrc, which could enable redirects/tracing/retries.
    const child = spawn('curl', ['-q', '--config', '-', '--proto', '=https', '--max-redirs', '0', '--fail-with-body', '--silent', '--show-error'], { stdio: ['pipe', 'inherit', 'inherit'] })
    child.stdin.on('error', () => {})
    child.stdin.end(config)
    await new Promise((resolve, reject) => { child.on('error', () => reject(new Error('Could not start curl'))); child.on('exit', code => code === 0 ? resolve() : reject(new Error('curl request failed; inspect the response before any retry'))) })
    return
  }
  const response = await client.request(methodOrPath, url, { headers, body })
  process.stderr.write(`HTTP ${response.status}\n`)
  const result = await response.text()
  // Do not echo a reflected credential from an API error response.
  process.stdout.write(result.split(process.env.CREWBARN_API_TOKEN).join('[REDACTED]') + '\n')
  if (!response.ok) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(() => {
    // Do not log exception objects: crypto/network errors can contain inputs.
    process.stderr.write('CrewBarn request/signing failed. Check the command, key path, API clock and response. No automatic retry was made.\n')
    process.exitCode = 1
  })
}
