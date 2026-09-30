# 3D athletes

The portal now uses genuine 3D geometry and textured skin. These are reusable generic adults, not scans of the listed athletes. The marketing hero is unchanged.

## What ships

- Male and Female avatar choices, each with lean and strong morph targets plus an athletic base. Legacy neutral profiles migrate to the Male preset; the old neutral asset remains for compatibility. Six skin tones and five kit colors are stored in the existing profile configuration.
- Seven race outfit configurations assembled from fitted garment meshes. Tattoos use exposed skin; kit logos use garment surfaces. The model changes with each race's outfit.
- Three.js rotation, keyboard controls, zoom, front/back reset, surface-projected sponsor text and PNG/JPEG/WebP artwork, and a clean model view without floating placement markers or an icon toolbar. Select placements from the list; drag to rotate and scroll/pinch to zoom.
- Static WebP outfit previews in discovery, a lazy-loaded viewer on detail/editor screens, shared model/texture caching, one canvas per studio, render-on-change, and cleanup on navigation. No automatic animation or tracking.
- Poster/error fallback if WebGL or assets fail. Placement lists remain usable. Uploaded logos stay in the current browser session.

The geometry is normalized to a 1.75 m template for placement consistency. Gender is chosen explicitly as Male or Female. Height, weight, age and ethnicity are not collected or inferred. Appearance does not alter pricing. Preview logos are approximate; final size, visibility, event rules and artwork remain an athlete/sponsor agreement. The tri-suit and wetsuit represent coverage, not a particular manufacturer's garment. Discovery posters show a standard build, skin tone and kit, rather than every profile variation.

## Scale

Thousands of profiles reuse three GLBs and shared textures; there is no model export per athlete or per race. Each GLB is under 2 MB. Directory posters are under 100 KB each. Vercel serves versioned assets with immutable caching. Three.js and the model assets are requested only for a studio, not for a directory full of athletes. These budgets are enforced by tests. This architecture supports a large athlete catalog; it is not a traffic/load-test result.

Keep the immutable `v1` files fixed after release. Future asset changes go in a new version directory and update `avatarAssetRoot`. `npm run build` copies the prebuilt assets; it does not run Blender. The retained legacy Worker needs an `ASSETS` static binding to serve `/assets/athletes/`; Vercel and the local preview serve these directly.

## Rebuilding the library

Sources and license: `assets/athletes/ATTRIBUTION.md` and `sources.json`. The MPFB base and targets are pinned to a Git commit. MakeHuman's system asset archive contains the separately released CC0 art assets. The archive's source hash is recorded in the manifest.

Use official Blender 4.5 LTS and run:

```sh
node scripts/prepare-athletes.mjs /tmp/athleet-source /path/to/Blender
npm test
```

The authoring command downloads approximately 267 MB of sources into the temporary directory, fits the mesh/proxies, builds clothes, exports GLBs without duplicate embedded textures, renders posters and converts them to WebP. Sources and Blender are not deployed. Inspect front/back coverage and all templates after changing geometry. The automated raycast test verifies all 378 placements across 63 presentation/build/outfit combinations, including skin/kit material correctness.

## Personal scans: next phase

A scan upload service is not included in this release. To offer Marc-style personal likenesses, add an opt-in pipeline:

1. Capture with Polycam or another photogrammetry tool, with a relaxed A pose and the exact race outfit. Receive the textured mesh privately. Quality depends on lighting, capture coverage, movement and reflective fabrics; a fixed photo count is not a quality guarantee.
2. Queue background jobs for validation, mesh cleanup/retopology, texture baking, size reduction and GLB export. Human review is still needed for bad captures and unusual outfits. Treat uploaded model files as untrusted inputs.
3. Fit the placement anchors, review skin/garment labels, and generate thumbnails. Require the athlete's approval before publishing. A scan in one outfit does not provide interchangeable clothing automatically.
4. Store optimized public derivatives on object storage/CDN with signed upload URLs, per-athlete ownership, deletion controls, consent and retention rules for private originals.

Aim initially for 30–60k triangles, 1–2K texture maps and a 2–5 MB mobile derivative; tune against real target phones. Add Meshopt/KTX2 only when measurements show a benefit. Do not ask every athlete to supply 300 photos: generic avatars remain the default; personal scans should be an optional premium workflow.

## Portrait face preview (beta)

In Athlete portal → My profile, upload a front-facing JPG, PNG or WebP portrait (up to 8 MB, 32 MP), align its eyes/chin in the crop dialog and choose Apply to avatar. The Face / Full body tabs help inspect the result. Adjustment and removal are supported. Preview clothing is saved with avatar preferences and used as the starting outfit for new races; each race still has its own final outfit.

This is local photo projection onto the existing head and eye meshes, with an oval feathered edge. It does not generate head geometry, change hair, infer gender/ethnicity or reconstruct a full body. A side-facing photo will distort. Choose a matching skin swatch to reduce the boundary contrast. An accurate personal likeness still requires a scan or a dedicated head-reconstruction pipeline.

The portrait and cropped texture remain in document memory/blob URLs. They are not sent to an API, written into profile JSON, saved to browser storage or shown to sponsors. They survive navigation inside the athlete portal but disappear on reload, sign-out or closing the tab. Save profile persists only gender/build/skin/kit/outfit preferences. This private beta is ready for evaluating portrait fit before implementing consented storage and publication.

Implementation references: [Canvas image cropping](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage) and [Three.js surface decals](https://threejs.org/docs/pages/DecalGeometry.html).
