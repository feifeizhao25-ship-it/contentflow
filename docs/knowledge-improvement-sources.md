# Knowledge and skill improvement sources

Production knowledge is never rewritten directly from search results. Automation
may discover, deduplicate, license-check, quarantine and evaluate a candidate.
Publication requires a named reviewer, evidence and safety scores of at least
0.85, a versioned release and a rollback target.

## Source priority

1. Regulators and official platform/API documentation.
2. Peer-reviewed papers and maintained open-source projects with compatible
   licenses.
3. Hugging Face models/datasets after model-card, license, provenance and local
   benchmark checks.
4. Social posts are discovery leads only; they cannot support a production claim
   without independent authoritative corroboration.

## Seed catalog

| Scope | Source | Use | Intake |
|---|---|---|---|
| Evaluation | [RAGAS](https://arxiv.org/abs/2309.15217) | Faithfulness and relevance methodology | Method/citation |
| Governance | [NIST AI TEVV](https://www.nist.gov/ai-test-evaluation-validation-and-verification-tevv) | Evaluation controls | Method/citation |
| China compliance | [CAC generative AI measures](https://www.cac.gov.cn/2023-07/13/c_1690898327029107.htm) | Compliance rules | Citation only |
| EU compliance | [EU transparency guidance](https://digital-strategy.ec.europa.eu/en/library/guidelines-transparency-obligations-providers-and-deployers-ai-systems) | Transparency checks | Citation only |
| Social scheduling | [Mixpost](https://github.com/inovector/mixpost) | Architecture comparison | Code review, MIT |
| Multilingual evaluation | [MultiSocial](https://aclanthology.org/2025.acl-long.36/) | Cross-platform multilingual benchmark | Method/citation |
| Localized safety | [RabakBench](https://github.com/govtech-responsibleai/RabakBench) | Localized safety evaluation | Controlled benchmark |

Review cadence: platform/API rules weekly; regulations monthly; models,
libraries and benchmarks monthly; stable research methods quarterly.
