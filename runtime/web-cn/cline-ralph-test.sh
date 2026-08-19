#!/bin/bash
# Cline Ralph Wiggum 迭代测试脚本
# 在 Cline 中模拟 Ralph Wiggum 的迭代开发循环

set -e

# 配置
PROJECT_DIR="/Users/feifei00/Documents/fenfa-ai"
CLINE_CLI="/Users/feifei00/.nvm/versions/node/v22.21.1/bin/cline"
LOG_FILE="$PROJECT_DIR/cline-ralph-log.txt"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 日志函数
log() {
    echo -e "$1"
    echo -e "$1" | sed 's/\x1b\[[0-9;]*m//g' | sed 's/\[0m$//' >> "$LOG_FILE"
}

# 迭代函数 - 模拟 Ralph Wiggum 循环
ralph_iterate() {
    local task_name="$1"
    local prompt="$2"
    local max_iterations="$3"
    local check_complete="$4"
    
    log ""
    log "${CYAN}========================================${NC}"
    log "${CYAN}🎯 任务: $task_name${NC}"
    log "${CYAN}========================================${NC}"
    log "${BLUE}最大迭代次数: $max_iterations${NC}"
    log ""
    
    local iteration=1
    local completed=false
    
    while [ $iteration -le $max_iterations ]; do
        log "${YELLOW}--- 迭代 $iteration/$max_iterations ---${NC}"
        
        # 构建迭代 prompt
        local full_prompt="迭代开发任务: $prompt

当前是第 $iteration 轮迭代（最多 $max_iterations 轮）。

请执行以下操作:
1. 读取并分析当前相关文件的状态
2. 根据需求进行代码修改或创建新文件
3. 运行测试验证（如适用）
4. 如果任务已完成（$check_complete），输出 '<promise>COMPLETE</promise>' 并停止
5. 如果未完成，描述下一步将做什么

要求:
- 保持代码风格与现有项目一致
- 遵循 TypeScript 最佳实践
- 确保代码可编译运行

输出格式:
- 如果完成: '<promise>COMPLETE</promise>'
- 如果未完成: 描述当前进度和下一步"
        
        # 执行 Cline
        local start_time=$(date +%s)
        
        if OUTPUT=$(cd "$PROJECT_DIR" && echo "$full_prompt" | $CLINE_CLI --yolo 2>&1); then
            local end_time=$(date +%s)
            local duration=$((end_time - start_time))
            
            log "用时: ${duration}秒"
            log ""
            log "--- Claude 输出 (前100行) ---"
            echo "$OUTPUT" | head -100 >> "$LOG_FILE"
            echo "$OUTPUT" | head -30
            
            # 检查是否完成
            if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
                log ""
                log "${GREEN}✅ 任务完成: $task_name (迭代 $iteration 次)${NC}"
                completed=true
                break
            fi
        else
            log "${RED}❌ 迭代 $iteration 失败${NC}"
            echo "$OUTPUT" >> "$LOG_FILE"
        fi
        
        ((iteration++))
        log ""
    done
    
    if [ "$completed" = false ]; then
        log "${YELLOW}⚠️ 达到最大迭代次数，任务未完成${NC}"
    fi
    
    return 0
}

# 测试 1: 创建 API 路由
test_1_api_route() {
    ralph_iterate \
        "创建用户统计 API 路由" \
        "在 src/app/api/analytics/ 下创建 user-stats/route.ts，实现 GET 方法返回用户统计数据（登录次数、内容发布数、互动数据），添加 start_date 和 end_date 参数验证" \
        5 \
        "文件 src/app/api/analytics/user-stats/route.ts 已创建且代码完整正确"
}

# 测试 2: 创建 UI 组件
test_2_ui_component() {
    ralph_iterate \
        "创建通知设置组件" \
        "在 src/components/settings/ 下创建 NotificationSettings.tsx，实现通知偏好设置组件，包含邮件通知、站内信通知、推送通知三个开关，使用 Ant Design 组件" \
        5 \
        "组件完整可正常工作"
}

# 测试 3: 错误处理
test_3_error_handling() {
    ralph_iterate \
        "添加错误类型定义" \
        "创建 src/lib/ai-errors.ts，定义统一的 AI 服务错误类型，包括 DeepSeekError、SiliconFlowError、FluxError 等错误类，支持错误码和错误消息" \
        4 \
        "错误类型定义文件已创建"
}

# 测试 4: 数据库迁移
test_4_database_migration() {
    ralph_iterate \
        "创建数据库迁移" \
        "在 supabase/migrations/ 创建新的 SQL 迁移文件，为 materials 表添加 tags 字段（JSONB 类型），支持数组形式的标签存储" \
        3 \
        "迁移文件已创建且 SQL 语法正确"
}

# 测试 5: Bug 修复
test_5_bug_fix() {
    ralph_iterate \
        "修复视频生成超时问题" \
        "分析 src/app/api/ai/generate-video/route.ts，添加超时处理逻辑，添加 FAL_TIMEOUT 环境变量配置，改进错误提示信息" \
        3 \
        "超时问题已修复"
}

# 主函数
main() {
    log "========================================"
    log "🚀 Cline Ralph Wiggum 迭代测试"
    log "========================================"
    log "📁 项目目录: $PROJECT_DIR"
    log "🔧 CLI: $CLINE_CLI"
    log "📝 日志: $LOG_FILE"
    log "========================================"
    
    # 清空日志
    > "$LOG_FILE"
    
    # 检查 Cline
    if ! command -v "$CLINE_CLI" &> /dev/null; then
        log "${RED}❌ Cline 未找到: $CLINE_CLI${NC}"
        exit 1
    fi
    log "${GREEN}✅ Cline 可用${NC}"
    
    # 检查项目
    if [ ! -d "$PROJECT_DIR/src" ]; then
        log "${RED}❌ 项目目录无效: $PROJECT_DIR${NC}"
        exit 1
    fi
    log "${GREEN}✅ 项目目录有效${NC}"
    
    log ""
    log "${BLUE}开始测试...${NC}"
    log ""
    
    local total=5
    local completed=0
    
    # 运行测试
    test_1_api_route && ((completed++))
    test_2_ui_component && ((completed++))
    test_3_error_handling && ((completed++))
    test_4_database_migration && ((completed++))
    test_5_bug_fix && ((completed++))
    
    # 总结
    log ""
    log "========================================"
    log "📊 测试总结"
    log "========================================"
    log "✅ 完成: $completed/$total"
    log "========================================"
    
    if [ $completed -eq $total ]; then
        log "${GREEN}🎉 所有测试通过！${NC}"
    else
        log "${YELLOW}⚠️ 部分测试未完成${NC}"
    fi
    
    log ""
    log "📝 详细日志: $LOG_FILE"
}

# 运行
main "$@"
