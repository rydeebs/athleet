# Athleet

A responsive landing-page concept for an endurance athlete sponsorship marketplace. The original DNNR-inspired hero is preserved, with an Athleet race timeline, interactive partnership pass, and social-audience estimator below it.

Run `npm run dev` and open http://localhost:4173. Run `npm run build` for static output in `dist`.

The package builder carries placement and race/season selections into a downloadable brief. The audience estimator accepts Instagram, TikTok, X, YouTube, and Threads handles, combines manually supplied follower counts, and suggests a price range that grows with the audience. Duplicate accounts and invalid values are rejected.

Live social profile lookup is not connected: a data provider or platform authorization is required. No follower counts are inferred from usernames. The current estimator clearly labels its manual fallback and illustrative formula ($100–$200 plus $10–$30 per 1,000 followers). Combined followers are not deduplicated people. There are no visible platform fees.

This frontend concept does not publish listings, take payments, create accounts, or send form data. Everything entered stays in page memory and downloadable briefs.

Photography from Unsplash: Leona Lee (xGzdmd5lB6I), Miguel Alcântara (nFz4XuVpPD8), Ryan Snaadt (BoCR26LwEcw). Imagery does not imply endorsement. Fonts served by Google Fonts.
