// Demo data for the app's mock backend (its localStorage key `neurix.mock`).
// Written for the site's screenshots. None of it is real user data, and the replies are scripted, not model output.

const HOUR = 3_600_000
const ago = (hours) => new Date(Date.now() - hours * HOUR).toISOString()

export const PROMPT = 'How does a glacier move?'

export const REPLY = [
  'A glacier moves because ice, under enough weight, behaves like a very slow liquid.',
  '',
  '1. **Snow piles up.** Year after year it is pressed into dense ice.',
  '2. **The ice deforms.** Deep down, its own weight makes the crystals slide past each other.',
  '3. **The base slips.** Meltwater underneath lets the whole glacier slide over rock.',
  '',
  'Most glaciers move a few centimetres to a few metres a day.',
].join('\n')

const chat = (id, title, model, character, hours, ...turns) => ({
  id,
  title,
  model_id: model[0],
  model_name: model[1],
  character_id: `preset:${character.toLowerCase()}`,
  character_name: character,
  created_at: ago(hours),
  updated_at: ago(hours),
  messages: turns.map((content, i) => ({ role: i % 2 ? 'assistant' : 'user', content, timestamp: ago(hours) })),
})

const LLAMA = ['llama-3.2-3b', 'Llama 3.2 3B']
const PHI = ['phi-3.5-mini', 'Phi-3.5 Mini']
const QWEN = ['qwen-2.5-1.5b', 'Qwen 2.5 1.5B']

const glacier = chat('demo-glacier', PROMPT, LLAMA, 'Default', 0.2, PROMPT, REPLY)

const history = [
  glacier,
  chat(
    'demo-quiz',
    'Quiz me on the water cycle',
    LLAMA,
    'Tutor',
    21,
    'Quiz me on the water cycle.',
    'Let us take it one step at a time.\n\n**Question 1.** What is it called when water turns from liquid into vapour?',
  ),
  chat(
    'demo-pack',
    'Packing list for a three-day trek',
    LLAMA,
    'Friendly',
    27,
    'Give me a packing list for a three-day trek.',
    "Happy to help! Here's a simple list:\n\n- A warm layer and a rain shell\n- Two pairs of wool socks\n- Water bottle and a head torch\n- A small first-aid kit",
  ),
  chat(
    'demo-csv',
    'Sum a column in a CSV file',
    PHI,
    'Concise',
    52,
    'Python: read a CSV and sum the "amount" column.',
    '```python\nimport csv\n\nwith open("data.csv") as f:\n    total = sum(float(row["amount"]) for row in csv.DictReader(f))\n\nprint(total)\n```',
  ),
  chat(
    'demo-mail',
    'Follow-up email about a booking',
    LLAMA,
    'Professional',
    76,
    'Draft a polite follow-up email about my booking.',
    'Dear Sir or Madam,\n\nI am writing to confirm my reservation for two nights. Could you please let me know whether it is still held?\n\nKind regards',
  ),
  chat(
    'demo-tea',
    'Names for a roadside tea stall',
    QWEN,
    'Creative',
    124,
    'Help me name a roadside tea stall.',
    'A few to try:\n\n- **Last Signal Chai**\n- **The Switchback**\n- **Kettle & Pass**',
  ),
]

/** `conversations`: omit for the full demo history, `'demo'` for the glacier chat alone, or `[]` for none. */
export function seed({ theme = 'obsidian', installed = [LLAMA[0], PHI[0], QWEN[0]], character = 'preset:default', conversations } = {}) {
  const list = conversations === 'demo' ? [glacier] : (conversations ?? history)
  return {
    settings: {
      wifi_only: true,
      save_history: true,
      show_speed: true,
      system_prompt: '',
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 512,
      font_size: 'medium',
      theme,
      onboarding_done: true,
      last_model_id: installed[0] ?? null,
      active_character_id: character,
      custom_characters: [],
    },
    conversations: Object.fromEntries(list.map((c) => [c.id, c])),
    installed,
    partial: {},
  }
}
