# Athleet

An endurance athlete sponsorship concept with a preserved hero, race timeline, mixed-race package builder, and live social-audience estimator.

## Run

Use Node.js 22. `npm run dev` builds and runs a local server at http://localhost:4174. `npm run build` emits static assets in `dist/public` for Vercel and a self-contained Worker in `dist/server/index.js` for the existing Sites deployment. `npm test` builds both outputs and runs the scraper, API, and deployment tests.

## Deploy on Vercel

1. Import the GitHub repository `rydeebs/athleet` into Vercel.
2. Use the repository root as the Root Directory and **Other** as the Framework Preset.
3. Deploy. `vercel.json` supplies the build command (`npm run build`), output directory (`dist/public`), and a 30-second limit for the Node.js `/api/audience` function. `package.json` selects Node.js 22.

No environment variables or API keys are required for the existing public-profile lookups. Only browser assets are copied to the public output; server code, tests, and hosting metadata are not served as static files. `/api/audience` uses Vercel's client-IP header and shares its validation and lookup behavior with the Sites Worker. Static assets are revalidated to avoid stale frontend scripts after updates.

The Sites sign-in gate does not transfer to Vercel. Choose Vercel Deployment Protection settings if you want restricted access. The in-memory rate limiter is best-effort per running function instance, not a distributed quota; configure Vercel Firewall or a shared store if stronger public-traffic enforcement is needed.

After deployment, check `/`, add a mixed-race package, and calculate an audience from a public handle. Social sites can block the Vercel hosting IP just as they can block other hosting providers; successful local tests do not guarantee every profile is readable in production. Instagram remains best-effort, and blocked accounts show an error instead of a fabricated total.

## Race packages

One race, multi-race, and full-season packages support up to 12 events. Road running, trail/ultramarathon, triathlon, HYROX, cycling, and custom endurance events each have distances/formats. Per-event names, dates, locations, participant estimates, and finish bands appear in the brand-facing pass and downloadable brief.

## Public follower lookups

POST `/api/audience` accepts up to five `{platform, handle}` records. Instagram, TikTok, YouTube, and Threads use public profile metadata, with Jina Reader as a fallback. X uses the public FxTwitter profile endpoint, with a browser CORS fallback when the shared hosting IP is blocked. No credentials or social login are collected. Only allowlisted platform URLs are requested. Identity checks, timeouts, response-size caps, validation, and a bounded per-instance limiter are included. The existing Sites access settings are unchanged.

Counts come from profile-owned metadata (not suggested accounts), include a source URL and checked timestamp, and mark abbreviated counts as approximate. Every selected account must succeed before a combined estimate is shown. Login walls, timeouts, deleted/private profiles and throttling produce visible errors; they are never treated as zero. Availability depends on each platform and public reader service. This is best-effort public lookup, not an official platform integration or verified account ownership. Platform page changes may require parser maintenance.

The price formula remains illustrative: $100–$200 plus $10–$30 per 1,000 combined followers. Followers across platforms are not deduplicated people. There is no fee display.

The site does not publish listings or take payments. Race details stay in browser memory and the downloadable brief. Social handles are transmitted only when the user requests a lookup.

Photography: Unsplash, Leona Lee (xGzdmd5lB6I), Miguel Alcântara (nFz4XuVpPD8), Ryan Snaadt (BoCR26LwEcw). No endorsement implied.
