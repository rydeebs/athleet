# Athlete media kits and account ownership

Athletes enter optional 30-day metrics per social account in My profile. Published race details show links, followers, a calculated engagement rate, average likes/comments, video/story views, the period ending date, sample size, race deliverables and the sponsor-facing package price. Missing metrics stay empty. The existing 20% markup remains unchanged; no fee line is added to the calculator.

## Trust labels

- Metrics are athlete-reported, including public lookup results saved through the client. They are never presented as independently verified or API-synced.
- Ownership checked means an enduur operator observed the server-issued code in the exact account’s live public bio. It proves control at that time, not legal identity, authentic followers, performance or campaign results.
- Ownership expires after 90 days. Editing/removing a handle revokes its check. One account can have only one active verified enduur owner. Demo profiles cannot be verified.
- Old records without per-account counts or engagement display missing values, not invented allocations. Combined counts are not deduplicated people.

## Pilot review operations

Apply `supabase/migrations/202610090001_media_kit.sql` before deploying this UI.

1. Athlete saves their social handle, chooses Verify account ownership, adds the random code to that public account’s bio and requests review. The code lasts seven days.
2. Operator checks the queue regularly:
   `node --env-file=.env.local scripts/review-socials.mjs list`
3. Open the exact platform profile URL from the queue. Read the current live bio; do not approve on the basis of screenshots or a DM. Confirm the handle and code match. If it is private/inaccessible or mismatched, reject and explain in the internal note. Never ask for a social password.
4. After actually observing the code:
   `node --env-file=.env.local scripts/review-socials.mjs approve REQUEST_UUID OBSERVED_CODE "Reviewed by Ryan; code observed in live public bio on DATE."`
   Or reject:
   `node --env-file=.env.local scripts/review-socials.mjs reject REQUEST_UUID - "Reviewed by Ryan; code not present in the live bio."`
5. The athlete sees the updated state when refreshing their profile and can remove the code once approved. There is no automated review or notification email yet. Do not promise an immediate turnaround.

Service credentials stay in the local environment. Browser roles cannot mutate the review table, call the review RPC, approve their own request or read another athlete’s challenge. Public snapshots expose only the ownership status and review/expiry dates, for visible listings. Internal notes remain private. Keep a saved note identifying the reviewer; records track the latest review, not an immutable audit history.

## Next: connected account analytics

Use official OAuth consent per platform, retain the stable platform account ID server-side and store refreshed metrics in a server-owned table. Never accept a verified badge or trusted metric from profile JSON. Keep ownership, analytics provenance and legal identity as separate concepts.

TikTok requires approved Login Kit/API products and `user.info.stats` for follower statistics; `video.list` is separate. Scope approval, token refresh/revocation, reconnect UX and platform-specific analytics availability must be implemented before claiming automatic sync. Instagram should use the official Instagram Login professional account integration, subject to Meta permissions/review. These connections require developer app credentials and are not configured in this release.

References:
- https://developers.tiktok.com/docs/en/tiktok-api-scopes
- https://developers.tiktok.com/doc/display-api-get-started/
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/
