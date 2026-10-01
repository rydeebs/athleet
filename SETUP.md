# Connect the live portals

The portal UI, Supabase integration, and database migration are implemented. A Supabase project has **not** been provisioned or migrated for Athleet. Until the two environment variables below are configured, the site displays a setup notice and offers an explicitly labeled device-local demo. It does not pretend that demo records are live listings.

## 1. Create the database

Create a dedicated Supabase project for Athleet in the intended organization. In that project's SQL Editor, run `supabase/migrations/202609300001_portals.sql`, `supabase/migrations/202609300002_performance.sql`, and `supabase/migrations/202610010001_placements_artwork.sql`, once each in that order. Skip migrations already applied. Alternatively, link the checkout to that project and use `supabase db push`.

The migration creates separate athlete and brand profiles, race listings, private sponsorship requests, and shortlists. All tables have row-level security enabled and no direct anonymous/authenticated table privileges. Narrow database functions enforce ownership, allowed transitions, price snapshots, and exclusive placement reservations. A public snapshot exposes published upcoming listings; private request bodies and proof links are restricted to the two parties.

## 2. Configure Vercel

Add these variables in the Athleet Vercel project's settings, then redeploy:

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | `https://YOUR_PROJECT.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | The project's publishable key (`sb_publishable_…`), or its legacy **anon** key |

Never use a secret or service-role key. The configuration endpoint rejects privileged keys. These values are intentionally browser-readable because access is enforced by authenticated database functions and table privileges, not by hiding the public key.

The existing Vercel build settings still apply: framework **Other**, `npm run build`, output `dist/public`. Routes `/athletes` and `/sponsors` are included in `vercel.json`.

For local work, copy `.env.example` to `.env.local`, fill those two values, and run `npm run dev`. The development server reads `.env.local`; it is ignored by Git. Rebuild with `npm run build` and refresh the browser after frontend edits.

## 3. Configure sign-in email

In Supabase Authentication:

- Enable email/password sign-in and email confirmation.
- Set the Site URL to the real Athleet domain.
- Allow the exact `/athletes` and `/sponsors` redirect URLs on that domain. Add the equivalent localhost URLs for local testing and intended preview URLs when testing Vercel previews.
- Configure a production SMTP provider before inviting real users. Supabase's default email service is for limited testing.

The app supports registration, confirmation redirects, sign-in, password recovery, password updates, token refresh, and sign-out. Sessions stay in session storage for that browser tab. The same account can maintain separate athlete and brand profiles.

## 4. Verify against the connected project

1. Register an athlete test account, confirm its email, and save its profile.
2. Add an upcoming race and publish permitted placements.
3. Open a different browser/session, register a sponsor test account, and save its brand profile.
4. Find the race by **race location**. Save it to a shortlist and request a placement.
5. As the athlete, refresh Partnerships and accept. Check that the sponsor sees the reserved spot and that a second request cannot claim it.
6. Submit an accessible HTTPS proof link as the athlete. Review it and complete the partnership as the sponsor.
7. Verify password recovery on the real domain.

Local checks already cover the database functions using an isolated PostgreSQL instance and the browser workflow using demo data. They do not replace a real Supabase email/auth integration test after connection.

## Current scope

- Textured 3D avatars with a private, optional three-photo likeness preview; no personal body scan required.
- Seven outfit presets, gender-aware anatomical placements, an animated sci-fi arena, and race-phase visibility notes.
- Per-race placement packages with follower-based starting price suggestions and athlete-set prices. No platform fee display.
- Sponsor filters for event/athlete, race location, discipline, distance, date range, price, followers, and skin/kit placements.
- Approval, reservation, private campaign/contact details, downloadable briefs, and proof review.
- Logos preview locally, then upload with a request for athlete review and confirmed-race previews. Proof is shared via an external HTTPS album/folder/post link.
- No checkout, escrow, platform payouts, in-app chat, automatic email notifications, GPS tracking, geofencing, or multi-race checkout. Campaign notes can express interest in a season, but each request reserves a spot for one race.
- Public social lookup remains best-effort. Counts are athlete-supplied profile data sourced from the existing lookup; account ownership and unique reach are not verified. The pricing formula is illustrative.

## Checks

- `npm test`: build, deployment/API checks, audience parsers, portal validation, discovery, and safe configuration.
- `npm run test:database`: installs nothing; uses existing local PostgreSQL binaries to create a disposable database, stub Supabase identity, apply all three migrations (with a Storage schema stub), and exercise permissions and booking transitions. The temporary database is removed afterward.

The demo (`?demo=1`) works with or without Supabase. Its fictional records and actions stay in browser local storage, separate from production data. Switching portals lets you act as the demo athlete Alex Rivera or Example Run Co. The other sample athletes illustrate discovery; use Alex's races to try both sides of a request.


## Past race results and photo evidence

The second migration adds optional height (cm), weight (kg) and structured past results to athlete profiles. Metric and feet/inches inputs convert to canonical cm/kg; they do not alter avatar geometry. A result includes event, year, location, discipline, format, placing, ranking category, optional category/field size/time, and one required evidence image. Both browser and database enforce limits and evidence ownership. Uploaded evidence is supporting material, not an independently verified placing.

The UI decodes JPG/PNG/WebP inputs up to 8 MB, resizes them to at most 1600 pixels on the long edge, and re-encodes JPEG (removing original metadata) at up to 2 MB. Uploads occur when **Save profile** is selected. The private `performance-evidence` bucket allows owner uploads, owner reads, and signed-in brands to read evidence attached to a currently published upcoming listing. Five-minute signed URLs are generated on demand. No overwrite policy exists; attached evidence cannot be deleted until it is removed from the profile. Failed saves attempt to remove newly uploaded objects. Successful saves also attempt to remove superseded or removed evidence. Failed cleanup may leave private, unattached objects; configure a retention job using the Storage API before production scale. Never delete `storage.objects` rows directly to remove files.

The demo stores evidence blobs separately in IndexedDB, with only paths and result metadata in localStorage. It remains device-local. Avatar likeness photos continue to stay only in tab memory; evidence images are a separate saved feature.

After connecting Supabase, test real Storage uploads and signed URLs with two accounts, verify that a brand can see attached evidence while an anonymous or unrelated athlete account cannot, and verify that missing/reused evidence paths are rejected. Local SQL tests cover policies and metadata checks, but do not exercise the hosted Storage HTTP service.


## Sponsor artwork and environments

The third migration expands placements and creates the private `brand-artwork` PNG bucket (2 MB limit). The browser accepts PNG/JPG/WebP, decodes and resizes to at most 1024 pixels, then re-encodes PNG to preserve transparency and remove metadata. Only the path is stored on the request. Pending artwork is readable by the uploader and requested athlete; accepted/submitted/completed artwork is also readable by signed-in brands while the listing is published and upcoming. Anonymous previews use brand text. Private campaign/contact details are never included in public sponsor-mark metadata. Signed URLs last 15 minutes.

Referenced artwork cannot be overwritten or deleted. Failed requests attempt to delete newly uploaded artwork; include unreferenced artwork in the Storage API retention job. Test hosted uploads, signed URLs and both account roles before launch; local PostgreSQL tests use a Storage schema stub. Demo logos persist only in this origin’s IndexedDB.

The sci-fi arena is lightweight procedural Three.js geometry with no external downloads. All legacy scene choices normalize to sci-fi; the environment selector is removed. Moving lights render at up to 30 fps only while the viewer is visible, respect reduced-motion preferences and have a pause control. Existing race placement IDs are retained for compatibility; new listings offer gender-aware chest options. Confirmed listing terms remain locked.
