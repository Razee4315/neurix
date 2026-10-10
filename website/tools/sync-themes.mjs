// Copies the app's ten theme definitions (names, taglines and colour roles) into src/app/themes.json,
// so the live phone on the site is coloured by exactly the values the app uses. Read-only on the app.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(join(root, '..', 'src', 'theme', 'themes.ts'), 'utf8')
const list = source.slice(source.indexOf('export const THEMES'), source.indexOf('const STORAGE_KEY'))

const themes = [...list.matchAll(/id: "([^"]+)",\s*name: "([^"]+)",\s*tagline: "([^"]+)",\s*mode: "([^"]+)",\s*colors: \{([^}]+)\}/g)].map(
  ([, id, name, tagline, mode, colors]) => ({
    id,
    name,
    tagline,
    mode,
    colors: Object.fromEntries([...colors.matchAll(/(\w+): "(#[0-9a-f]{6})"/gi)].map(([, role, hex]) => [role, hex])),
  }),
)

if (themes.length !== 10 || themes.some((t) => Object.keys(t.colors).length !== 24)) throw new Error('theme file did not parse as expected')
writeFileSync(join(root, 'src', 'app', 'themes.json'), JSON.stringify(themes, null, 1))
console.log(themes.map((t) => t.name).join(', '))
