/**
 * Phase 4 新功能自动化测试
 * 测试所有新增页面的加载和基本功能
 */

const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:3000';

const testPages = [
    {
        name: '增长诊断中心',
        path: '/growth',
        selectors: ['text=增长诊断中心', 'text=AI 驱动的增长策略'],
    },
    {
        name: '变现中心',
        path: '/monetization',
        selectors: ['text=变现中心', 'text=全方位管理您的内容变现'],
    },
    {
        name: '人设模板库',
        path: '/persona',
        selectors: ['text=人设模板库', 'text=选择或创建适合您的人设风格'],
    },
    {
        name: '竞品监控',
        path: '/competitor',
        selectors: ['text=竞品监控', 'text=关注行业标杆'],
    },
    {
        name: '每日热点',
        path: '/hot',
        selectors: ['text=每日热点', 'text=追踪全网热点'],
    },
];

async function testPage(page, testCase) {
    console.log(`\n🧪 测试页面: ${testCase.name}`);
    
    try {
        // 访问页面
        await page.goto(`${BASE_URL}${testCase.path}`, { waitUntil: 'networkidle' });
        
        // 检查页面标题/主要元素
        for (const selector of testCase.selectors) {
            const element = await page.locator(selector).first();
            if (await element.isVisible()) {
                console.log(`  ✅ 找到元素: "${selector}"`);
            } else {
                console.log(`  ⚠️  未找到元素: "${selector}"`);
            }
        }
        
        // 检查是否有加载状态
        const loading = await page.locator('text=正在加载').first();
        if (await loading.isVisible({ timeout: 1000 }).catch(() => false)) {
            console.log(`  ⏳ 页面正在加载...`);
            await page.waitForTimeout(1500);
        }
        
        // 检查关键功能元素
        const buttons = await page.locator('button').count();
        const cards = await page.locator('.ant-card').count();
        const tables = await page.locator('.ant-table').count();
        
        console.log(`  📊 按钮数量: ${buttons}`);
        console.log(`  📊 卡片数量: ${cards}`);
        if (tables > 0) {
            console.log(`  📊 表格数量: ${tables}`);
        }
        
        // 检查是否有错误
        const errors = await page.locator('.ant-result').locator('text=错误').count();
        if (errors > 0) {
            console.log(`  ❌ 页面包含错误状态`);
            return false;
        }
        
        console.log(`  ✅ ${testCase.name} 测试通过`);
        return true;
    } catch (error) {
        console.log(`  ❌ ${testCase.name} 测试失败: ${error.message}`);
        return false;
    }
}

async function testNavigation(page) {
    console.log(`\n🧪 测试侧边栏导航`);
    
    try {
        await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
        
        // 检查新菜单项
        const menuItems = [
            { name: '增长诊断', selector: 'text=增长诊断' },
            { name: '变现中心', selector: 'text=变现中心' },
            { name: '人设模板', selector: 'text=人设模板' },
            { name: '竞品监控', selector: 'text=竞品监控' },
            { name: '每日热点', selector: 'text=每日热点' },
        ];
        
        let foundCount = 0;
        for (const item of menuItems) {
            const element = await page.locator(item.selector).first();
            if (await element.isVisible()) {
                console.log(`  ✅ 找到菜单项: ${item.name}`);
                foundCount++;
            } else {
                console.log(`  ⚠️  未找到菜单项: ${item.name}`);
            }
        }
        
        console.log(`  📊 导航菜单项: ${foundCount}/${menuItems.length}`);
        return foundCount === menuItems.length;
    } catch (error) {
        console.log(`  ❌ 导航测试失败: ${error.message}`);
        return false;
    }
}

async function runTests() {
    console.log('🚀 开始 Phase 4 新功能自动化测试');
    console.log(`📍 测试地址: ${BASE_URL}`);
    console.log('='.repeat(50));
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // 监听控制台错误
    const consoleErrors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
        }
    });
    
    let passedTests = 0;
    let totalTests = testPages.length + 1; // +1 for navigation test
    
    // 测试所有页面
    for (const testCase of testPages) {
        const result = await testPage(page, testCase);
        if (result) passedTests++;
    }
    
    // 测试导航
    const navResult = await testNavigation(page);
    if (navResult) passedTests++;
    
    // 报告结果
    console.log('\n' + '='.repeat(50));
    console.log('📊 测试结果汇总');
    console.log('='.repeat(50));
    console.log(`✅ 通过测试: ${passedTests}/${totalTests}`);
    console.log(`❌ 失败测试: ${totalTests - passedTests}/${totalTests}`);
    
    if (consoleErrors.length > 0) {
        console.log('\n⚠️  控制台错误:');
        consoleErrors.forEach(err => console.log(`  - ${err}`));
    } else {
        console.log('\n✅ 无控制台错误');
    }
    
    await browser.close();
    
    // 返回退出码
    process.exit(passedTests === totalTests ? 0 : 1);
}

// 运行测试
runTests().catch(err => {
    console.error('测试执行失败:', err);
    process.exit(1);
});
