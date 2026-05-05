# Cloudflare Pages Setup

One-time setup for deploying the MapMyRoots site to Cloudflare Pages. Most of these steps happen in the Cloudflare dashboard, not in the repo.

## Initial project creation

1. **Cloudflare dashboard** → Workers & Pages → Create → Pages → Connect to Git
2. Choose the GitHub repo (e.g., `h-e-a-d/mapmyroots`).
3. Project name: `mapmyroots` (this becomes the `*.pages.dev` subdomain).
4. Production branch: `main`.

## Build configuration

| Setting | Value |
|---------|-------|
| Framework preset | Astro |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | (leave blank — repo root) |
| Node version | `20` |

If "Astro" preset isn't available, use "None" with the values above.

Environment variables (production):

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_VERSION` | `20` | Some build environments need this set explicitly |

## Custom domains

1. Pages project → Custom domains → Set up a custom domain
2. Add `mapmyroots.com` (apex) — Cloudflare prompts to add a CNAME-flattened record at the apex; accept.
3. Add `www.mapmyroots.com` — Cloudflare adds a CNAME → `mapmyroots.pages.dev`.
4. The `_redirects` file in the repo handles `www → apex` 301 — Cloudflare's domain attachment handles SSL for both.

## Preview deploys

Enabled by default for every PR. The preview URL pattern is `<branch-hash>.<project>.pages.dev`. Used by the Lighthouse-CI workflow.

## Web Analytics

Cloudflare → Analytics & Logs → Web Analytics → Add a site → `mapmyroots.com`. The token is already inserted into `BaseLayout.astro` and `BuilderLayout.astro` (Phase 2 Task 4).

**Important:** Replace `__YOUR_CF_BEACON_TOKEN__` in both layout files with your real 32-char token before merging to main.

## Verifying the deploy

After the first build:

```bash
curl -I https://mapmyroots.com
```

Expected headers (subset):
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `Content-Security-Policy: default-src 'self'; ...`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Permissions-Policy: camera=(), ...`

Check `https://www.mapmyroots.com` — should 301 to `https://mapmyroots.com`.

Check legacy URL: `curl -I https://mapmyroots.com/about.html` should 301 to `/about`.

## Common issues

- **Build fails with "command not found: astro":** the build command tries to run `astro` directly. Use `npm run build` (which invokes `astro build` via npm script).
- **404 on every page:** output directory mismatch. Confirm "Build output directory" is `dist` not `dist/static` or anything else.
- **`_headers` not applied:** confirm the file is at `public/_headers` in the repo. Astro copies `public/` to `dist/` verbatim, so it lands at `dist/_headers` for Cloudflare to read.
- **Preview URL works but custom domain shows old GTM:** browser cache. Try in private window.
