# Ralph Wiggum 插件测试文档

本文档记录了如何使用 Ralph Wiggum 插件在「分发侠」项目中进行迭代式开发测试。

## 插件安装验证

```bash
# 验证插件安装
ls ~/Library/Application\ Support/Claude/plugins/ralph-wiggum/

# 插件结构
ralph-wiggum/
├── .claude-plugin/
│   └── plugin.json          # 插件配置
├── commands/
│   ├── ralph-loop.md        # 启动循环命令
│   ├── cancel-ralph.md      # 取消循环命令
│   └── help.md              # 帮助文档
├── hooks/
│   ├── hooks.json           # Hook 配置
│   └── stop-hook.sh         # Stop hook 脚本
├── scripts/
│   └── setup-ralph-loop.sh  # 设置脚本
└── README.md
```

## 插件概述

Ralph Wiggum 插件实现了 Geoffrey Huntley 的 "Ralph Wiggum" 技术，通过 Stop hook 机制创建自参照的 AI 循环，让 Claude 持续迭代直到任务完成。

## 前置条件

确保插件已正确安装：
```bash
ls ~/Library/Application\ Support/Claude/plugins/ralph-wiggum/
```

## 测试用例

### 测试 1: 创建新的 API 路由

**场景**: 添加一个新的用户统计 API 端点

**命令**:
```
/ralph-loop "
创建一个用户活跃度统计 API:
1. 在 src/app/api/analytics/ 下创建 user-stats/route.ts
2. 实现 GET 方法，返回用户登录次数、内容发布数、互动数据
3. 添加参数: start_date, end_date, user_id (可选)
4. 输出 <promise>COMPLETE</promise> 当创建完成

要求:
- 遵循现有 API 路由的代码风格
- 添加 TypeScript 类型定义
- 包含基本的错误处理
" --completion-promise "COMPLETE" --max-iterations 20
```

**预期结果**:
- 创建 `src/app/api/analytics/user-stats/route.ts`
- 实现 GET 请求处理
- 包含参数验证和错误处理
- 代码风格与现有文件一致

---

### 测试 2: 添加新的 UI 组件

**场景**: 创建用户设置页面中的通知偏好设置组件

**命令**:
```
/ralph-loop "
创建通知偏好设置组件:
1. 在 src/components/settings/ 下创建 NotificationSettings.tsx
2. 实现开关: 邮件通知、站内信通知、推送通知
3. 支持保存偏好设置到后端 API
4. 添加加载状态和错误提示
5. 输出 <promise>COMPLETE</promise> 当组件完成

要求:
- 使用 Ant Design 组件
- 遵循项目现有的组件结构
- 包含 TypeScript 类型
" --completion-promise "COMPLETE" --max-iterations 25
```

**预期结果**:
- 创建 `src/components/settings/NotificationSettings.tsx`
- 组件可正常工作
- 样式与项目一致

---

### 测试 3: 代码重构

**场景**: 优化 AI 服务模块的错误处理

**命令**:
```
/ralph-loop "
优化 ai-service.ts 的错误处理:
1. 为每个 AI 提供商添加统一的错误类型
2. 实现重试机制 (最多 3 次)
3. 添加详细的错误日志
4. 创建 src/lib/ai-errors.ts 存放错误类型定义
5. 输出 <promise>COMPLETE</promise> 当重构完成

要求:
- 保持 API 接口不变
- 添加单元测试验证错误处理
" --completion-promise "COMPLETE" --max-iterations 30
```

**预期结果**:
- 创建 `src/lib/ai-errors.ts`
- 修改 `ai-service.ts` 添加错误处理
- 添加测试用例

---

### 测试 4: 数据库迁移

**场景**: 为素材库添加标签功能

**命令**:
```
/ralph-loop "
为素材库添加标签功能:
1. 在 supabase/migrations/ 创建新的迁移文件
2. 添加 materials 表的 tags 字段 (JSONB 类型)
3. 创建 API 端点支持标签的增删改查
4. 更新素材库前端组件支持标签选择
5. 输出 <promise>COMPLETE</promise> 当功能完成

要求:
- 编写可执行的 SQL 迁移脚本
- 保持数据完整性
- 前端组件有良好的用户体验
" --completion-promise "COMPLETE" --max-iterations 35
```

**预期结果**:
- 创建数据库迁移文件
- 标签功能可正常工作

---

### 测试 5: Bug 修复迭代

**场景**: 修复视频生成 API 的超时问题

**命令**:
```
/ralph-loop "
修复视频生成 API 超时问题:
1. 分析当前 src/app/api/ai/generate-video/route.ts 的超时原因
2. 实现流式响应或分块处理
3. 添加超时配置和环境变量支持
4. 测试生成 10 秒、30 秒、60 秒视频
5. 输出 <promise>COMPLETE</promise> 当问题解决

注意: 如果 15 次迭代仍未解决，输出当前尝试的解决方案摘要
" --completion-promise "COMPLETE" --max-iterations 30
```

**预期结果**:
- 超时问题得到缓解
- 支持配置超时时间
- 有良好的用户反馈

---

## 常用命令

### 启动循环
```bash
/ralph-loop "任务描述" --completion-promise "COMPLETE" --max-iterations 50
```

### 取消循环
```bash
/cancel-ralph
```

### 查看帮助
```bash
/help
```

## 最佳实践

1. **设置合理的 max-iterations**: 建议 20-50 之间
2. **明确的完成标准**: 在 prompt 中清晰定义什么是"完成"
3. **增量任务**: 将大任务拆分为小步骤
4. **使用 escape hatch**: 当卡住时，记录当前状态和建议方案

## 故障排除

### 插件不工作
- 检查插件目录: `~/Library/Application Support/Claude/plugins/ralph-wiggum/`
- 重启 Claude Code

### 循环无法退出
- 使用 `/cancel-ralph` 取消循环
- 检查是否正确设置了 completion-promise

### 迭代次数过多
- 简化任务描述
- 增加 --max-iterations 限制
- 考虑任务是否适合使用 Ralph

## 注意事项

1. Ralph Wiggum 适合**有明确成功标准**的任务
2. 不适合需要**人工判断**或**设计决策**的任务
3. 确保有**版本控制**，以便回滚
4. 设置合理的**安全限制**防止无限循环

## CLI 使用方法

### 方法 1: Claude Code 桌面应用（推荐）

1. 打开 Claude Code 桌面应用
2. 在对话中输入 `/ralph-loop` 命令启动迭代

### 方法 2: Claude CLI（需要 API 配额）

```bash
# 加载插件并运行
cd /Users/feifei00/Documents/fenfa-ai
/Users/feifei00/.local/bin/claude --plugin-dir ~/Library/Application\ Support/Claude/plugins/ralph-wiggum -p "你的任务描述" --completion-promise "COMPLETE" --max-iterations 20
```

### 方法 3: Cline CLI 迭代测试（推荐）

#### 步骤 1: 配置 Cline 认证
```bash
# 配置 Anthropic API
/Users/feifei00/.nvm/versions/node/v22.21.1/bin/cline auth -p anthropic -k YOUR_API_KEY -m claude-sonnet-4-5-20250514

# 或配置 OpenAI
/Users/feifei00/.nvm/versions/node/v22.21.1/bin/cline auth -p openai-native -k YOUR_API_KEY -m gpt-4o
```

#### 步骤 2: 运行迭代测试
```bash
cd /Users/feifei00/Documents/fenfa-ai
./cline-ralph-test.sh
```

#### 步骤 3: 查看测试日志
```bash
cat /Users/feifei00/Documents/fenfa-ai/cline-ralph-log.txt
```

### 方法 4: 使用自动化脚本

创建 `run-ralph-test.sh` 脚本：

```bash
#!/bin/bash
# run-ralph-test.sh - Ralph Wiggum 自动化测试脚本

PROJECT_DIR="/Users/feifei00/Documents/fenfa-ai"
PLUGIN_DIR="$HOME/Library/Application Support/Claude/plugins/ralph-wiggum"
CLAUDE_CLI="/Users/feifei00/.local/bin/claude"

echo "🚀 开始 Ralph Wiggum 自动化测试"
echo "📁 项目目录: $PROJECT_DIR"
echo "🔌 插件目录: $PLUGIN_DIR"

# 检查插件是否存在
if [ ! -d "$PLUGIN_DIR" ]; then
    echo "❌ 错误: 插件目录不存在"
    exit 1
fi

# 测试任务队列（20轮）
TASKS=(
    "创建用户统计 API 路由"
    "创建通知设置组件"
    "添加错误类型定义"
    "创建数据库迁移"
    "修复视频生成超时"
)

# 运行测试
for i in "${!TASKS[@]}"; do
    TASK_NUM=$((i + 1))
    TASK="${TASKS[$i]}"
    echo ""
    echo "=== 测试 $TASK_NUM/5: $TASK ==="
    echo "⏳ 等待 API 配额..."
    
    # 实际运行需要 API 配额
    # $CLAUDE_CLI --plugin-dir "$PLUGIN_DIR" -p "$TASK" --completion-promise "COMPLETE" --max-iterations 4
    
    echo "✅ 测试 $TASK_NUM 完成（模拟）"
done

echo ""
echo "🎉 所有测试完成！"
```

## 测试状态跟踪

| 测试项 | 状态 | 迭代次数 | 结果 |
|--------|------|----------|------|
| 测试 1: API 路由 | ⏳ 待执行 | 0/20 | - |
| 测试 2: UI 组件 | ⏳ 待执行 | 0/25 | - |
| 测试 3: 代码重构 | ⏳ 待执行 | 0/30 | - |
| 测试 4: 数据库迁移 | ⏳ 待执行 | 0/35 | - |
| 测试 5: Bug 修复 | ⏳ 待执行 | 0/30 | - |

**总迭代次数**: 0/140

---

> ⚠️ **注意**: Claude API 有每日限制，测试时请合理安排。
> 💡 **提示**: 可在 Claude Code 桌面应用中手动运行命令以避免 CLI 限制。
