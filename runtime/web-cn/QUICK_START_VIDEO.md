# 🎬 多段视频功能快速开始

## 🚀 5 分钟快速配置

### 步骤 1: 配置 Shotstack API（可选但推荐）

```bash
# 1. 访问 https://shotstack.io/ 并注册
# 2. 获取 API Key
# 3. 添加到 .env.local

echo "SHOTSTACK_API_KEY=your_api_key_here" >> .env.local
```

**免费额度**：20 次渲染/月，足够测试使用

### 步骤 2: 重启开发服务器

```bash
npm run dev
```

### 步骤 3: 测试功能

访问 http://localhost:3000/ai-create

1. ✅ 勾选"同时生成视频内容"
2. ✅ 拖动滑块选择时长（例如 15 秒）
3. ✅ 输入主题并生成

## 📊 功能对比

| 时长 | 片段数 | 生成时间 | 成本 | 推荐场景 |
|------|--------|----------|------|----------|
| 5-10s | 1 | ~90s | $0.10 | 快速预览 |
| 15-20s | 3-4 | ~4-6min | $0.40 | 社交媒体 |
| 30s | 6 | ~8-10min | $0.70 | 完整故事 |
| 60s | 12 | ~15-20min | $1.30 | 长视频内容 |

## 🎯 使用建议

### 最佳实践

1. **首次测试**：使用 10 秒（单段）
2. **日常使用**：15-20 秒（平衡质量和速度）
3. **重要内容**：30-60 秒（完整表达）

### Prompt 技巧

**好的 Prompt**：
```
"A serene mountain landscape at sunrise, 
gentle camera pan from left to right, 
soft golden lighting, cinematic"
```

**避免**：
```
"Mountain"  # 太简短
"Many different scenes changing rapidly"  # 会导致不连贯
```

## 🔧 故障排查

### 问题：没有 Shotstack API Key

**影响**：视频会生成多个片段，但只返回第一个片段

**解决**：
1. 注册 Shotstack（免费）
2. 配置 API Key
3. 重启服务器

### 问题：生成时间太长

**正常时间**：
- 15 秒视频：约 4-6 分钟
- 30 秒视频：约 8-10 分钟

**如果超过预期**：
- 检查网络连接
- 查看控制台日志
- 尝试较短时长

## 📝 测试清单

- [ ] 单段视频（10 秒）生成成功
- [ ] 多段视频（15 秒）生成成功
- [ ] 视频拼接成功（需要 Shotstack）
- [ ] 进度显示正常
- [ ] 视频播放流畅

## 🎉 完成！

现在您可以生成 5-60 秒的自定义时长视频了！

**下一步**：
- 尝试不同的时长设置
- 测试不同的 prompt 风格
- 查看 `MULTI_SEGMENT_VIDEO_GUIDE.md` 了解更多详情
