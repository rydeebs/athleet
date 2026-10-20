export const brand = {
  name: 'enduur',
  displayName: 'enduur race-day sponsorships',
  url: 'https://enduur.co',
  description: 'enduur race-day sponsorships connects endurance athletes and brands for per-race and season partnerships across road running, triathlon, trail and HYROX.',
  // Add only owner-confirmed official profiles. Never infer accounts from a handle.
  socialProfiles: [],
};
export const organizationId = `${brand.url}/#organization`;
export function organizationSchema() {
  return {
    '@context':'https://schema.org', '@type':'Organization', '@id':organizationId,
    name:brand.name, alternateName:brand.displayName, url:brand.url+'/',
    description:brand.description,
    logo:{'@type':'ImageObject',url:brand.url+'/assets/social/enduur-logo.jpeg',width:2400,height:1000},
    ...(brand.socialProfiles.length ? {sameAs:brand.socialProfiles.map(profile=>profile.url)} : {}),
  };
}
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const json = value => JSON.stringify(value).replace(/</g,'\\u003c');
// Applies the same identity at build time to static and generated public HTML.
export function withBrandIdentity(html) {
  if (html.includes('id="brand-organization"')) return html;
  html=html.replace(/<title>(.*?)<\/title>/s,(_,title)=>{
    const clean=title.replace(/^enduur(?: for sponsors)?\s*[—|]\s*/,'').replace(/\s*\|\s*enduur$/,'');
    return `<title>${clean} | ${brand.displayName}</title>`;
  });
  const siteName=`<meta property="og:site_name" content="${brand.displayName}">`;
  html=html.match(/<meta property="og:site_name"[^>]*>/)
    ? html.replace(/<meta property="og:site_name"[^>]*>/,siteName)
    : html.replace('</head>',siteName+'\n</head>');
  const title=html.match(/<title>(.*?)<\/title>/s)?.[1];
  html=html.replace(/(<meta (?:property="og:title"|name="twitter:title") content=")[^"]*"/g,`$1${title}"`);
  let schemas=`<script id="brand-organization" type="application/ld+json">${json(organizationSchema())}</script>`;
  if (html.includes('rel="canonical" href="https://enduur.co/"')) {
    schemas+=`<script type="application/ld+json">${json({
      '@context':'https://schema.org','@type':'WebSite','@id':brand.url+'/#website',
      name:brand.displayName,alternateName:brand.name,url:brand.url+'/',
      description:brand.description,publisher:{'@id':organizationId},
    })}</script>`;
  }
  html=html.replace('</head>',schemas+`<style id="brand-layout">footer:has(>.brand-identity){flex-wrap:wrap}footer>.brand-identity{font-size:14px;line-height:1.6;max-width:65ch;margin:24px 0 0;flex-basis:100%}.brand-socials{flex-basis:100%;line-height:1.8}.brand-socials a{text-decoration:underline;text-underline-offset:3px}.brand-footer{max-width:960px;margin:32px auto;padding:0 24px}</style>\n</head>`);
  const socials=brand.socialProfiles.length?`<p class="brand-socials">${brand.socialProfiles.map(profile=>`<a href="${escape(profile.url)}" rel="me">${escape(profile.label)}</a>`).join(' · ')}</p>`:'';
  const identity=`<p class="brand-identity">${escape(brand.description)}</p>${socials}`;
  if(html.includes('</footer>'))return html.replace('</footer>',identity+'</footer>');
  return html.replace('</main>',`</main><footer class="brand-footer">${identity}</footer>`);
}
