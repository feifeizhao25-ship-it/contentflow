import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    // Simulated activity logs for the team
    const activities = [
        {
            id: '1',
            user: { name: '张三', avatar: null },
            action: '发布了新内容',
            module: '文章',
            target: '《2026年AI趋势展望》',
            time: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 mins ago
        },
        {
            id: '2',
            user: { name: '李四', avatar: null },
            action: '使用了 AI 生成视频',
            module: '创作中心',
            target: '短视频素材 #001',
            time: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2 hours ago
        },
        {
            id: '3',
            user: { name: '王五', avatar: null },
            action: '绑定了抖音账号',
            module: '账号管理',
            target: '科技达人-Tech',
            time: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
        },
        {
            id: '4',
            user: { name: '张三', avatar: null },
            action: '修改了团队角色',
            module: '团队协作',
            target: '陈小明 -> 编辑',
            time: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
        },
        {
            id: '5',
            user: { name: '系统', avatar: null },
            action: '定时任务发布成功',
            module: '发布中心',
            target: '小红书发布任务 #882',
            time: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
        }
    ];

    return NextResponse.json({
        success: true,
        activities
    });
}
