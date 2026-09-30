import { createAudienceHandler } from '../server/audience-handler.mjs';

// Vercel sets this header at its edge. Do not use Cloudflare's header here:
// it is absent on Vercel and would put every visitor in one rate-limit bucket.
const handleAudience = createAudienceHandler({
  clientKey: request => request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim(),
});

export default { fetch: handleAudience };
