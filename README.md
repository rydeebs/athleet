# Athleet

An endurance athlete sponsorship concept with a preserved hero, race timeline, mixed-race package builder, and live social-audience estimator.

## Run

`npm run dev` builds and runs a local server at http://localhost:4174. `npm run build` emits a self-contained Cloudflare Worker at `dist/server/index.js`. `node --test tests/social.test.mjs` runs scraper and validation tests.

## Race packages

One race, multi-race, and full-season packages support up to 12 events. Road running, trail/ultramarathon, triathlon, HYROX, cycling, and custom endurance events each have distances/formats. Per-event names, dates, locations, participant estimates, and finish bands appear in the brand-facing pass and downloadable brief.

## Public follower lookups

POST `/api/audience` accepts up to five `{platform, handle}` records. Instagram, TikTok, YouTube, and Threads use public profile metadata, with Jina Reader as a fallback. X uses the public FxTwitter profile endpoint, with a browser CORS fallback when the shared hosting IP is blocked. No credentials or social login are collected. Only allowlisted platform URLs are requested. Identity checks, timeouts, response-size caps, validation, and a bounded per-isolate limiter are included. The private Sites access gate is preserved.

Counts come from profile-owned metadata (not suggested accounts), include a source URL and checked timestamp, and mark abbreviated counts as approximate. Every selected account must succeed before a combined estimate is shown. Login walls, timeouts, deleted/private profiles and throttling produce visible errors; they are never treated as zero. Availability depends on each platform and public reader service. This is best-effort public lookup, not an official platform integration or verified account ownership. Platform page changes may require parser maintenance.

The price formula remains illustrative: $100–$200 plus $10–$30 per 1,000 combined followers. Followers across platforms are not deduplicated people. There is no fee display.

The site does not publish listings or take payments. Race details stay in browser memory and the downloadable brief. Social handles are transmitted only when the user requests a lookup.

Photography: Unsplash, Leona Lee (xGzdmd5lB6I), Miguel Alcântara (nFz4XuVpPD8), Ryan Snaadt (BoCR26LwEcw). No endorsement implied.
