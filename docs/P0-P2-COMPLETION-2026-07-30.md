# P0–P2 completion record

Scope: the seven priority items in `DEEPSEEK_UI_CONTENT_TEST_REPORT_v1.md`,
revalidated against the current NestJS + Next.js production runtime.

| Priority | Item | Production implementation | Verification |
|---|---|---|---|
| P0 | Clean title output | `sanitizeTitles()` removes headings, explanations, numbering and malformed entries | API unit test |
| P0 | Inject RAG into generation | Platform-scoped official sources are injected into article prompts; unknown platforms fail to an unsourced AI label | API source-isolation test |
| P1 | Quality score breakdown | Five dimensions, total and actionable suggestions are returned and rendered | API unit test + both Web builds |
| P1 | AI vs knowledge label | Every article response includes provenance, sources and a verification disclaimer | API unit test + UI |
| P1 | Friendly quota handling | HTTP 429 and local point limits present an explicit explanation and plan/points action | both Web builds |
| P2 | Bilingual prompt consistency | Chinese and international prompts share safety requirements but use independent market-native structures | language isolation gate |
| P2 | Skills empty state | Skills are grouped by user job; unverified capabilities are explicitly shown as coming soon | real browser screenshots |

Additional P0 found by real-browser testing:

- The domestic Web app imported Tailwind without the required PostCSS plugin.
  CI builds succeeded, but the rendered application had almost no utility CSS.
  `@tailwindcss/postcss`, `postcss.config.mjs`, and class-controlled dark mode
  are now configured.

Evidence:

- `ui-p0p1p2-cn-create.png`
- `ui-p0p1p2-cn-skills.png`
- `ui-p0p1p2-int-create.png`
- `ui-p0p1p2-int-skills.png`
- GitHub Actions CI run `30492426578` (API tests/build, both Web builds,
  dependency audit, language contract and production Compose validation)

External sources are platform-filtered. Social posts never qualify as production
evidence. Source links were checked on 2026-07-30 and must be refreshed through
the governed knowledge-update workflow.
