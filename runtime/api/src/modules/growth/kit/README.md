# growth kit (2026-11-01)

Dependency-free TypeScript helpers (only `node:crypto`, in `referral.ts`). **Nothing is wired in and every flag defaults to OFF.**
No network calls, no third-party account logins, no fake engagement.

| module | what it does |
|---|---|
| `flags.ts` | `GROWTH_LOOP_ENABLED`, `REFERRAL_ENABLED`, `SHARECARD_ENABLED`, `SEO_PAGES_ENABLED`; pass the environment explicitly, missing env = everything OFF |
| `claims.ts` | forbidden-claim scan (medical, prediction, investment, absolute, fake-review) in English and Chinese; language checks |
| `attribution.ts` | UTM/referrer to channel (`organic_search`, `ai_search`, `social`, `paid`, `email`, `referral`, `direct`); drops PII-like values; never stores click ids |
| `referral.ts` | HMAC referral codes (identical output to the Python kit) and anti-abuse evaluation: self-referral, duplicate pair, velocity, shared device/payment, caps, 14-day hold, fixed rewards; flagged claims go to human review |
| `sharecard.ts` | Open Graph + text share cards with language and disclaimer checks |
| `seo-quality.ts` | programmatic-page quality gate (thin, near-duplicate, question mismatch, stale/no sources, forbidden claims, AI note) + Article JSON-LD |

Existing `attribution/utm.service.ts`, `seo/template-pages.service.ts`, `improvement/` and `self-improve/` stay authoritative; this kit complements them and replaces none of them.

Wiring (when the owner decides): import from `./kit` where needed and guard with `growthFlagsFromEnv(process.env)`.
Tests: `kit.spec.ts` (jest).
