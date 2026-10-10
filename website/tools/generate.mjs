// Sends every prompt in manifest.mjs to its own `codex exec` session and collects the PNGs.
//
//   node tools/generate.mjs                 everything that is missing
//   node tools/generate.mjs valley stone-3  only these ids
//   node tools/generate.mjs --force --c=20  redo, 20 sessions at a time
//
// Codex's shell is unusable on this machine, so each prompt tells it to do nothing except call
// its built-in image tool. The session id is read from the log and the PNG copied from
// ~/.codex/generated_images/<session id>/ into assets-raw/.
import { spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assets } from './manifest.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const RAW = join(root, 'assets-raw')
const LOGS = join(root, 'tools', 'logs')
const GENERATED = join(homedir(), '.codex', 'generated_images')
mkdirSync(RAW, { recursive: true })
mkdirSync(LOGS, { recursive: true })

const args = process.argv.slice(2)
const force = args.includes('--force')
const concurrency = Number((args.find((a) => a.startsWith('--c=')) ?? '--c=16').slice(4))
const only = args.filter((a) => !a.startsWith('--'))

const fileFor = (asset, step) => (asset.steps ? `${asset.id}-${step + 1}.png` : `${asset.id}.png`)
const count = (asset) => asset.steps?.length ?? 1
const complete = (asset) => Array.from({ length: count(asset) }, (_, i) => existsSync(join(RAW, fileFor(asset, i)))).every(Boolean)

const RULES =
  'You are being used purely as an image generator. Shell commands and file tools are broken in this environment: ' +
  'do NOT run any shell command and do NOT read, list or copy any file. Only call the built-in image generation tool ' +
  '(image_gen).\n\n'

function brief(asset) {
  if (asset.steps) {
    return (
      RULES +
      `Make exactly ${asset.steps.length} images, in order, with one image_gen call each. STEP 1 is a new image. Every ` +
      'later step is an EDIT of the STEP 1 image (it is already visible in this conversation): keep the camera position, ' +
      'framing, crop, horizon and the outline of every object exactly where they are, and change only what the step says.\n\n' +
      asset.steps.map((s, i) => `STEP ${i + 1} (${asset.aspect}):\n${s}`).join('\n\n') +
      '\n\nWhen every step is done, reply with only the saved file paths, in order.'
    )
  }
  return (
    RULES +
    'Call image_gen exactly once with the prompt below and keep all of its content. ' +
    `Requested shape: ${asset.aspect}. ` +
    (asset.alpha ? 'The output MUST have a genuinely transparent background (real alpha channel). ' : '') +
    'When it returns, reply with only the saved file path.\n\nPROMPT:\n' +
    asset.prompt
  )
}

function generate(asset) {
  return new Promise((resolve) => {
    const started = Date.now()
    const child = spawn(
      'codex',
      ['exec', '--skip-git-repo-check', '--sandbox', 'read-only', '-c', 'model_reasoning_effort="low"', '--color', 'never', '-'],
      { cwd: root, windowsHide: true },
    )
    let log = ''
    child.stdout.on('data', (d) => (log += d))
    child.stderr.on('data', (d) => (log += d))
    child.on('error', (e) => (log += `\nSPAWN ERROR ${e.message}`))
    child.stdin.end(brief(asset))
    const timer = setTimeout(() => child.kill(), (asset.steps ? 6 + 3 * asset.steps.length : 12) * 60_000)

    child.on('close', (code) => {
      clearTimeout(timer)
      writeFileSync(join(LOGS, `${asset.id}.log`), log)
      const secs = Math.round((Date.now() - started) / 1000)
      const fail = (why) => resolve({ id: asset.id, ok: false, note: `${why}, ${secs}s, exit ${code}` })

      const session = log.match(/session id:\s*([0-9a-f-]{36})/i)?.[1]
      const dir = session && join(GENERATED, session)
      if (!dir || !existsSync(dir)) return fail('no image folder')
      const images = readdirSync(dir)
        .filter((f) => /\.(png|webp|jpe?g)$/i.test(f))
        .map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs }))
        .sort((a, b) => a.t - b.t)
      if (images.length < count(asset)) return fail(`${images.length}/${count(asset)} images`)
      images.slice(-count(asset)).forEach((img, i) => copyFileSync(join(dir, img.f), join(RAW, fileFor(asset, i))))
      resolve({ id: asset.id, ok: true, note: `${secs}s` })
    })
  })
}

const queue = assets.filter((a) => (only.length ? only.includes(a.id) : true) && (force || !complete(a)))
console.log(`${queue.length} of ${assets.length} image job(s) to run, ${concurrency} at a time\n`)

const results = []
let next = 0
await Promise.all(
  Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (next < queue.length) {
      const result = await generate(queue[next++])
      results.push(result)
      console.log(`${result.ok ? 'ok  ' : 'FAIL'}  ${result.id.padEnd(16)} ${result.note}   [${results.length}/${queue.length}]`)
    }
  }),
)

const failed = results.filter((r) => !r.ok)
console.log(`\ndone: ${results.length - failed.length} ok, ${failed.length} failed${failed.length ? ` (${failed.map((r) => r.id).join(', ')})` : ''}`)
