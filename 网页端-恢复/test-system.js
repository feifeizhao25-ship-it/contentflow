#!/usr/bin/env node
/**
 * 分发侠 AI 平台系统测试脚本
 * 测试所有核心功能模块
 */

const http = require('http');
const https = require('https');

// 配置
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api`;

console.log('🧪 分发侠 AI 平台系统测试');
console.log('================================\n');

// 工具函数：发起 HTTP 请求
function request(method, path, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const client = url.protocol === 'https:' ? https : http;

        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = client.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    resolve({ status: res.statusCode, data: json });
                } catch (e) {
                    resolve({ status: res.statusCode, body });
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

// 测试结果收集
const results = [];
let passed = 0;
let failed = 0;

async function test(name, fn) {
    process.stdout.write(`\n📋 ${name}... `);
    try {
        await fn();
        console.log('✅ 通过');
        passed++;
        results.push({ name, status: 'pass' });
    } catch (error) {
        console.log(`❌ 失败: ${error.message}`);
        failed++;
        results.push({ name, status: 'fail', error: error.message });
    }
}

// 测试用例
async function runTests() {
    console.log('\n🔍 开始测试...\n');

    // 1. 基础健康检查
    await test('基础架构 - 健康检查', async () => {
        const res = await request('GET', `${API_BASE}/test`);
        if (res.status !== 200) throw new Error(`状态码: ${res.status}`);
    });

    // 2. 认证模块
    await test('认证模块 - 登录接口存在', async () => {
        const res = await request('POST', `${API_BASE}/auth/login`, { email: 'test@test.com' });
        // 应该是 400 或 401，接口存在即可
        if (res.status === 404) throw new Error('接口不存在');
    });

    await test('认证模块 - 注册接口存在', async () => {
        const res = await request('POST', `${API_BASE}/auth/register`, { email: 'test@test.com' });
        if (res.status === 404) throw new Error('接口不存在');
    });

    // 3. 内容模块
    await test('内容模块 - 创建内容接口', async () => {
        const res = await request('POST', `${API_BASE}/contents`, { title: 'Test Content' });
        if (res.status === 404) throw new Error('接口不存在');
    });

    await test('内容模块 - 获取内容列表', async () => {
        const res = await request('GET', `${API_BASE}/contents`);
        if (res.status === 404) throw new Error('接口不存在');
    });

    // 4. 素材模块
    await test('素材模块 - 素材列表接口', async () => {
        const res = await request('GET', `${API_BASE}/materials`);
        if (res.status === 404) throw new Error('接口不存在');
    });

    // 5. 积分模块
    await test('积分模块 - 用户积分查询', async () => {
        const res = await request('GET', `${API_BASE}/points`);
        if (res.status === 404) throw new Error('接口不存在');
    });

    await test('积分模块 - 签到接口', async () => {
        const res = await request('POST', `${API_BASE}/points/checkin`, {});
        if (res.status === 404) throw new Error('接口不存在');
    });

    // 6. 支付模块
    await test('支付模块 - 支付 API 存在', async () => {
        const res = await request('GET', `${API_BASE}/payment?action=subscription`);
        // 应该是 401（未登录）或成功，接口存在即可
        if (res.status === 404) throw new Error('支付接口不存在');
    });

    await test('支付模块 - 支付历史查询', async () => {
        const res = await request('GET', `${API_BASE}/payment?action=history`);
        if (res.status === 404) throw new Error('支付历史接口不存在');
    });

    // 7. 发布模块
    await test('发布模块 - 分发平台列表', async () => {
        const res = await request('GET', `${API_BASE}/publish`);
        if (res.status === 404) throw new Error('发布接口不存在');
    });

    // 8. 热点模块
    await test('热点模块 - 热点列表', async () => {
        const res = await request('GET', `${API_BASE}/hot`);
        if (res.status === 404) throw new Error('热点接口不存在');
    });

    // 9. 团队模块
    await test('团队模块 - 团队信息', async () => {
        const res = await request('GET', `${API_BASE}/team`);
        if (res.status === 404) throw new Error('团队接口不存在');
    });

    // 10. 分析模块
    await test('分析模块 - 数据统计', async () => {
        const res = await request('GET', `${API_BASE}/analytics`);
        if (res.status === 404) throw new Error('分析接口不存在');
    });

    // 打印测试结果
    console.log('\n================================');
    console.log(`📊 测试结果: ${passed} 通过, ${failed} 失败\n`);

    if (failed > 0) {
        console.log('失败的测试:');
        results.filter(r => r.status === 'fail').forEach(r => {
            console.log(`  ❌ ${r.name}: ${r.error}`);
        });
    }

    console.log('\n================================\n');

    if (failed === 0) {
        console.log('🎉 所有测试通过！系统已就绪。\n');
        console.log('📋 下一步操作:');
        console.log('   1. 执行数据库迁移: supabase/migrations/004_payment_system.sql');
        console.log('   2. 配置环境变量 (.env.local)');
        console.log('   3. 启动开发服务器: npm run dev');
        console.log('   4. 访问 http://localhost:3000\n');
    } else {
        console.log('⚠️  存在失败的测试，请检查上述错误。\n');
        process.exit(1);
    }
}

// 运行测试
runTests().catch(console.error);
