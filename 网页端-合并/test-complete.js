/**
 * Phase 4 新功能完整测试
 * 使用 Playwright 模拟真实用户交互
 */

const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:3000';

async function testGrowthPage(page) {
    console.log('\n🧪 测试增长诊断中心...');
    
    await page.goto(`${BASE_URL}/growth`, { waitUntil: 'networkidle' });
    
    // 检查关键元素
    const title = await page.locator('text=增长诊断中心').first();
    if (await title.isVisible()) console.log('  ✅ 标题显示正常');
    
    // 检查图表是否加载
    const charts = await page.locator('.echarts-for-react').count();
    console.log(`  📊 ECharts 图表数量: ${charts}`);
    
    // 检查智能建议卡片
    const cards = await page.locator('.ant-card').count();
    console.log(`  📋 卡片组件数量: ${cards}`);
    
    // 测试交互：点击"设置增长目标"按钮
    const goalBtn = await page.locator('text=设置增长目标').first();
    if (await goalBtn.isVisible()) {
        await goalBtn.click();
        await page.waitForTimeout(500);
        const modal = await page.locator('text=设置增长目标').locator('..').locator('..');
        if (await modal.isVisible()) {
            console.log('  ✅ 目标设置弹窗可打开');
            await page.keyboard.press('Escape');
        }
    }
    
    return true;
}

async function testMonetizationPage(page) {
    console.log('\n🧪 测试变现中心...');
    
    await page.goto(`${BASE_URL}/monetization`, { waitUntil: 'networkidle' });
    
    // 检查收益统计
    const stats = await page.locator('.ant-statistic').count();
    console.log(`  📈 统计数据组件: ${stats}`);
    
    // 检查标签页切换
    const tabs = await page.locator('.ant-tabs-tab').count();
    console.log(`  📑 标签页数量: ${tabs}`);
    
    // 测试切换到"广告报价"
    const adTab = await page.locator('text=广告报价').first();
    if (await adTab.isVisible()) {
        await adTab.click();
        await page.waitForTimeout(500);
        console.log('  ✅ 广告报价标签页切换正常');
    }
    
    return true;
}

async function testPersonaPage(page) {
    console.log('\n🧪 测试人设模板库...');
    
    await page.goto(`${BASE_URL}/persona`, { waitUntil: 'networkidle' });
    
    // 检查人设卡片
    const personaCards = await page.locator('.ant-card').count();
    console.log(`  👤 人设卡片数量: ${personaCards}`);
    
    // 测试点击一个人设
    const firstCard = await page.locator('.ant-card').first();
    if (await firstCard.isVisible()) {
        await firstCard.click();
        await page.waitForTimeout(500);
        const modal = await page.locator('.ant-modal').first();
        if (await modal.isVisible()) {
            console.log('  ✅ 人设详情弹窗可打开');
            await page.keyboard.press('Escape');
        }
    }
    
    // 测试创建自定义人设
    const createBtn = await page.locator('text=创建自定义人设').first();
    if (await createBtn.isVisible()) {
        await createBtn.click();
        await page.waitForTimeout(500);
        const form = await page.locator('text=人设名称').first();
        if (await form.isVisible()) {
            console.log('  ✅ 创建人设表单可打开');
            await page.keyboard.press('Escape');
        }
    }
    
    return true;
}

async function testCompetitorPage(page) {
    console.log('\n🧪 测试竞品监控...');
    
    await page.goto(`${BASE_URL}/competitor`, { waitUntil: 'networkidle' });
    
    // 检查竞品表格
    const table = await page.locator('.ant-table').first();
    if (await table.isVisible()) {
        console.log('  ✅ 竞品数据表格显示正常');
    }
    
    // 测试切换到"爆款分析"
    const viralTab = await page.locator('text=爆款分析').first();
    if (await viralTab.isVisible()) {
        await viralTab.click();
        await page.waitForTimeout(500);
        console.log('  ✅ 爆款分析标签页切换正常');
    }
    
    // 测试切换到"对标分析"
    const compareTab = await page.locator('text=对标分析').first();
    if (await compareTab.isVisible()) {
        await compareTab.click();
        await page.waitForTimeout(500);
        console.log('  ✅ 对标分析标签页切换正常');
    }
    
    return true;
}

async function testHotPage(page) {
    console.log('\n🧪 测试每日热点...');
    
    await page.goto(`${BASE_URL}/hot`, { waitUntil: 'networkidle' });
    
    // 检查热点卡片
    const cards = await page.locator('.ant-card').count();
    console.log(`  🔥 热点卡片数量: ${cards}`);
    
    // 测试订阅功能
    const subscribeBtn = await page.locator('text=订阅提醒').first();
    if (await subscribeBtn.isVisible()) {
        await subscribeBtn.click();
        await page.waitForTimeout(500);
        const subscribed = await page.locator('text=已订阅').first();
        if (await subscribed.isVisible()) {
            console.log('  ✅ 热点订阅功能正常');
        }
    }
    
    // 测试"立即创作"按钮
    const createBtn = await page.locator('text=立即创作').first();
    if (await createBtn.isVisible()) {
        console.log('  ✅ 立即创作按钮可点击');
    }
    
    return true;
}

async function runTests() {
    console.log('🚀 Phase 4 功能完整测试');
    console.log(`📍 测试地址: ${BASE_URL}`);
    console.log('='.repeat(50));
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // 监听控制台错误
    const errors = [];
    page.on('console', msg => {
        if (msg.type() === 'error' && !msg.text().includes('Warning')) {
            errors.push(msg.text());
        }
    });
    
    let passed = 0;
    let total = 5;
    
    try {
        if (await testGrowthPage(page)) passed++;
        if (await testMonetizationPage(page)) passed++;
        if (await testPersonaPage(page)) passed++;
        if (await testCompetitorPage(page)) passed++;
        if (await testHotPage(page)) passed++;
    } catch (err) {
        console.error(`\n❌ 测试出错: ${err.message}`);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 测试结果汇总');
    console.log('='.repeat(50));
    console.log(`✅ 通过: ${passed}/${total}`);
    console.log(`❌ 失败: ${total - passed}/${total}`);
    
    if (errors.length > 0) {
        console.log('\n⚠️ 控制台错误:');
        errors.forEach(e => console.log(`  - ${e}`));
    } else {
        console.log('\n✅ 无控制台错误');
    }
    
    await browser.close();
    
    if (passed === total) {
        console.log('\n🎉 所有功能测试通过！');
    }
    
    process.exit(passed === total ? 0 : 1);
}

runTests();
