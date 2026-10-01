# 3D athletes

The portal now uses genuine 3D geometry and textured skin. These are reusable generic adults, not scans of the listed athletes. The marketing hero is unchanged.

## What ships

- Male and Female avatar choices, each with lean and strong morph targets plus an athletic base. Legacy neutral profiles migrate to the Male preset; the old neutral asset remains for compatibility. Six skin tones and five kit colors are stored in the existing profile configuration.
- Seven race outfit configurations assembled from fitted garment meshes. Tattoos use exposed skin; kit logos use garment surfaces. The model changes with each race's outfit.
- Three.js rotation, keyboard controls, zoom, front/back reset, surface-projected sponsor text and PNG/JPEG/WebP artwork, and a clean model view without floating placement markers or an icon toolbar. Select placements from the list; drag to rotate and scroll/pinch to zoom.
- Static WebP outfit previews in discovery, a lazy-loaded viewer on detail/editor screens, shared model/texture caching, one canvas per studio, render-on-change when lights are paused, and cleanup on navigation. Background lights animate at up to 30 fps only while visible; no tracking.
- Poster/error fallback if WebGL or assets fail. Placement lists remain usable. Draft logos stay local until requested; submitted logos persist with requests and appear together on approved race previews.

The geometry is normalized to a 1.75 m template for placement consistency. Gender is chosen explicitly as Male or Female. Height and weight are optional profile measurements; they do not yet resize the template. Age and ethnicity are not collected or inferred. Appearance does not alter pricing. Preview logos are approximate; final size, visibility, event rules and artwork remain an athlete/sponsor agreement. The tri-suit and wetsuit represent coverage, not a particular manufacturer's garment. Discovery posters show a standard build, skin tone and kit, rather than every profile variation.

## Scale

Thousands of profiles reuse three GLBs and shared textures; there is no model export per athlete or per race. Each GLB is under 2 MB. Directory posters are under 100 KB each. Vercel serves versioned assets with immutable caching. Three.js and the model assets are requested only for a studio, not for a directory full of athletes. These budgets are enforced by tests. This architecture supports a large athlete catalog; it is not a traffic/load-test result.

The refined library ships in `v2`: subdivided bodies and garments, garment vertices fitted to each body morph, broader build differences, and restrained chest/abdominal definition. Meshopt keeps the higher detail below the 2 MB geometry budget. Keep immutable `v1` and `v2` files fixed after release. Future asset changes go in a new version directory and update `avatarAssetRoot`. `npm run build` copies the prebuilt assets; it does not run Blender. The retained legacy Worker needs an `ASSETS` static binding to serve `/assets/athletes/`; Vercel and the local preview serve these directly.

## Rebuilding the library

Sources and license: `assets/athletes/ATTRIBUTION.md` and `sources.json`. The MPFB base and targets are pinned to a Git commit. MakeHuman's system asset archive contains the separately released CC0 art assets. The archive's source hash is recorded in the manifest.

Use official Blender 4.5 LTS and run:

```sh
node scripts/prepare-athletes.mjs /tmp/athleet-source /path/to/Blender
npm test
```

The authoring command downloads approximately 267 MB of sources into the temporary directory, fits the mesh/proxies, builds clothes, exports GLBs without duplicate embedded textures, renders posters and converts them to WebP. Sources and Blender are not deployed. Inspect front/back coverage and all templates after changing geometry. The automated raycast test verifies all 1,008 placements across 63 presentation/build/outfit combinations, including skin/kit material correctness.

## Personal scans: next phase

A scan upload service is not included in this release. To offer Marc-style personal likenesses, add an opt-in pipeline:

1. Capture with Polycam or another photogrammetry tool, with a relaxed A pose and the exact race outfit. Receive the textured mesh privately. Quality depends on lighting, capture coverage, movement and reflective fabrics; a fixed photo count is not a quality guarantee.
2. Queue background jobs for validation, mesh cleanup/retopology, texture baking, size reduction and GLB export. Human review is still needed for bad captures and unusual outfits. Treat uploaded model files as untrusted inputs.
3. Fit the placement anchors, review skin/garment labels, and generate thumbnails. Require the athlete's approval before publishing. A scan in one outfit does not provide interchangeable clothing automatically.
4. Store optimized public derivatives on object storage/CDN with signed upload URLs, per-athlete ownership, deletion controls, consent and retention rules for private originals.

Aim initially for 30–60k triangles, 1–2K texture maps and a 2–5 MB mobile derivative; tune against real target phones. Use Meshopt as in the generic library; evaluate KTX2 when texture measurements justify it. Do not ask every athlete to supply 300 photos: generic avatars remain the default; personal scans should be an optional premium workflow.

## Portrait face preview (beta)

In Athlete portal → My profile, upload a front-facing JPG, PNG or WebP portrait (up to 8 MB, 32 MP), align its eyes/chin in the crop dialog and choose Apply to avatar. The Face / Full body tabs help inspect the result. Adjustment and removal are supported. Preview clothing is saved with avatar preferences and used as the starting outfit for new races; each race still has its own final outfit.

The portrait is baked into the body's existing UV texture. Hair is fitted directly onto the scalp texture, with a conservative sampled-color continuation on the unseen rear. There is no floating hair card or face decal. Existing eyes use the same photograph through projected UVs, without a second eye surface. Eye normals remain authored; body normals are recomputed after continuous muscle relief, and face/body share one skin material and lighting response.

On-device segmentation removes photo background/clothing, isolates hair, and samples cheek color. The body texture is matched to that sample. Overall skin brightness adjusts both the baked face and body together; 0 keeps the input colors. Skin preset swatches are disabled while a photo is applied, because the photo supplies its skin color. A manual cheek sample is available for difficult lighting.

This remains texture personalization of a generic head. It does not reconstruct facial geometry, long strands, hairstyle volume, or unseen details. Hair length is retained as a preference, but long hair is fitted to the scalp in this preview. Smiles, pose and baked-in photo lighting can still distort the likeness. Accurate all-angle likeness requires a scan or a dedicated reconstruction pipeline.

The local segmentation model (approximately 16 MB) and WASM runtime (approximately 11 MB for the selected browser variant) load only on the first Apply, then use immutable browser caching. These shared assets are not loaded by normal discovery or generic avatar use. Source and Apache 2.0 license are in `assets/vision/`. CPU segmentation can briefly occupy the main thread; low-memory mobile quality/performance needs device testing before a production photo rollout.

The portrait and cropped texture remain in document memory/blob URLs. They are not sent to an API, written into profile JSON, saved to browser storage or shown to sponsors. They survive navigation inside the athlete portal but disappear on reload, sign-out or closing the tab. Save profile persists only gender/build/skin/kit/outfit/environment preferences. This private beta is ready for evaluating portrait fit before implementing consented storage and publication.

Implementation references: [Canvas image cropping](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage) and [Three.js surface decals](https://threejs.org/docs/pages/DecalGeometry.html).

## Three-view likeness preview (experimental)

My profile → Create my likeness guides an athlete through front and left/right profile photos. Use a neutral expression, gently closed lips, consistent diffuse lighting and a whole-head crop. Each photo has a separate slot, replacement, flip control, and alignment review. The front view gets local MediaPipe landmark suggestions; profiles require manually placed visible-eye, nose, mouth, chin and ear points. Keyboard X/Y fields accompany point picking. All three views must be reviewed, and identical source files are rejected across slots.

The renderer now performs bounded template fitting: front landmarks adjust feature spacing, cheeks and facial proportions; the two profiles constrain nose, mouth and chin depth. Smooth local deformations are capped at 18 mm and fade out above the neck. Eyes deform with the head. This is a sparse, landmark-based fit, not photogrammetry or a learned reconstruction of the person's full head. Camera similarity fits search around the requested view angles; large residuals produce an actionable alignment error.

Each segmented photo is balanced to the front photo's median skin sample. Camera-facing weights blend all three views into the fitted body's UV texture. Low-resolution visibility buffers prevent projecting a nearer nose or ear onto a hidden surface. Existing body and kit geometry stay unchanged; only the private preview's body/eye geometry is cloned and fitted. Removing the portrait restores the original shared geometry. Unseen rear scalp color remains an estimate; hair volume and long strands are not reconstructed.

The editor lazily loads the local Face Landmarker bundle (about 3.6 MB) and existing segmentation runtime. Photos are bounded to 1200 pixels on the long edge for processing. Originals, landmarks and derivatives remain in tab memory, are not stored with profiles or sent to a service, and disappear on reload/sign-out/removal. Closing the dialog cancels an in-progress build; an already applied preview stays intact on failed replacement. Draft photos can be revisited within the tab.

Validation includes synthetic multi-camera geometry/visibility tests and a browser run with neutral rendered views. Real athlete-photo likeness and mobile performance still need pilot validation; do not advertise scan-level photorealism or persist/publish this private experimental result automatically.


## Anatomical placements and scenes

Male profiles offer left/right pectorals; female profiles offer a single upper chest/cleavage position. Both offer shoulders, upper arms, forearms, thighs and calves on each side, buttocks and upper back. Left/right refers to the athlete. Existing front-torso placements remain compatible. Clothing determines whether a location uses skin or kit. Raycasts follow each build’s visible surface; all 16 current/legacy anchors are checked across 63 asset/build/outfit combinations.

The runtime bakes the chosen morph into a private geometry clone and adds restrained continuous pectoral/abdominal relief to body and clothing together. Fresh floating-point normals avoid quantized-normal lighting errors; UV seam normals are averaged. Shared assets remain unchanged. This improves definition, not identity reconstruction.

Available inventory appears as surface-attached labels in the placement editor. Sponsor artwork uses simultaneous surface decals: confirmed logos plus the active proposal. JPG/PNG/WebP uploads are normalized to PNG; see SETUP.md for storage and access rules. If artwork cannot be loaded, the preview falls back to brand text. Dimensions remain illustrative.

The sci-fi arena is now the only environment, including for profiles with an older saved background. Cyan, violet, pink and amber rails, traveling pulses and rotating platform arcs animate at up to 30 fps. Animation stops offscreen or in hidden tabs, honors reduced-motion preferences, and has a Play/Pause lights control. Geometry and animation resources are disposed on navigation. The stylized background does not imply race location, conditions or permitted advertising. Accurate Marc-style full-body likeness remains dependent on a captured and optimized personal scan; face photos do not capture the person’s body.
