#!/bin/bash
# Ralph Wiggum 自动化测试脚本
# 用于在 API 限制解除后自动运行 20 轮测试

set -e

# 配置
PROJECT_DIR="/Users/feifei00/Documents/fenfa-ai"
PLUGIN_DIR="$HOME/Library/Application Support/Claude/plugins/ralph-wiggum"
CLAUDE_CLI="/Users/feifei00/.local/bin/claude"
LOG_FILE="$PROJECT_DIR/ralph-test-log.txt"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 记录日志
log() {
    echo -e "$1"
    echo -e "$1" | sed 's/\x1b\[[0-9;]*m//g' >> "$LOG_FILE"
}

# 检查插件是否存在
check_plugin() {
    log "${BLUE}🔍 检查插件安装...${NC}"
    if [ -d "$PLUGIN_DIR" ]; then
        log "${GREEN}✅ 插件已安装: $PLUGIN_DIR${NC}"
        ls -la "$PLUGIN_DIR" >> "$LOG_FILE"
        return 0
    else
        log "${RED}❌ 插件未找到: $PLUGIN_DIR${NC}"
        return 1
    fi
}

# 检查 API 配额
check_api_quota() {
    log "${BLUE}🔑 检查 API 配额...${NC}"
    if OUTPUT=$($CLAUDE_CLI -p "test" 2>&1); then
        if echo "$OUTPUT" | grep -q "hit your limit"; then
            log "${YELLOW}⚠️ API 限制已达到${NC}"
            return 1
        else
            log "${GREEN}✅ API 配额可用${NC}"
            return 0
        fi
    else
        log "${YELLOW}⚠️ API 限制检查失败${NC}"
        return 1
    fi
}

# 运行单个测试任务
run_test() {
    local test_name="$1"
    local prompt="$2"
    local max_iterations="$3"
    local expected_file="$4"
    
    log ""
    log "${BLUE}=== 测试: $test_name ===${NC}"
    log "⏳ 迭代次数: 0/$max_iterations"
    
    # 构建命令
    local cmd="cd \"$PROJECT_DIR\" && echo '"
    cmd+="/ralph-loop \""
    cmd+="$prompt"
    cmd+="\" --completion-promise \"COMPLETE\" --max-iterations $max_iterations"
    cmd+="' | $CLAUDE_CLI -p --plugin-dir \"$PLUGIN_DIR\""
    
    # 记录开始时间
    local start_time=$(date +%s)
    
    # 执行命令
    if OUTPUT=$(eval $cmd 2>&1); then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log ""
        log "=== 输出结果 ==="
        echo "$OUTPUT" | head -50
        
        # 检查是否包含 COMPLETE
        if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
            log "${GREEN}✅ 测试完成: $test_name (用时 ${duration}秒)${NC}"
            return 0
        else
            log "${YELLOW}⚠️ 测试未正常完成: $test_name${NC}"
            return 1
        fi
    else
        log "${RED}❌ 测试失败: $test_name${NC}"
        echo "$OUTPUT" >> "$LOG_FILE"
        return 1
    fi
}

# 测试 1: 创建 API 路由
test_1_api_route() {
    run_test "创建用户统计 API 路由" \
        "在 src/app/api/analytics/ 下创建 user-stats/route.ts，实现 GET 方法返回用户活跃度统计（登录次数、内容发布数、互动数据），添加 start_date 和 end_date 参数验证，遵循现有代码风格" \
        5 \
        "src/app/api/analytics/user-stats/route.ts"
}

# 测试 2: 创建 UI 组件
test_2_ui_component() {
    run_test "创建通知设置组件" \
        "在 src/components/settings/ 下创建 NotificationSettings.tsx，实现邮件通知、站内信通知、推送通知开关，使用 Ant Design 组件" \
        5 \
        "src/components/settings/NotificationSettings.tsx"
}

# 测试 3: 错误处理
test_3_error_handling() {
    run_test "添加错误类型定义" \
        "创建 src/lib/ai-errors.ts，定义 AI 服务错误类型，为 DeepSeek、SiliconFlow、Flux 提供商创建错误类" \
        4 \
        "src/lib/ai-errors.ts"
}

# 测试 4: 数据库迁移
test_4_database_migration() {
    run_test "创建数据库迁移" \
        "在 supabase/migrations/ 创建新迁移文件，为 materials 表添加 tags 字段（JSONB 类型），输出 <promise>COMPLETE</promise> 当完成" \
        3 \
        "supabase/migrations/"
}

# 测试 5: Bug 修复
test_5_bug_fix() {
    run_test "修复视频生成超时" \
        "分析 src/app/api/ai/generate-video/route.ts 并添加超时配置，添加 FAL_TIMEOUT 环境变量支持" \
        3 \
        "src/app/api/ai/generate-video/route.ts"
}

# 主函数
main() {
    log "========================================"
    log "🚀 Ralph Wiggum 自动化测试"
    log "========================================"
    log "📁 项目目录: $PROJECT_DIR"
    log "🔌 插件目录: $PLUGIN_DIR"
    log "📝 日志文件: $LOG_FILE"
    log "========================================"
    
    # 清空日志
    > "$LOG_FILE"
    
    # 检查前置条件
    check_plugin || exit 1
    
    # 检查 API 配额
    if ! check_api_quota; then
        log ""
        log "${YELLOW}⏰ API 限制已达到，请等待重置${NC}"
        log "重置时间: Jan 8 at 8pm (Asia/Shanghai)"
        log ""
        log "你可以通过以下方式运行测试："
        log "1. 使用 Claude Code 桌面应用（推荐）"
        log "2. 运行: ./run-ralph-test.sh"
        exit 1
    fi
    
    # 运行测试
    local total_tests=5
    local passed=0
    local failed=0
    
    # 测试 1: API 路由 (5轮)
    if test_1_api_route; then ((passed++)); else ((failed++)); fi
    
    # 测试 2: UI 组件 (5轮)
    if test_2_ui_component; then ((passed++)); else ((failed++)); fi
    
    # 测试 3: 错误处理 (4轮)
    if test_3_error_handling; then ((passed++)); else ((failed++)); fi
    
    # 测试 4: 数据库迁移 (3轮)
    if test_4_database_migration; then ((passed++)); else ((failed++)); fi
    
    # 测试 5: Bug 修复 (3轮)
    if test_5_bug_fix; then ((passed++)); else ((failed++)); fi
    
    # 总结
    log ""
    log "========================================"
    log "📊 测试总结"
    log "========================================"
    log "✅ 通过: $passed"
    log "❌ 失败: $failed"
    log "📝 总计: $total_tests"
    log "========================================"
    
    if [ $failed -eq 0 ]; then
        log "${GREEN}🎉 所有测试通过！${NC}"
        exit 0
    else
        log "${YELLOW}⚠️ 部分测试失败，请检查日志${NC}"
        exit 1
    fi
}

# 运行主函数
main "$@"
