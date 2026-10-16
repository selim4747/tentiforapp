# 6.3.9 — SEO pre-rendering and crawler fallback

TentiforApp is a vanilla-JavaScript SPA and does not use server-side rendering. The `scripts/paketle.mjs` build therefore creates static route documents in `dist/` so search and social crawlers can read meaningful HTML before executing JavaScript. This is a build-time static-generation fallback, not SSR.

## Public route sources

- Canonical section routes and the built-in E25/E99 worlds are generated from the repository's already-public content.
- User profiles, published fan universes, and explicitly public reading paths are obtained through the Supabase `public.public_seo_sayfalar` RPC. Detail documents use `public.public_seo_sayfa`.
- The sitemap is generated from the same whitelisted route set; only public RPC results are eligible for profile/universe/reading-path entries. Identifiers are validated and route segments are percent-encoded (NFC + Turkish-locale lowercase for universe slugs).
- Public text is length-bounded and escaped before writing HTML attributes/body text. No table grants or new tables are introduced for SEO.

## Privacy and failure behavior

The RPC returns a field allow-list, not whole profile/content rows. Search-disabled, suspended, hidden, draft, and non-public reading-path records are omitted. When profile content visibility is off, the biography and published-world list are excluded. A build-time RPC/network failure emits a warning and writes only the repository-declared public routes; it never falls back to private application tables or broad database exports. CI's contract suite covers the query gates and generated output.

The SPA metadata manager starts detail routes as `noindex, follow`, fetches the same anonymous public RPC, and switches to `index, follow` only when the requested public item is confirmed. A missing, hidden, or failed lookup stays `noindex`. Hash changes and browser back/forward events refresh the title, description, canonical URL, Open Graph and Twitter tags. Public route documents use a generic branded `paylasim.png` social-preview fallback; the in-app share-card action creates a content-specific PNG locally in the browser.

Unknown static paths are served from `dist/404.html`, marked `noindex, follow`, with an HTTP 404 response on Cloudflare Pages. The root `robots.txt` continues to point to the generated `/sitemap.xml`; private/user-action routes are never added to the sitemap.

## Validation

- `npm run build` creates the route documents, sitemap and 404 fallback in `dist/` and synchronizes web/PWA/Capacitor assets.
- `npm test` runs the SQL/privacy, escaping, route validation and deterministic static-build contracts.
- `npm run test:seo` uses Playwright to verify JavaScript-off crawler output, SPA route metadata/canonical updates, the share-card PNG download, a narrow viewport, and the noindex 404 response.
