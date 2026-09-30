# Connect the live portals

The portal UI, Supabase integration, and database migration are implemented. A Supabase project has **not** been provisioned or migrated for Athleet. Until the two environment variables below are configured, the site displays a setup notice and offers an explicitly labeled device-local demo. It does not pretend that demo records are live listings.

## 1. Create the database

Create a dedicated Supabase project for Athleet in the intended organization. In that project's SQL Editor, run the entire file `supabase/migrations/202609300001_portals.sql` once. Alternatively, link the checkout to that project and use `supabase db push`.

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

- Generic, customizable front/back SVG avatars; no personal body scans or 3D models.
- Seven outfit presets, six placement zones, and race-phase visibility notes.
- Per-race placement packages with follower-based starting price suggestions and athlete-set prices. No platform fee display.
- Sponsor filters for event/athlete, race location, discipline, distance, date range, price, followers, and skin/kit placements.
- Approval, reservation, private campaign/contact details, downloadable briefs, and proof review.
- Logos are previewed locally and are not uploaded. Proof is shared via an external HTTPS album/folder/post link.
- No checkout, escrow, platform payouts, in-app chat, automatic email notifications, GPS tracking, geofencing, or multi-race checkout. Campaign notes can express interest in a season, but each request reserves a spot for one race.
- Public social lookup remains best-effort. Counts are athlete-supplied profile data sourced from the existing lookup; account ownership and unique reach are not verified. The pricing formula is illustrative.

## Checks

- `npm test`: build, deployment/API checks, audience parsers, portal validation, discovery, and safe configuration.
- `npm run test:database`: installs nothing; uses existing local PostgreSQL binaries to create a disposable database, stub Supabase identity, apply the migration, and exercise permissions and booking transitions. The temporary database is removed afterward.

The demo (`?demo=1`) works with or without Supabase. Its fictional records and actions stay in browser local storage, separate from production data. Switching portals lets you act as the demo athlete Alex Rivera or Example Run Co. The other sample athletes illustrate discovery; use Alex's races to try both sides of a request.
