import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { contentflowCanonical, readUiRegistries } from './contentflow.mjs';
import { canonicalFromEnergy, canonicalFromJianji, canonicalFromShunshi, normalize } from './normalize.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '../fixtures');
const goldenDir = join(here, '../golden');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function golden(name) {
  return readJson(join(goldenDir, `${name}.export.json`));
}

test('contentflow export matches the plans source and both UI registries', () => {
  const exported = normalize(contentflowCanonical());
  assert.deepEqual(exported, golden('contentflow'));
  const ui = readUiRegistries();
  const cn = exported.markets.find((market) => market.id === 'cn');
  const intl = exported.markets.find((market) => market.id === 'intl');
  for (const plan of cn.plans) {
    const tier = ui.cn.tiers[plan.id];
    assert.equal(tier.name, plan.name);
    assert.equal(tier.priceMonthlyCny, plan.priceMonthly);
    assert.equal(tier.priceYearlyCny, plan.priceYearly);
    assert.equal(tier.custom, plan.custom);
    assert.deepEqual(tier.features, plan.features);
    assert.equal(tier.quotas.platformAccounts, plan.quotas.platformAccounts);
    assert.equal(tier.quotas.monthlyPosts, plan.quotas.monthlyPosts);
    assert.equal(tier.quotas.monthlyAiTokens, plan.quotas.monthlyAiTokens);
  }
  for (const plan of intl.plans) {
    const tier = ui.intl.tiers[plan.id];
    assert.equal(tier.name, plan.name);
    assert.equal(tier.priceMonthlyUsd, plan.priceMonthly);
    assert.equal(tier.custom, plan.custom);
    assert.deepEqual(tier.features, plan.features);
    assert.equal(tier.platformLimit, plan.quotas.platformAccounts);
    assert.equal(tier.monthlyPostQuota, plan.quotas.monthlyPosts);
    assert.equal(tier.aiTokenQuota, plan.quotas.monthlyAiTokens);
  }
});

test('shunshi fixture keeps family_members 3 and yearly SKUs only', () => {
  const fixture = readJson(join(fixtureDir, 'shunshi.json'));
  assert.equal(fixture.fixture, true);
  const exported = normalize(canonicalFromShunshi(fixture));
  assert.deepEqual(exported, golden('shunshi'));
  const family = exported.markets[0].plans.find((plan) => plan.id === 'family');
  assert.equal(family.quotas.family_members, 3);
  assert.ok(exported.markets[0].purchasableSkus.length > 0);
  assert.ok(exported.markets[0].purchasableSkus.every((sku) => sku.includes('yearly')));
  const legacy = Object.keys(fixture.registry.legacy_product_tier_map ?? {});
  assert.ok(legacy.length > 0);
  for (const sku of legacy) assert.equal(exported.markets[0].purchasableSkus.includes(sku), false);
});

test('jianji fixture exports daily_chat 3/20/60 and no prices', () => {
  const fixture = readJson(join(fixtureDir, 'jianji.json'));
  assert.equal(fixture.fixture, true);
  const exported = normalize(canonicalFromJianji(fixture));
  assert.deepEqual(exported, golden('jianji'));
  assert.deepEqual(exported.markets[0].plans.map((plan) => plan.quotas.daily_chat).sort((a, b) => a - b), [3, 20, 60]);
  assert.ok(exported.markets[0].plans.every((plan) => plan.priceMonthly === null && plan.priceYearly === null));
});

test('energy fixture keeps CNY yearly prices and an empty USD international market', () => {
  const fixture = readJson(join(fixtureDir, 'energy.json'));
  assert.equal(fixture.fixture, true);
  const exported = normalize(canonicalFromEnergy(fixture));
  assert.deepEqual(exported, golden('energy'));
  const cn = exported.markets.find((market) => market.id === 'cn');
  const intl = exported.markets.find((market) => market.id === 'intl');
  assert.equal(cn.currency, 'CNY');
  assert.equal(intl.currency, 'USD');
  assert.deepEqual(intl.plans, []);
  assert.equal(JSON.stringify(intl).includes('CNY'), false);
  for (const plan of cn.plans) {
    assert.equal(plan.priceYearly, fixture.registry.tiers[plan.id].price.yearly_cny);
    assert.equal(plan.priceMonthly, null);
  }
});

test('a changed quota does not match the golden export', () => {
  const exported = normalize(contentflowCanonical());
  exported.markets[0].plans[0].quotas.platformAccounts += 1;
  assert.notDeepEqual(exported, golden('contentflow'));
});
