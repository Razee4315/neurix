# Neurix site

The marketing site for Neurix. It lives entirely in this folder and has its own build; it does not import
anything from the app.

## Run it

```bash
npm install
npm run dev        # http://localhost:5183
```

```bash
npm run build      # writes dist/
npm run preview    # serves dist/ on http://localhost:5184
```

Every URL in the build is relative, so `dist/` works from a domain root or from any sub-path.

## Deploy

`.github/workflows/site.yml` builds this folder and publishes `dist/` to GitHub Pages whenever a push to
`main` changes something under `website/` (or when the workflow is run by hand). The app's Release workflow
ignores changes under `website/`, so updating the site does not publish a new app version.

## What is on the page

| Section | What it shows | Real or generated |
| --- | --- | --- |
| The climb | The signal meter empties as you scroll up through the cloud; the phone is asked a question and answers | Phone: the app's own rendered chat screen. Landscape, cloud, grass, lights: generated |
| Models | The eight models as mineral specimens, smallest file first, with depth of field | Names, makers, sizes and "best for" come from the app's catalogue. Stones: generated |
| Privacy | A tent at night; a lamp of moonlight follows the pointer | Generated (two aligned exposures of one frame) |
| Themes and characters | The app's ten themes re-light one view; six built-in characters | Phone: live, with the app's real theme colours, greetings and starters. Ten exposures: generated |
| Also in the app | Store, history search, model manager, characters, character editor, backup | Real screenshots. Objects around the phone: generated |
| Why it exists | Three sentences quoted from the app's README | Photograph: generated |
| Download | Links to the GitHub releases page | Photograph: generated |

## How the real interface gets here

`tools/capture.mjs` drives Chrome against the app's own dev server (`npm run dev` in the app folder, port
1420), which runs the UI on its built-in mock backend. It produces:

- `captures/*.png`: screenshots at 390 x 844, 3x.
- `src/app/snapshot.json`: the chat screen's rendered HTML and CSS in several states (empty chat for each
  character, question typed, thinking, answered). `src/lib/phone.js` replays these inside a shadow root, so
  the phone on the site is the real markup and styles, not a drawing. Themes are applied the way the app
  applies them, by setting its `--c-*` colour variables.

`tools/sync-themes.mjs` copies the ten theme definitions from the app into `src/app/themes.json`.

Everything on screen in those captures is the demo data in `tools/seed.mjs`. The chat reply is scripted
there; it is not model output.

```bash
npm run capture          # needs the app's dev server on :1420
npm run images:process   # captures + raw images -> public/img/*.webp
```

## How the generated images get here

`tools/manifest.mjs` holds every prompt, grouped into families that share one art-direction block.
`tools/generate.mjs` sends each one to its own `codex exec` session, reads the session id from the log and
copies the PNG out of `~/.codex/generated_images/<session>/` into `assets-raw/`.

```bash
npm run images                     # everything missing, 16 sessions at a time
npm run images -- valley stone-3   # only these
npm run images -- --force --c=20
npm run images:process             # trim, resize, blur twins, WebP, src/img-meta.json
```

`tools/process.py` (Python with Pillow and NumPy) also bakes every blur: each depth-of-field effect on the
page is a cross-fade between a sharp file and its pre-blurred `-soft` twin, so no filter is ever animated.
Cloud and bokeh are generated on black and converted to transparency there.

## Code map

```
index.html            all copy and structure
src/main.js           wires the scenes together
src/lib/engine.js     one loop: scroll (Lenis), pointer, time; easing; transform/opacity writers
src/lib/phone.js      the phone: live snapshot or screenshots
src/lib/signal.js     the signal meter
src/scenes/*.js       one file per section
src/styles/main.css   all styles, including the phone layout and reduced motion
src/app/              data taken from the app: snapshot, themes, model catalogue
tools/                capture, generate, process, plus review helpers (inspect, interact, perf)
```

Only `transform` and `opacity` are animated. With "reduce motion" on, smooth scrolling, parallax, drift
and the typed reply are switched off and every state is still reachable.
