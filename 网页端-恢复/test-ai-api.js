#!/usr/bin/env node
/**
 * AI API 测试脚本
 * 验证大模型接入是否正常
 */

const http = require('http');
const https = require('https');

const BASE_URL = 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api`;

console.log('🧪 AI API 测试');
console.log('================================\n');

// 工具函数：发起 HTTP 请求
function request(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const client = url.protocol === 'https:' ? https : http;

        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method,
            headers: {
                'Content-Type': 'application/json'
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

// 测试用例
async function runTests() {
    console.log('🔍 开始测试 AI 生成接口...\n');

    // 测试 AI 脚本生成
    await testAIGenerate();

    // 测试 AI 服务直接调用
    await testAIService();
}

async function testAIGenerate() {
    console.log('📝 测试 1: AI 脚本生成 API');

    const testCases = [
        {
            name: '短视频脚本生成',
            data: {
                topic: '如何用 AI 制作爆款视频',
                platform: '抖音',
                type: '知识分享',
                length: '60s'
            }
        }
    ];

    for (const testCase of testCases) {
        process.stdout.write(`  - ${testCase.name}... `);

        try {
            const startTime = Date.now();
            const res = await request('POST', `${API_BASE}/ai/generate-script`, testCase.data);
            const duration = Date.now() - startTime;

            if (res.status === 200 && res.data.title) {
                console.log(`✅ 成功 (${duration}ms)`);
                console.log(`  标题: ${res.data.title}`);
                console.log(`  分镜数: ${res.data.scenes?.length || 0}`);
                if (res.data.scenes?.[0]) {
                    console.log(`  首个分镜: ${res.data.scenes[0].subtitle}`);
                }
            } else {
                console.log(`❌ 失败: ${JSON.stringify(res.data)}`);
            }
        } catch (error) {
            console.log(`❌ 错误: ${error.message}`);
        }
    }
}

async function testAIService() {
    console.log('\n📝 测试 2: AI 服务直接调用');
    process.stdout.write('  - SiliconFlow API... ');

    try {
        const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.SILICONFLOW_API_KEY}`
            },
            body: JSON.stringify({
                model: 'Qwen/Qwen2.5-72B-Instruct',
                messages: [
                    { role: 'user', content: '你好，请用一句话介绍你自己' }
                ],
                max_tokens: 100,
                temperature: 0.7
            })
        });

        if (response.ok) {
            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            console.log(`✅ 成功`);
            console.log(`  回复: ${content?.slice(0, 50)}...`);
        } else {
            const error = await response.text();
            console.log(`❌ API 错误: ${response.status}`);
            console.log(`  ${error.slice(0, 200)}`);
        }
    } catch (error) {
        console.log(`❌ 请求失败: ${error.message}`);
    }

    // 测试 OpenRouter
    process.stdout.write('  - OpenRouter API... ');

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'https://fenfa.ai',
                'X-Title': 'FenfaAI'
            },
            body: JSON.stringify({
                model: 'deepseek/deepseek-chat',
                messages: [
                    { role: 'user', content: '你好，请用一句话介绍你自己' }
                ],
                max_tokens: 100
            })
        });

        if (response.ok) {
            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            console.log(`✅ 成功`);
            console.log(`  回复: ${content?.slice(0, 50)}...`);
        } else {
            console.log(`❌ API 错误: ${response.status}`);
        }
    } catch (error) {
        console.log(`❌ 请求失败: ${error.message}`);
    }
}

runTests().catch(console.error);
