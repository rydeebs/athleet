# Enduur payments — US / USD pilot

Implemented, but new checkout and onboarding stay disabled until Stripe is connected. No live Stripe payments have been tested or enabled. The homepage audience calculator is unchanged.

## Commercial model

An athlete requesting $100 receives $100 for complete delivery. The sponsor sees $120 on the discovery card, detail page, request, and Stripe Checkout. This is a **20% markup on the athlete amount**, or **16.67% of the sponsor payment**. Enduur pays Stripe processing/Connect fees from its $20; that $20 is gross revenue, not profit. Full refunds can still leave enduur with processor costs.

The all-in sponsor price is shown up front; there is no added checkout surcharge or calculator fee row. `/payment-terms.html` discloses the markup and payment rules. This implementation does not establish a universal legal exemption from fee, tax, marketplace, or sponsorship disclosures. Confirm the pilot’s business terms and tax treatment before live launch. Automatic sales-tax calculation and tax-form workflows are not included.

## Create and connect Stripe

1. Create an enduur business account at https://dashboard.stripe.com/register. Complete Stripe’s business verification yourself. Enable Connect for a **marketplace** that collects sponsor payments and transfers earnings to US athletes.
2. Start in a Stripe sandbox/test environment. This code creates **Express connected accounts** in the US, with the `transfers` capability, Stripe-hosted identity/bank onboarding, and separate charges and transfers. It does not collect athletes’ bank details in Supabase.
3. Put the test secret key (`sk_test_…`) in `STRIPE_SECRET_KEY` in `.env.local`. Never put it in client code or chat. Add the same variables securely to the Vercel environment when testing the deployed app. Use different credentials/configuration for sandbox and production.
4. Create a webhook endpoint at `https://enduur.co/api/stripe-webhook` for the selected environment. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, and `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`, `charge.dispute.funds_withdrawn`, `charge.dispute.funds_reinstated`. Subscribe to connected-account `account.updated` too if your endpoint configuration supports both event sources. Otherwise use a separate connected-account endpoint to the same URL and put its signing secret in `STRIPE_CONNECT_WEBHOOK_SECRET`. The handler accepts either configured signature and the portal also refreshes account status directly. Use snapshot events, not thin-event payloads.
5. Set `STRIPE_WEBHOOK_SECRET` to that endpoint’s signing secret. Local development can use Stripe CLI forwarding to `localhost:4174/api/stripe-webhook` with its own signing secret. Verify replay and failure recovery in test mode.
6. Add `SUPABASE_SERVICE_ROLE_KEY` from the existing project’s server API keys. It is only used in Node.js functions. The browser keeps its publishable key.
7. Set `APP_URL=https://enduur.co` on Vercel (`http://localhost:4174` locally). Only this origin is allowed to initiate payments. Set a random `CRON_SECRET` of at least 32 characters. Set `PAYMENT_ADMIN_USER_IDS` to the comma-separated Supabase Auth UUIDs of trusted operators.
8. Add `RESEND_API_KEY` and `PAYMENTS_FROM_EMAIL=enduur <accounts@enduur.co>`. Payment notifications use Resend directly, separately from Supabase Auth SMTP. Verify that `accounts@enduur.co` actually receives support replies or replace the support contact with a monitored address. Resend sender-domain verification alone does not create an inbox.
9. The Vercel cron calls `/api/payments-cron` every 15 minutes with `Authorization: Bearer <CRON_SECRET>`. This schedule requires a Vercel plan that supports it. Verify successful cron runs and error alerts before enabling checkout. If using another scheduler, configure the same authenticated GET call and remove the Vercel cron entry; do not silently fall back to a daily settlement job.
10. Set `PAYMENTS_ENABLED=true` **in test mode** after the database migration and other variables are ready. Live keys additionally require `PAYMENTS_LIVE_APPROVED=true`. Leave that flag false until Stripe has approved the business and the full test lifecycle below passes.

Stripe is the authority on your account’s permitted flow and capabilities. Configure the platform’s payout schedule/reserve so funds remain available for transfers and refunds; do not withdraw funds owed to athletes. Separate charges and transfers place processing costs, refund exposure, and chargebacks on the platform. This is delayed settlement, **not escrow**.

References: [Separate charges and transfers](https://docs.stripe.com/connect/separate-charges-and-transfers), [Hosted onboarding](https://docs.stripe.com/connect/hosted-onboarding), [Webhook signatures](https://docs.stripe.com/webhooks/signature).

## Database and boundaries

Apply `supabase/migrations/202610020001_payments.sql` and `202610020002_payment_hardening.sql` after the four existing migrations. It adds immutable booking contracts, per-listing placement/social allocation, mode-separated payout accounts, booking payments, transactional notification records, and an audit trail. Old requests are explicitly labeled legacy; they never become paid or acquire new terms retroactively.

Authenticated user RPCs can agree terms, submit proof/drafts, approve work, or raise an issue. Only `service_role` can invoke `payment_service`, which owns Stripe identifiers and financial transitions. Direct table access remains denied to browser roles. Stripe IDs/operation keys are excluded from participant snapshots. Public price calculations are estimates until the server snapshots the actual quote on request creation.

`/api/payments` verifies the Supabase token and booking ownership. The client never supplies trusted price, payout destination, paid status, or transfer amount. `/api/stripe-webhook` verifies the raw body’s Stripe signature and retrieves canonical payment objects. Checkout redirects are not evidence of payment. `/api/payments-cron` requires its independent secret.

## Booking flow

- Sponsor requests one placement on one race, confirms artwork instructions and the versioned rules, and optionally requires social-draft approval.
- Athlete sets up a ready US payout account and accepts the same brief. Pilot acceptance is 1–30 days before the race. The full price and allocation are locked.
- Sponsor has up to 48 hours to pay, ending before race day begins in UTC. Card-only Checkout charges the full sponsor price. Verified successful payment marks it secured. Unpaid reservations expire only after any existing Stripe session is safely expired/reconciled.
- Where agreed, athlete submits an HTTPS content-draft link and sponsor approves before publication.
- Athlete submits all placement photos and post links by the end of the seventh day after race day (UTC). UI deadlines render in the viewer’s timezone. Missing proof is queued for manual review, not automatically forfeited.
- Proof notification is queued transactionally. A **72-hour review clock starts only after Resend accepts that notice**. Mail-send failure does not silently consume the review window. Sending acceptance is not proof of inbox delivery; monitor bounces and support reports.
- Sponsor approval or expiry of that window makes payout eligible. The worker transfers the earned athlete amount to their connected Stripe account; bank arrival follows Stripe’s payout schedule.
- Either party can report cancellation, injury, or unmet work before settlement. It pauses release. Finish position, engagement, and sales alone are not base-payment conditions.
- Season purchases remain separate bookings per race; the system does not hold one season-wide payment.

## Operator review and recovery

Allowlisted operators sign into `/athletes`, open **Payouts → Review disputed payments**, or go to `#payment-review`. Review the brief, evidence, and both parties’ account of the issue. Enter the earned athlete amount and an explanation. A zero earned amount refunds the entire sponsor price; full earned amount releases the athlete payout; a partial amount retains only the proportionate markup. Example: $70 earned from a $100 athlete / $120 sponsor contract produces a $70 transfer and $36 refund.

Ordinary pre-transfer disputes use this UI. Cases with an existing transfer, a Stripe chargeback, unknown Checkout creation, stale operations, or an external refund require manual Stripe reconciliation. The UI intentionally blocks another automated resolution in these cases. Investigate the payment/transfer IDs and `payment_audit`, handle any necessary transfer reversal/refund in Stripe, and reconcile the database with a reviewed, booking-specific service transaction. Do not set a row back to `unpaid`, clear an operation key, or simply rerun a transfer.

Stripe creation/transfer/refund idempotency keys are persisted. Unknown retries older than 23 hours are paused for reconciliation rather than risking another charge or payout after Stripe discards an old key. Refunded money is recorded before transferring the earned remainder. Stripe disputes/external refunds pause automatic processing. Race reservations, payment updates and participant actions share a consistent database lock order.

Monitor Vercel webhook failures, cron 503s, Resend bounces, operator issue notifications and pending `payment_notifications`. Cron and webhook handlers are separate from `PAYMENTS_ENABLED`: disabling new payments must not strand already funded bookings. Keep the configuration/secrets in place while servicing existing payments.

## Validation before enabling live money

Local checks: `npm test` and `npm run test:database`. They exercise quotes, access boundaries, webhook signatures/replays, currency/mode/amount verification, transfer retries, partial/full refunds, UTC deadlines, proof-notification gating and reservation expiry against isolated PostgreSQL. These are not substitutes for a Stripe sandbox test.

In Stripe test mode with two disposable accounts: onboard athlete → request $100 placement → accept → sponsor sees/pays $120 → confirm webhook → submit required draft → approve draft → submit complete proof → receive review notice → approve → verify one $100 transfer. Also exercise card failure, abandoned checkout/expiry, duplicate webhooks, no sponsor response, a $36 partial refund/$70 transfer, full cancellation, failed notifications, payout-account restrictions and a dispute. Use sandbox fixture dates for post-event tests; do not edit real customers’ contract dates.

Before live activation, check both signing secrets if using separate Connect webhooks, platform reserve/payout settings, operator access, support inbox, applicable terms/tax reporting and Stripe business approval. No fee or commission is added to the audience calculator.
