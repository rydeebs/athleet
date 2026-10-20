const form = document.querySelector('#season-form');
form.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(form);
  const brief = [
    'ENDUUR / ATHLETE SPONSORSHIP CAMPAIGN BRIEF',
    'Planning draft. Not submitted, booked or paid.', '',
    `Brand: ${data.get('brand')}`,
    `Proposed schedule: ${data.get('weekends')}`,
    `Market: ${data.get('market')}`,
    `Events, offer and deliverables: ${data.get('offer')}`, '',
    'Before agreement:',
    '- Confirm athlete, entry status, named events and dates.',
    '- Confirm event permission, artwork sizes and production responsibilities.',
    '- Define posts, deadlines, proof, content approval and licensed reuse.',
    '- Obtain an athlete quote, with currency, fees and final payable total.',
    '- Agree cancellation, substitution and partial-delivery terms.',
    '- Name reporting metrics, access and review dates.',
    'Season plans require separate race bookings. Check availability and payment terms in the workspace.',
    'https://enduur.co/payment-terms.html',
  ].join('\n');
  const url = URL.createObjectURL(new Blob([brief], {type:'text/plain;charset=utf-8'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'enduur-season-brief.txt';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  document.querySelector('#season-status').textContent = 'Brief downloaded. Nothing has been sent; keep it for your partnership conversation.';
});
