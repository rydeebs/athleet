# enduur founding pilot

## What is live

- Athlete invitation: https://enduur.co/invite/athletes
- Brand invitation: https://enduur.co/invite/brands
- Both lead to real Supabase signup, with Create account selected and the demo promotion removed from the invitation signup flow.
- No upfront payment or banking information is needed to join. Payments remain disabled until Stripe is connected and the full sandbox lifecycle is tested. Athlete acceptance currently requires a ready payout account, so use this phase for profiles, published listings, requests, interviews, and non-binding expressions of interest.
- These are shareable invitation landing pages, not single-use credentials or an access-controlled private beta. Existing public signup remains available. No invented scarcity, guaranteed earnings, booked sponsors, or promised race-organizer affiliation.
- Launch copy explicitly says payments are not live. Update both invite pages and the portal invitation notice when real payments are enabled.

## Efficient validation plan (proposed targets, not industry benchmarks)

Start with one US race weekend/location and one sport, ideally HYROX where clothing and visibility support the product. Recruit ultra runners as a separate later cohort so race duration, clothing, audiences, and deliverables don't confound the first test. Check event-specific advertising rules before promising any placement.

Week 1: identify 30–40 qualified athletes and 15–20 relevant brands. Personally interview five athletes and five brand buyers before scaling messages. Prioritize verified upcoming participation, audience fit, useful race content, credible performance evidence, comfort with placements, and responsive communication. Follower count is one input, not the whole qualification process. For brands, find the actual partnership/marketing decision maker and confirm budget, geography, category exclusions, and timing.

Weeks 2–3: invite in small batches. Aim for 10 complete athlete profiles with a published race and five substantive brand conversations. Offer brands a manually curated shortlist of three suitable athletes rather than asking them to browse an empty marketplace. Collect a concrete event, placement, deliverables, all-in price, and non-binding willingness to book. No payment or booking promise while checkout is disabled.

Next decision: aim for three athlete-brand matches that both sides would proceed with at the displayed price. If brands like the idea but won't discuss budget or select an athlete, investigate the offer before recruiting more athletes. Enable and test Stripe before collecting money. True validation is three paid, delivered sponsorships, acceptable support effort, and at least one repeat purchase or clearly documented intent to repeat. An account signup alone is not validation.

Keep one shared outreach list. Fields: public profile URL, role, race/date/city, relevant content URL, fit rationale, public business contact source, campaign label, message draft, approval, contacted date, reply, next action/date, signup, profile completed, race published, brand budget, specific match, willingness to book, paid, fulfilled, repeat interest, objection, do-not-contact. Deduplicate by public profile URL and business email. Record counts separately for athletes and brands. Do not collect private contact details, inferred sensitive traits, or unnecessary personal data.

Track the funnel: qualified → contacted → replied → joined → activated (athlete listing / brand brief) → matched → willing to pay → paid → fulfilled → repeated. Count personal founder hours per match. At this volume, manual funnel tracking alongside account records is enough; the site does not yet collect invitation page-view/click analytics.

## Campaign links

Append a non-personal campaign label:

- https://enduur.co/invite/athletes?campaign=hyrox-instagram-01
- https://enduur.co/invite/athletes?campaign=ultra-tiktok-01
- https://enduur.co/invite/brands?campaign=brands-email-01

Use letters, numbers, underscores or hyphens, max 64 characters. Do not put a recipient's name, email, or secret in the link. The label follows the signup CTA and is saved as `pilot_invitation` in a newly registered user's Supabase Auth metadata. It survives email confirmation because it is attached when signup occurs. It is client-supplied attribution, not proof of referral, permission, verification, or identity. Existing users signing in are not retagged. Links opened without JavaScript still work using the default campaign. There is no persistent cross-device click attribution before signup.

Operator-only SQL in Supabase SQL Editor can count new registrations by campaign (do not expose auth.users to browser roles):

```sql
select raw_user_meta_data->'pilot_invitation'->>'campaign' as campaign,
       raw_user_meta_data->'pilot_invitation'->>'role' as role,
       count(*) as registered,
       count(email_confirmed_at) as email_confirmed
from auth.users
where raw_user_meta_data->'pilot_invitation'->>'source' = 'pilot-invitation'
group by 1, 2 order by registered desc;
```

## Outreach drafts — personalize the bracketed facts before sending

Athlete:

> Hey [first name] — I saw your [specific race/training post]. I'm Ryan, building enduur: a way for athletes to offer race-day logo placements and content to brands. We're putting together an early pilot around [race/location]. Would you be open to trying it and telling me what you'd want from a partnership? Here's your invite: [athlete link]. It's early access; paid bookings aren't live yet.

Brand:

> Hi [first name] — I’m Ryan, founder of enduur. We're testing race-day partnerships: an athlete wears your logo on their body or kit, shares agreed posts, and provides event photo proof. [One concrete reason this audience fits the brand.] Would you be open to a short conversation about a pilot at [race/location] and what you'd need to justify a budget? Here's a preview/invite: [brand link]. Checkout isn't live yet; we're validating the first matches.

One follow-up, after roughly 4–5 business days if appropriate:

> Just following up on the enduur pilot at [race]. Is this relevant to you this season? Happy to share more; if not, no problem.

Start with genuine, specific one-to-one messages from Ryan. Don't claim a person has been selected based on content nobody reviewed. Stop on a decline or opt-out. Route product questions and feedback back to the founder, not to an unmonitored sender address. Use public business email where supplied; don't assume Resend transactional email setup is a ready-made cold outreach system.

## Suggested dot responsibility — draft first

Copy after selecting the initial race and connecting the outreach list:

> Help me validate enduur's US race-day sponsorship pilot for [race/date/location]. Maintain our shared prospect list. Research up to 30 relevant athletes and 15 brands using public sources, deduplicate them, and include source links, a specific fit rationale, upcoming race evidence where available, and uncertainty. Do not infer race entry from general interest in the sport. Draft one short personal invitation per prospect using our invitation URLs and campaign labels. Payments are not live: do not promise an available paid sponsorship. For now, prepare drafts for my review and do not send, comment, follow accounts, or contact anyone. Track replies I supply or explicitly authorize you to read, suggest one appropriate follow-up, and honor the do-not-contact list. Never negotiate binding terms, offer discounts, buy lists, or pay for tools. Bring me a concise summary of qualified leads, replies, recurring objections, and decisions needed. Ask when access or a decision is missing.

Once the first messages and responses prove useful, authorize narrowly scoped sending only through connected, supported channels. Define recipients, approved copy, batch size, follow-up limit, and stop conditions. Do not assume browser access authorizes mass DMs or overrides platform restrictions. Keep negotiation and the first ten discovery conversations with the founder.

## Dots sources checked October 2, 2026

- Overview and gradual availability: https://learn.chatgpt.com/docs/dots
- Permissions and sending scope: https://learn.chatgpt.com/docs/dots/controls
- Cloud browser/app access and possible sign-in blocks: https://learn.chatgpt.com/docs/dots/computers-and-apps

Dots can research, draft, track ongoing work, and act within connected capabilities and authorized scope. We have not verified this account's availability or a working outbound Instagram/TikTok integration. No dot, automation, prospect campaign, or external outreach was created by this implementation.
