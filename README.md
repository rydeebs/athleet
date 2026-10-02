# enduur

An endurance athlete sponsorship marketplace with a preserved marketing homepage, separate athlete and sponsor portals, outfit-aware placement previews, and a live social-audience estimator.

## Run

Use Node.js 22. `npm run dev` builds and runs a local server at http://localhost:4174. `npm run build` emits static assets in `dist/public` for Vercel and a legacy Worker in `dist/server/index.js` (3D assets require a static `ASSETS` binding outside Vercel). `npm test` builds both outputs and runs the scraper, API, and deployment tests.

## Deploy on Vercel

1. Import the GitHub repository `rydeebs/athleet` into Vercel.
2. Use the repository root as the Root Directory and **Other** as the Framework Preset.
3. Deploy. `vercel.json` supplies the build command (`npm run build`), output directory (`dist/public`), and a 30-second limit for the Node.js `/api/audience` function. `package.json` selects Node.js 22.

No environment variables or API keys are required for the existing public-profile lookups or the labeled portal demo. Real accounts and shared listings require the Supabase setup in [SETUP.md](SETUP.md). Only browser assets are copied to the public output; server code, tests, and hosting metadata are not served as static files. `/api/audience` uses Vercel's client-IP header and shares its validation and lookup behavior with the Sites Worker. Entry scripts are revalidated after updates; hashed chunks and versioned 3D assets use immutable caching.

The Sites sign-in gate does not transfer to Vercel. Choose Vercel Deployment Protection settings if you want restricted access. The in-memory rate limiter is best-effort per running function instance, not a distributed quota; configure Vercel Firewall or a shared store if stronger public-traffic enforcement is needed.

After deployment, check `/`, add a mixed-race package, and calculate an audience from a public handle. Social sites can block the Vercel hosting IP just as they can block other hosting providers; successful local tests do not guarantee every profile is readable in production. Instagram remains best-effort, and blocked accounts show an error instead of a fabricated total.

## Sponsor product page

`/for-sponsors` presents the race-weekend package for brand buyers: athlete placement, optional Race-day digital follow, example pricing and a season offer. Homepage sponsor links lead here; `/sponsors` remains the workspace. The page uses illustrative inventory and explicitly labels digital follow, category locks and managed payment release as proposed. None of those services or checkout flows is implemented by this page.

The season CTA currently opens a device-local brief generator, with an explicit notice that enquiries are not connected. Configure a real contact email, booking destination or intake endpoint before treating it as a sales enquiry channel. The generated brief is downloaded only and is never submitted.

## Race packages

One race, multi-race, and full-season packages support up to 12 events. Road running, trail/ultramarathon, triathlon, HYROX, cycling, and custom endurance events each have distances/formats. Per-event names, dates, locations, participant estimates, and finish bands appear in the brand-facing pass and downloadable brief.

## Public follower lookups

POST `/api/audience` accepts up to five `{platform, handle}` records. Instagram, TikTok, YouTube, and Threads use public profile metadata, with Jina Reader as a fallback. X uses the public FxTwitter profile endpoint, with a browser CORS fallback when the shared hosting IP is blocked. No credentials or social login are collected. Only allowlisted platform URLs are requested. Identity checks, timeouts, response-size caps, validation, and a bounded per-instance limiter are included. The existing Sites access settings are unchanged.

Counts come from profile-owned metadata (not suggested accounts), include a source URL and checked timestamp, and mark abbreviated counts as approximate. Every selected account must succeed before a combined estimate is shown. Login walls, timeouts, deleted/private profiles and throttling produce visible errors; they are never treated as zero. Availability depends on each platform and public reader service. This is best-effort public lookup, not an official platform integration or verified account ownership. Platform page changes may require parser maintenance.

The price formula remains illustrative: $100–$200 plus $10–$30 per 1,000 combined followers. Followers across platforms are not deduplicated people. There is no fee display.

## Athlete and sponsor portals

- `/athletes`: profile and avatar customization, social audience checks, upcoming race listings, outfit/placement selection, requests, and proof submission.
- `/sponsors`: race/location discovery, filters, shortlist, brand/logo placement preview, requests, and proof review.
- Add `?demo=1` to try either portal with fictional data stored on this device. The two demo roles share that local dataset.

The live account/database integration is connected to the existing Supabase project, with all four migrations applied and hosted integration checks passing. Resend SMTP is configured; test email delivery and signup confirmation delivery have been verified; the full recovery journey still needs testing, and the existing 2-auth-emails-per-hour limit needs review before cohort onboarding. See [SETUP.md](SETUP.md) for the migration, Vercel settings, auth setup, and launch checks. The original homepage brief builder remains a browser-session planning tool.

No payments are processed. Requests reserve a single placement on a single race after athlete approval. Accepted terms are locked; competing requests for the same spot are declined. Final artwork and payment are coordinated directly. Proof is shared by HTTPS link and reviewed by the sponsor.

Avatars use textured 3D geometry with interactive rotation, outfit coverage, and surface-attached sponsor logos. Discovery cards use lightweight generic outfit posters. See [AVATARS.md](AVATARS.md) for the asset pipeline, scalability, and optional personal-scan roadmap.

Avatar choices include Male/Female, build, skin tone, kit color, and preview clothing. A private portrait face preview is available in My profile: align a photo, match its skin color, and fit its hair directly to the scalp texture. Face and body share one skin material; overall brightness adjusts both. Hair length is captured, but long strands and hairstyle volume are not reconstructed. Photos stay in the current tab and are not saved or published. This is approximate texture projection, not 3D likeness reconstruction.

Avatar choices are optional visual preferences and do not affect pricing. No body image, ethnicity, exact age, height, or weight is required. Social handles are transmitted only when the user requests a lookup.

Photography: Unsplash, Leona Lee (xGzdmd5lB6I), Miguel Alcântara (nFz4XuVpPD8), Ryan Snaadt (BoCR26LwEcw). No endorsement implied.

An optional **Create my likeness · 3 photos** workflow in My profile adds guided front/profile capture, reviewed alignment, bounded head fitting, local color matching and multi-view texture blending. This experimental preview stays private to the current tab; it is not a scan or a published digital twin. See `AVATARS.md`.

Athlete profiles also support optional height/weight (cm/kg or separate feet/inches and pounds) and up to 12 past race results with required image evidence. Sponsors see event/year/location, placing and ranking category, optional time/field size, and an evidence viewer. Results are labeled athlete supplied rather than verified. Demo evidence is stored in IndexedDB; live evidence uses the private Supabase bucket introduced in `202609300002_performance.sql`. Apply all four migrations before enabling live accounts.

Athletes can offer gender-aware chest placements and left/right shoulders, upper arms, forearms, calves, thighs, buttocks and upper back. Every avatar uses a colorful sci-fi arena with moving lights, a pause control and reduced-motion support. Optional sponsor logos are attached to requests and displayed together after approval; live artwork uses the private bucket introduced in `202610010001_placements_artwork.sql`. The generic body has additional continuous muscle relief, but real scan-level identity still requires the personal-scan pipeline described in AVATARS.md.

Profile links appear first in both portal sidebars. Brand profiles include an optional website and up to seven social handles/page URLs, persisted by `202610010002_brand_links.sql`. The light sci-fi avatar scene uses the landing page’s green/lime palette.

Signed-out portal welcome panels use supplied photography: athlete training by Anastasia Shuraeva / Pexels (4944976), and the supplied `hero-running-xiAmCmmt.webp` for sponsors. Optimized WebP assets are served locally; signed-in avatar studios remain interactive.
