// Every generated image on the site, as a prompt. Prompts describe visuals only: no interface, no text.
// One Codex session per entry (an entry with `steps` is one session that makes an aligned series).

/* ── Shared art direction ─────────────────────────────────────────────── */

// The palette follows the app's default theme: near-black, glacier cyan, one warm apricot edge.
const PHOTO =
  'Style: a real landscape photograph taken in the Karakoram mountains of northern Pakistan on a medium-format camera ' +
  'with a 50mm lens. Deep blue-black shadows, pale glacier-cyan light on snow, ice and water, and at most one thin warm ' +
  'apricot accent. Calm, still, very clean and uncluttered, soft low contrast in the shadows, fine natural film grain. ' +
  'True to life: not HDR, not oversaturated, not a painting, not a 3D render, no fantasy elements. ' +
  'Constraints: no people, no animals, no vehicles, no text, no signs, no watermark, no border, no lens flare.'

const SPECIMEN =
  'Style: photorealistic museum mineral-specimen photograph, 100mm macro lens, focus-stacked so the whole specimen is ' +
  'crisp, one soft key light from the upper left and a faint cool rim light from the right, true-to-life colour, fine ' +
  'natural detail (growth striations, tiny inclusions, small fractures, crisp crystal edges). The crystals are ' +
  'translucent gem material but read as solid objects with full body colour. Not illustrated, not a 3D render, not ' +
  'plastic, not glowing, no sparkles, nothing magical. ' +
  'Composition: the specimen alone, floating upright in mid-air, entirely inside the frame with a clear empty margin on ' +
  'every side. Background: genuinely transparent (real alpha channel): no backdrop, no surface, no stand, no cast shadow, ' +
  'no reflection. Constraints: no text, no label, no logo, no watermark, no hands, no other props.'

const CUTOUT =
  'Style: a real photograph, 85mm lens, crisp focus across the whole subject, cold blue-hour light from the upper left ' +
  'with soft shadows, muted natural colour that sits well against a blue-black night scene. Not illustrated, not a 3D render. ' +
  'Background: genuinely transparent (real alpha channel): no backdrop, no sky, no ground plane, no cast shadow. ' +
  'Constraints: no text, no logo, no watermark, no people, no hands, no other props.'

// Soft things (cloud, snow, light) are shot on pure black; process.py turns brightness into transparency.
const ON_BLACK =
  'Style: a real photograph against a perfectly uniform pure black background (#000000) that fills the whole frame; the ' +
  'subject is lit softly from the upper left in cool white with a faint cyan tint, and fades smoothly into the black at ' +
  'all of its edges. Nothing touches the edge of the frame. Constraints: no ground, no horizon, no stars, no text, no ' +
  'watermark, no border, no vignette.'

const plate = (id, scene, aspect = 'wide landscape 16:9') => ({ id, aspect, prompt: `Scene: ${scene}\n${PHOTO}` })
const stone = (id, subject) => ({ id, aspect: 'square 1:1', alpha: true, prompt: `Subject: ${subject}\n${SPECIMEN}` })
const cutout = (id, subject, aspect = 'landscape 3:2') => ({ id, aspect, alpha: true, prompt: `Subject: ${subject}\n${CUTOUT}` })
const soft = (id, subject, aspect = 'landscape 3:2') => ({ id, aspect, prompt: `Subject: ${subject}\n${ON_BLACK}` })

/* ── The climb (hero) ─────────────────────────────────────────────────── */

const climb = [
  plate(
    'valley',
    'Blue hour, looking down and across a very broad high-mountain valley from a slope high above it. A braided silver ' +
      'river winds over a flat sandy valley floor far below. Beside the river, left of centre, a small scattered town shows ' +
      'only as a few dozen tiny warm lights. Dark layered rock ridges recede on both sides, and behind them stand enormous ' +
      'snow-covered granite peaks; only the very highest summit still holds a thin edge of warm last light. The bottom ' +
      'quarter of the frame is plain dark slope in shadow. The top quarter is clear, darkening blue sky with two or three early stars.',
  ),
  plate(
    'cloudsea',
    'Night, seen from a high mountain shoulder far above the weather. A vast, flat, unbroken sea of cloud fills the lower ' +
      'half of the frame and stretches to the horizon, softly lit pale cyan-silver by moonlight from the upper left. A few ' +
      'sharp dark granite spires and snow peaks rise through the cloud in the middle and far distance. Above, a deep ' +
      'blue-black sky, perfectly clear, full of fine sharp stars with a faint band of the Milky Way. The bottom fifth of the frame is cloud only.',
  ),
  plate(
    'dawn',
    'First light, seen from a high mountain shoulder above a flat sea of cloud that fills the lower half of the frame. ' +
      'Sharp granite spires and snow peaks rise through the cloud. The sky is still deep blue overhead, paling to a clear ' +
      'cold turquoise at the horizon, and the first sunrise paints a narrow warm apricot edge on the tops of the highest ' +
      'peaks only. Everything else is cool blue shadow. The last few stars are fading.',
  ),
  plate(
    'road',
    'Dusk on an empty, narrow mountain highway cut into a steep rock slope high above a grey-green glacial river gorge. ' +
      'The road enters from the bottom right and curves away along the cliff into the distance, with a low stone parapet ' +
      'on its outer edge. Huge bare rock walls on both sides, a far snow peak at the head of the gorge catching a faint ' +
      'warm last light. The left third of the frame is dark, plain rock face in shadow.',
    'landscape 3:2',
  ),
]

const atmosphere = [
  soft('mist-1', 'One long, low bank of mountain mist: a wide horizontal drift of soft cloud with wispy, torn, feathered edges.', 'wide 16:9'),
  soft('mist-2', 'One tall, billowing mass of soft cloud rising like the top of a cumulus, with detailed rounded lobes and thin trailing wisps at its sides.'),
  soft('mist-3', 'Thin, stretched veils of high mountain fog, like smoke pulled sideways by wind: several delicate translucent streaks.', 'wide 16:9'),
  soft('mist-4', 'A dense, soft, rounded cloud seen from very close, almost featureless in the middle with gently curling edges.'),
  soft(
    'snow',
    'Sparse falling snow at night caught in a beam of light: about forty small snowflakes scattered evenly across the ' +
      'frame, most of them softly out of focus as small pale discs of different sizes, a few sharp. Lots of empty black between them.',
    'square 1:1',
  ),
  soft(
    'lights',
    'Out-of-focus points of light at night (photographic bokeh): about fifteen soft round discs of different sizes scattered ' +
      'loosely in a rough horizontal band, most of them warm amber, three or four pale cyan. Lots of empty black around them.',
    'wide 16:9',
  ),
]

const foreground = [
  cutout(
    'grass',
    'A clump of dry, pale golden-grey mountain grass and a few thin bare twigs, growing upward from the bottom edge of the ' +
      'frame, seen from the side at ground level. The stems fan out and end in fine feathery seed heads. The clump is cut off by the bottom edge of the frame.',
  ),
  cutout(
    'boulder',
    'A single large, rough, weathered granite boulder with patches of pale lichen and a little fresh snow resting in its ' +
      'hollows, seen from the side. The whole boulder is inside the frame with empty margin around it.',
  ),
  cutout(
    'branch',
    'One slender bare apricot tree branch reaching diagonally across the frame from the upper right corner, carrying a ' +
      'few clusters of small white and very pale pink blossoms and some unopened buds. Fine dark twigs.',
  ),
  cutout(
    'cairn',
    'A small trail cairn: six flat grey river stones balanced in a neat stack, the largest at the bottom, with a dusting of ' +
      'frost. The whole stack is inside the frame with empty margin around it.',
    'portrait 2:3',
  ),
  cutout(
    'ridge',
    'A jagged snow-dusted rock outcrop, like the crest of a ridge seen from close by, rising from the bottom edge of the ' +
      'frame and cut off by it. Dark granite, wind-packed snow in its cracks. It is widest at the bottom and has an uneven, spiky top edge.',
    'wide 16:9',
  ),
]

/* ── Models as mineral specimens, smallest file to largest ────────────── */

const stones = [
  stone('stone-1', 'One small, slender, water-clear quartz crystal point with a sharp six-sided tip. Very simple, very small in character.'),
  stone('stone-2', 'One single pale sky-blue aquamarine crystal: a clean six-sided prism with a flat top, slightly longer than it is wide.'),
  stone('stone-3', 'Two pale blue aquamarine prism crystals of unequal length grown together side by side.'),
  stone('stone-4', 'One pale blue aquamarine prism crystal standing on a small base of blocky white feldspar.'),
  stone(
    'stone-5',
    'A small cluster of three pale blue aquamarine prism crystals of different heights on white feldspar, with a few thin silvery mica plates at the base.',
  ),
  stone(
    'stone-6',
    'A hand-sized cluster of clear and lightly smoky quartz points growing in several directions, with one pale blue aquamarine prism among them.',
  ),
  stone(
    'stone-7',
    'A larger specimen: five or six long pale blue aquamarine prisms rising from a rough matrix of white feldspar, silvery mica and a few thin black tourmaline needles.',
  ),
  stone(
    'stone-8',
    'A large, heavy cabinet specimen: a dense group of many pale blue aquamarine prisms and clear quartz points on a broad ' +
      'matrix of white feldspar, silvery mica books and black tourmaline. Rich and complex, clearly the biggest of a collection.',
  ),
]

/* ── One place in ten lights: the app's ten themes ────────────────────── */

const SAME = 'Same place, same camera, same framing as STEP 1. Change only the light, the season and the weather: '

const themes = {
  id: 'world',
  aspect: 'wide landscape 16:9',
  steps: [
    'Scene: a small, perfectly still alpine lake on a wide, flat high plateau, seen from a low viewpoint on its near ' +
      'shore. The near shore runs along the bottom of the frame: bare ground with scattered rounded stones. Beyond the ' +
      'lake, low rolling hills, and behind them one distinctive, steep, snow-covered pyramid peak standing left of centre, ' +
      'with a lower ridge trailing to the right. Light: a clear moonless night; the sky is almost black with fine stars; ' +
      'faint cold cyan starlight outlines the snow on the peak and reflects in the lake. Very dark, very quiet.\n' +
      PHOTO,
    SAME +
      'a clear night under a deep navy sky with soft, wide veils of violet and purple light high in the sky, their violet glow reflected in the lake and tinting the snow.',
    SAME +
      'the last minutes before sunrise. Everything is cold glacier blue, the sky a clear steel blue, and the first orange sunlight touches only the very tip of the peak.',
    SAME +
      'high summer at late dusk. The hills and the near shore are covered in short dark green meadow grass scattered with small golden-yellow wildflowers; the peak keeps a little snow; the sky is a deep green-tinged blue. Still dark and moody.',
    SAME +
      'night, with the near shore and its stones lit from just outside the bottom of the frame by the low warm orange glow of campfire embers. The rest fades into warm brown-black darkness; the peak is a dim silhouette.',
    SAME +
      'dusk in spring. The sky is deep plum purple with a pink afterglow on the snow of the peak, the lake reflects pink, and a few pale pink blossom petals lie on the stones of the near shore.',
    SAME +
      'the darkest possible night. The frame is almost entirely pure black; only the faintest grey outline of the peak, a thin pale line where the lake meets the far shore, and a handful of stars can be made out.',
    SAME +
      'a bright, clear, cold midday. A pale blue-white sky, brilliant snow on the peak and patches of snow on the hills, the lake a light glacial blue. Bright, airy and high-key, with cool daylight colours.',
    SAME +
      'a warm, soft morning in autumn. A pale cream sky, low apricot trees with orange leaves standing along the far shore, warm light on the hills, the snow on the peak tinted cream. Bright, gentle and high-key, the colour of warm paper.',
    SAME +
      'a still, overcast winter day. A plain white sky, fresh snow covering the hills and the near shore, the lake dark grey, the peak pale against the cloud. Nearly monochrome, bright and quiet.',
  ],
}

/* ── Private: one tent, two exposures ─────────────────────────────────── */

const tent = {
  id: 'camp',
  aspect: 'wide landscape 16:9',
  steps: [
    'Scene: a single small dome tent pitched on a dark, stony high plateau at night, placed right of centre and fairly ' +
      'small in the frame. The tent glows softly from a light inside it, a cool white with a hint of cyan, and that glow ' +
      'falls a short way onto the stones around it. Everything else is nearly black: a low dark ridge line, a faint snow ' +
      'peak far behind, and a clear sky with fine stars. The left half of the frame is dark, empty plateau.\n' +
      PHOTO,
    'Same place, same camera, same framing as STEP 1, the tent still glowing exactly as before. Change only the ambient ' +
      'light: bright moonlight now reveals the whole plateau, every stone on the ground, the ridge and the snow peaks behind in cool blue-silver detail.',
  ],
}

/* ── Field kit: small carried objects, used the way a site would use icons ── */

const KIT =
  'Style: photorealistic product photograph of a small, well-used piece of trekking kit, 85mm macro lens, the whole ' +
  'object crisp, one soft key light from the upper left and a faint cool rim light from the right, muted natural ' +
  'materials and colours. Not illustrated, not a 3D render, not glossy plastic. ' +
  'Composition: the object alone, floating in mid-air at a slight tilt, entirely inside the frame with a clear empty ' +
  'margin on every side. Background: genuinely transparent (real alpha channel): no backdrop, no surface, no cast ' +
  'shadow, no reflection. Constraints: absolutely no letters, numbers, words, engraving, brand marks or logos anywhere ' +
  'on the object; no watermark, no hands, no other props.'

const item = (id, subject) => ({ id, aspect: 'square 1:1', alpha: true, prompt: `Subject: ${subject}\n${KIT}` })

const kit = [
  item('kit-compass', 'A small round brass pocket compass with its hinged lid open. The dial is plain: a red-tipped needle over simple tick marks, with no letters and no numbers.'),
  item('kit-lantern', 'A small collapsible camping lantern, switched on, its frosted globe glowing a soft cool white, with a dark metal top and a wire handle.'),
  item('kit-notebook', 'A small, worn black leather pocket notebook held shut with an elastic band, a short wooden pencil tucked under the band. Blank cover.'),
  item('kit-padlock', 'A small solid brass padlock with a steel shackle, closed, lightly scratched from use. Completely plain body.'),
  item('kit-carabiner', 'A single matte dark-grey aluminium climbing carabiner with a screw gate, closed, slightly scuffed. Completely plain.'),
  item('kit-mug', 'A dented off-white enamel camping mug with a dark blue rim and a few chips in the enamel. Empty, plain.'),
  item('kit-headlamp', 'A compact trekking headlamp with a plain black elastic strap, its single lens glowing a soft cool white.'),
  item('kit-plane', 'A paper aeroplane neatly folded from one sheet of plain off-white paper, seen from the side and slightly above, crisp folds, blank paper.'),
]

export const assets = [...climb, ...atmosphere, ...foreground, ...stones, themes, tent, ...kit]
