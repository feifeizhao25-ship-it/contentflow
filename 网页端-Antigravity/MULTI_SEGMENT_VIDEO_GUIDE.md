# 多段视频生成功能说明

## 功能概述

本系统现在支持生成 **5-60 秒**的可配置时长视频，通过以下方式实现：

1. **短视频（≤10秒）**：直接生成单段视频
2. **长视频（>10秒）**：生成多个 5 秒片段，然后自动拼接成完整视频

## 核心功能

### 1. 可配置时长选择器

用户可以通过滑块选择视频时长：
- **范围**：5-60 秒
- **步进**：5 秒
- **实时反馈**：显示片段数量和预计生成时间

示例：
- 10 秒 → 单段视频，约 60-90 秒
- 30 秒 → 6 个片段，预计 450 秒（~7.5 分钟）
- 60 秒 → 12 个片段，预计 900 秒（~15 分钟）

### 2. 智能分段生成

系统自动将长视频分成多个片段：

```
总时长 30 秒
├── 片段 1 (0-5s): 使用原始 prompt
├── 片段 2 (5-10s): prompt + "continuing from previous scene"
├── 片段 3 (10-15s): prompt + "continuing from previous scene"
├── 片段 4 (15-20s): prompt + "continuing from previous scene"
├── 片段 5 (20-25s): prompt + "continuing from previous scene"
└── 片段 6 (25-30s): prompt + "continuing from previous scene"
```

**一致性保证**：
- 所有片段使用相同的起始图片
- 添加连续性提示词确保场景连贯
- 使用负面提示词避免场景跳跃

### 3. 专业视频拼接

使用 **Shotstack API** 进行视频拼接：

**优势**：
- ✅ 云端处理，无需本地 FFmpeg
- ✅ 专业级视频编辑能力
- ✅ 自动处理转场和时间轴
- ✅ 支持多种分辨率和宽高比

**降级方案**：
- 如果 Shotstack 不可用，返回第一个片段
- 用户仍可获得部分内容

## 使用流程

### 前端操作

1. **进入 AI 创作页面**
2. **勾选"同时生成视频内容"**
3. **选择视频时长**（例如 30 秒）
4. **点击生成按钮**
5. **等待生成完成**

### 后端处理

```
用户请求 30 秒视频
    ↓
生成基础图片（Flux）
    ↓
计算片段数：30 ÷ 5 = 6 个
    ↓
并行/串行生成 6 个视频片段（Kling）
    ├── 片段 1: 75 秒
    ├── 片段 2: 75 秒
    ├── 片段 3: 75 秒
    ├── 片段 4: 75 秒
    ├── 片段 5: 75 秒
    └── 片段 6: 75 秒
    ↓
Shotstack 拼接视频（60-120 秒）
    ↓
返回最终视频 URL
```

## API 端点

### 1. 单段视频生成
```
POST /api/ai/generate-video
Body: {
  "prompt": "视频描述",
  "imageUrl": "图片URL",
  "aspect_ratio": "16:9",
  "duration": "5s" | "10s"
}
```

### 2. 多段视频生成
```
POST /api/ai/generate-multi-segment-video
Body: {
  "prompt": "视频描述",
  "imageUrl": "图片URL",
  "aspect_ratio": "16:9",
  "totalDuration": 30
}

Response: 流式进度更新
{"progress": 10, "status": "Generating segment 1/6..."}
{"progress": 25, "status": "Generating segment 2/6..."}
...
{"progress": 85, "status": "Merging video segments..."}
{"progress": 100, "status": "completed", "result": {...}}
```

### 3. 测试端点
```
GET /api/test/multi-segment-video?duration=15
```

## 配置要求

### 必需的环境变量

```bash
# Fal.ai API（视频生成）
FAL_API_KEY=your_fal_api_key

# Shotstack API（视频拼接）
SHOTSTACK_API_KEY=your_shotstack_api_key  # 可选，但强烈推荐
```

### 获取 Shotstack API Key

1. 访问 https://shotstack.io/
2. 注册账号
3. 在 Dashboard 中获取 API Key
4. 添加到 `.env.local` 文件

**免费额度**：20 次渲染/月

## 成本估算

### Fal.ai（视频生成）

- 单个 5 秒片段：约 $0.10
- 30 秒视频（6 片段）：约 $0.60

### Shotstack（视频拼接）

- 免费层：20 次/月
- Developer 层：$49/月（500 次）
- 每次拼接：约 $0.10

### 总成本示例

生成一个 30 秒视频：
- 图片生成：$0.02
- 6 个视频片段：$0.60
- 视频拼接：$0.10
- **总计：约 $0.72**

## 性能优化建议

### 1. 使用缓存
```typescript
// 缓存已生成的视频
const cacheKey = `video_${prompt}_${duration}`;
const cached = await redis.get(cacheKey);
if (cached) return cached;
```

### 2. 批量生成
```typescript
// 并行生成多个片段（需要更多 API 配额）
const segments = await Promise.all(
    segmentPrompts.map(p => generateSegment(p))
);
```

### 3. 预生成常用时长
- 为热门主题预生成 10s、20s、30s 版本
- 存储在 CDN 中快速访问

## 故障排查

### 问题：视频拼接失败

**可能原因**：
1. Shotstack API Key 未配置
2. API 配额用尽
3. 视频 URL 无法访问

**解决方案**：
1. 检查 `.env.local` 中的 `SHOTSTACK_API_KEY`
2. 查看 Shotstack Dashboard 使用情况
3. 确保视频 URL 公开可访问

### 问题：生成时间过长

**预期时间**：
- 10 秒视频：约 90 秒
- 30 秒视频：约 8-10 分钟
- 60 秒视频：约 15-20 分钟

**优化建议**：
- 使用较短的时长（10-20 秒）
- 考虑异步生成 + 通知机制

### 问题：视频不连贯

**可能原因**：
- Kling 模型的随机性
- Prompt 不够具体

**解决方案**：
- 使用更详细的 prompt
- 添加"smooth transition"等关键词
- 考虑使用相同的 seed（如果 API 支持）

## 未来改进方向

1. **支持更多拼接选项**
   - 添加转场效果
   - 支持背景音乐
   - 添加字幕

2. **优化生成速度**
   - 使用更快的模型
   - 实现并行生成
   - 添加进度预览

3. **增强一致性**
   - 使用视频到视频模型
   - 实现关键帧控制
   - 添加风格迁移

4. **成本优化**
   - 实现智能缓存
   - 支持低质量预览
   - 批量折扣

## 技术架构

```
前端 (React)
    ↓
API 路由 (Next.js)
    ↓
MultiSegmentVideoService
    ├── Fal.ai Client (视频生成)
    └── VideoMergerService
        ├── Shotstack API (首选)
        └── Fallback (返回第一段)
```

## 相关文件

- `/src/lib/multi-segment-video-service.ts` - 多段视频生成服务
- `/src/lib/video-merger-service.ts` - 视频拼接服务
- `/src/app/api/ai/generate-multi-segment-video/route.ts` - API 端点
- `/src/app/(main)/ai-create/page.tsx` - 前端 UI
- `/VIDEO_MERGING_SETUP.md` - 配置指南

## 总结

多段视频生成功能为用户提供了灵活的视频时长选择，同时保持了视频的连贯性和质量。通过专业的视频拼接服务，系统能够自动处理复杂的视频编辑任务，为用户提供完整的长视频内容。
