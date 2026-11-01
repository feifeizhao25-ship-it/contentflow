# ContentFlow international compliance audit (FTC / EU AI Act Art. 50 / UK ASA-CAP)

Date: 2026-11-01 (Asia/Shanghai). Scope: the global edition (`MARKET_REGION=global`). The China edition is unchanged.
Rule set version after this change: `intl-content-2026.11.01`. This is an engineering audit, **not legal advice**; a lawyer should review before the global edition goes live.

## Sources read for this audit

| Source | How it was read | Used for |
|---|---|---|
| 16 CFR 255.0(f), 255.1, 255.5 (eCFR, versioner API, date 2026-10-29) | full text | clear and conspicuous; unavoidable on social media; liability; material connections |
| 16 CFR Part 465 (eCFR, same date) | full text | 465.2 fake reviews and testimonials; 465.8 fake social-media indicators |
| UK CAP Code rules 2.1, 2.3 (asa.org.uk) | page text | obviously identifiable marketing; commercial intent |
| ASA, Recognising ads: social media and influencer marketing | page text | upfront "Ad"; labels that are not enough; code alone not enough; buried hashtags |
| Regulation (EU) 2024/1689 Art. 50 (EUR-Lex) | full article | 50(2) provider marking, machine-readable; 50(4) deployer disclosure |
| EC Art. 50 FAQ and Code of Practice page (EC digital strategy) | page text | application date 2 Aug 2026; grace to 2 Dec 2026 for systems already on the market; Code is voluntary (published 10 Jun 2026) |

Not re-readable on 2026-11-01: the FTC "Disclosures 101" page (ftc.gov blocks the fetch). The US weak-label list (`#sp`, `#spon`, `#collab`, stand-alone `#thanks` or `#ambassador`) comes from the 2026-10-31 reading already pinned in `target-market.ts`. **Re-verify it by hand.**

## Findings and fixes

| # | Gap found | Rule | Fix | Test |
|---|---|---|---|---|
| 1 | Disclosure check was one generic regex: `#ad`, `sponsored`, `gifted` all passed in every market, although the ASA says "sponsored", "gifted", "affiliate", "sp", "spon" and ambassador labels are not enough | CAP 2.1/2.3, ASA | Per-market label rules (UK, US, IN, SG, OTHER). A weak label gives `INTL-DISCLOSURE-LABEL` with the accepted wording and the source | `international-disclosure-aigc.spec.ts` |
| 2 | Placement was never checked | ASA (upfront), 16 CFR 255.0(f) | UK: label must be near the start. UK and US: a label only inside a trailing hashtag block gives `INTL-DISCLOSURE-PLACEMENT` | same |
| 3 | The creator could not say a post is paid, gifted or affiliate; the check only guessed from keywords | 16 CFR 255.5 | New `commercialRelationship` option (none, paid, gifted, affiliate, own_brand) on content-pack and `/ai/compliance/check`. When set, the market's own label is put on the first line of the script and of every platform variant, before the AI label, never trimmed | content-pack, compliance-counts, platform tests |
| 4 | The generation prompt put the disclosure "at the end" and gave the model free wording | ASA upfront | Prompt now says any disclosure goes at the start and that the label is added automatically when declared | `target-market` tests |
| 5 | No screen for requests to write fake reviews or testimonials, or posing as a customer, patient or expert | 16 CFR 465.2, 255.1 | `INTL-FAKE-REVIEW`, request-only, block, no override | request screen tests |
| 6 | No screen for bought followers, likes or views | 16 CFR 465.8 | `INTL-FAKE-INDICATORS`, request-only, block | same |
| 7 | No screen for removing or hiding the AI label, watermark or metadata, or passing AI work off as human | AI Act 50(2), 50(4) | `INTL-AI-LABEL-REMOVAL`, request-only, block | same |
| 8 | No screen for synthetic face or voice of a real person endorsing a product | 16 CFR 465.2, AI Act 50(4) | `INTL-DEEPFAKE-ENDORSEMENT`, request-only, block | same |
| 9 | Article, script and titles responses had no machine-readable AI marker (only content-pack and image had one); script had no `aiGenerated` flag | AI Act 50(2) | `aiMetadata` (`ai_generated`, generator, model, time, content id) added to the article, script and titles responses via the same settlement path as images; `aiGenerated: true` on script and titles | `ai-controller-aigc.spec.ts` |
| 10 | Requests were screened nowhere before spending quota | cost and safety | `ComplianceService.guardRequest` runs before the budget check and the token hold on article, script, titles, image and content-pack. Global edition only | same |
| 11 | "Not checked" list did not mention the Art. 50(4) deployer duty or review of real reviews | honesty | Added to `INTERNATIONAL_NOT_CHECKED` | `international-disclosure-aigc.spec.ts` |
| 12 | Compliance sources panel listed only FTC, FDA and CAP | transparency | Added Part 465, ASA, AI Act Art. 50 with the 2026-11-01 check date | n/a |

Request-only rules read what the user asked for. They never run on generated output, so an article that explains the fake-review rule is not blocked. The patterns are verb-anchored, and the specs pin both blocked and allowed phrasings.

## Design notes

* Backward compatible: with no `targetMarket` and no `commercialRelationship` the disclosure check behaves as before.
* Label wording per market comes only from wording the market's body names (ASA "Ad", ASCI list, ASAS `#adv` / `#sp`, FTC "ad" / "sponsored"). A test asserts that every label we add passes our own check for every market and relationship.
* The label is checked as it will be published (with the label on the first line).

## What is still open (needs a human)

1. **No invisible watermark and no content-credential (C2PA-style) signature.** The text carries a visible label and the response carries a machine-readable JSON marker. Art. 50(2) asks for a machine-readable marking that is effective, interoperable and robust "as far as technically feasible". Choose a standard (the Commission's Code of Practice, C2PA, or similar) and decide whether to sign the voluntary Code of Practice. Art. 50(2) applies to systems already on the market from **2 Dec 2026** (grace period per the Commission FAQ read on 2026-11-01).
2. **Art. 50(4) deployer duties** (deepfake disclosure; AI text on matters of public interest published without human review) fall on the person who publishes. The product cannot know. The check lists this under "not checked".
3. **US weak-label list** needs a manual re-read of FTC Disclosures 101.
4. **No check that a real person wrote a real review.** Only requests for fakes are blocked.
5. **Country coverage** is US, UK, IN, SG and a generic OTHER. EU member-state advertising law and influencer rules (for example France, Germany) are not encoded.
6. **Keyword and pattern screens can miss paraphrases and can over-block.** They are a screen, not a decision.
7. Lawyer review of the user-facing wording before launch.
