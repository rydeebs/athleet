// Money is snapshotted in integer cents. The audience calculator is intentionally separate.
export const PAYMENT_TERMS_VERSION='2026-10-02';
export const MARKUP_BPS=2000;
export function quotePlacement(dollars){
 const athleteCents=Math.round(Number(dollars)*100);
 if(!Number.isSafeInteger(athleteCents)||athleteCents<2500||athleteCents>100000000)throw Error('Invalid placement price.');
 const markupCents=Math.round(athleteCents*MARKUP_BPS/10000);
 return {athleteCents,markupCents,sponsorCents:athleteCents+markupCents,currency:'usd'};
}
export const sponsorPrice=dollars=>quotePlacement(dollars).sponsorCents/100;
export const currency=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((cents||0)/100);
export const paymentLabels={unpaid:'Awaiting sponsor payment',paid:'Payment secured',review:'Proof under review',release_ready:'Approved · payout pending',processing:'Settlement processing',released:'Sent to athlete’s Stripe account',refunded:'Refunded',partially_refunded:'Partially refunded',disputed:'Paused for review',expired:'Payment deadline expired'};
export const bookingRules=[
 ['A funded booking','The sponsor has 48 hours after acceptance to pay. An unpaid reservation expires. Do not begin paid work until the booking shows Payment secured.'],
 ['The agreed work','The confirmed placement, artwork instructions, deliverables, and deadlines form the brief. Required pre-publication content approval is agreed before booking. No new requirements can be added unilaterally.'],
 ['Proof and review','Submit placement photos and live post links within 7 days after the race. Sponsors have 72 hours after the proof-review email notification to approve or report a specific unmet requirement. Silence makes the booking eligible for automatic release. Bank arrival follows Stripe’s payout schedule.'],
 ['Objective approval','Low engagement, sales, or finish position are not grounds to withhold the base payment. A DNF is reviewed against actual participation and delivery, not an implied finish guarantee.'],
 ['Changes and cancellations','Either party can request review for cancellation, injury, withdrawal, a postponed race, or missed deliverables. Undelivered work is refundable; completed work is assessed against the agreed brief and allocation. Moving to another race requires a new agreement by both parties.'],
 ['Partial delivery','The booking records separate placement and social-content values. Enduur reviews evidence and releases the earned amount, with the corresponding markup retained, and refunds the rest. A timely issue pauses automatic release.'],
 ['Price and payout','Athletes set their requested payout. Sponsor prices include a 20% enduur markup on that amount. Stripe costs come from enduur’s share. No payment-processing charge is added at checkout. Amounts are USD; personal taxes remain each party’s responsibility.'],
 ['Single races first','Each payment covers one race and one placement. Season plans require separate race bookings. Delayed transfers are not an escrow service.']
];
