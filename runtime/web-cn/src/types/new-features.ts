// =====================================================
// Phase 4 新功能类型定义
// =====================================================

// 增长目标
export interface GrowthGoal {
    id: string;
    user_id: string;
    target_type: 'followers' | 'views' | 'engagement' | 'revenue';
    target_value: number;
    period_type: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    start_date: string;
    end_date: string;
    current_value: number;
    status: 'active' | 'completed' | 'failed';
    progress_percent: number;
    created_at: string;
    updated_at: string;
}

// 内容标注（爆款拆解）
export interface ContentAnnotation {
    id: string;
    user_id: string;
    content_id?: string;
    source_url?: string;
    source_platform?: string;
    annotation_type: 'hook' | 'structure' | 'emotion' | 'keyword' | 'template';
    annotation_data: {
        title_patterns?: string[];
        content_structure?: string[];
        emotion_points?: string[];
        keywords?: string[];
        template_type?: string;
    };
    ai_analysis_result?: string;
    created_at: string;
}

// 人设模板
export interface PersonaTemplate {
    id: string;
    user_id?: string;
    is_system_template: boolean;
    name: string;
    category: 'knowledge' | 'lifestyle' | 'entertainment' | 'education' | 'technology' | 'other';
    description: string;
    tone_of_voice: string;
    typical_topics: string[];
    writing_examples: string[];
    template_config: {
        style: string;
        emojiFrequency: 'low' | 'medium' | 'high';
        paragraphLength: 'short' | 'medium' | 'long';
    };
    usage_count: number;
    created_at: string;
    updated_at: string;
}

// 账号健康度
export interface AccountHealth {
    id: string;
    user_id: string;
    account_id: string;
    account_name?: string;
    check_date: string;
    health_score: number; // 0-100
    status: 'healthy' | 'warning' | 'limited' | 'banned';
    issues: {
        type: string;
        severity: 'low' | 'medium' | 'high';
        description: string;
    }[];
    recommendations: {
        priority: number;
        action: string;
        expected_impact: string;
    }[];
    metrics_snapshot: {
        views?: number;
        likes?: number;
        comments?: number;
        shares?: number;
        follower_growth?: number;
    };
    created_at: string;
}

// 用户通知
export interface UserNotification {
    id: string;
    user_id: string;
    notification_type: 'daily_digest' | 'hot_topic' | 'content_alert' | 'milestone' | 'achievement';
    title: string;
    content: string;
    metadata?: {
        topic?: string;
        content_id?: string;
        achievement_id?: string;
    };
    is_read: boolean;
    read_at?: string;
    created_at: string;
}

// A/B 测试
export interface ABTest {
    id: string;
    user_id: string;
    content_id?: string;
    test_name: string;
    variants: {
        [key: string]: {
            content: string;
            title?: string;
            impressions: number;
            clicks: number;
            engagement: number;
        };
    };
    winner_variant?: string;
    status: 'running' | 'completed' | 'paused';
    start_date: string;
    end_date?: string;
    created_at: string;
    updated_at: string;
}

// 竞品监控
export interface CompetitorMonitor {
    id: string;
    user_id: string;
    competitor_name: string;
    competitor_platform: string;
    account_url?: string;
    last_checked_at?: string;
    last_post_date?: string;
    recent_posts: {
        title: string;
        publish_date: string;
        views: number;
        likes: number;
        comments: number;
        is_viral: boolean;
    }[];
    engagement_stats: {
        avg_views: number;
        avg_likes: number;
        avg_comments: number;
        viral_rate: number;
    };
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

// 定时任务队列
export interface ScheduledTaskQueue {
    id: string;
    task_type: 'publish' | 'notification' | 'health_check' | 'data_sync';
    task_payload: Record<string, any>;
    scheduled_at: string;
    executed_at?: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    retry_count: number;
    error_message?: string;
    created_at: string;
}

// 内容预测评分
export interface ContentPrediction {
    id: string;
    content_id?: string;
    user_id: string;
    platform: string;
    predicted_score: number; // 1-100
    factors: {
        title_score: number;
        timing_score: number;
        topic_score: number;
        platform_match_score: number;
    };
    confidence: number; // 0-1
    actual_performance?: {
        views: number;
        likes: number;
        comments: number;
        shares: number;
    };
    created_at: string;
}

// 用户成长体系
export interface UserGamification {
    user_id: string;
    level: number;
    experience_points: number;
    total_contents_created: number;
    total_published: number;
    streak_days: number;
    last_active_date?: string;
    achievements: Achievement[];
    badges: Badge[];
    created_at: string;
    updated_at: string;
}

// 成就
export interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string;
    unlocked_at: string;
    progress?: number;
    target?: number;
}

// 徽章
export interface Badge {
    id: string;
    name: string;
    icon: string;
    description: string;
    earned_at?: string;
}

// 增长诊断结果
export interface GrowthDiagnosis {
    overall_score: number;
    platform_recommendations: {
        platform: string;
        potential: 'high' | 'medium' | 'low';
        recommendation: string;
        suggested_actions: string[];
    }[];
    content_recommendations: {
        type: string;
        performance: 'good' | 'average' | 'poor';
        suggestion: string;
    }[];
    next_steps: {
        priority: 'high' | 'medium' | 'low';
        action: string;
        expected_impact: string;
    }[];
}

// 智能推荐
export interface SmartRecommendation {
    id: string;
    type: 'publish_time' | 'topic' | 'content_improvement' | 'platform_focus';
    title: string;
    description: string;
    confidence: number;
    action_url?: string;
    metadata?: Record<string, any>;
    created_at: string;
}

// 变现数据
export interface MonetizationData {
    total_revenue: number;
    ad_revenue: number;
    product_sales: number;
    consultation_revenue: number;
    monthly_trend: {
        month: string;
        revenue: number;
    }[];
    top_performing_content: {
        title: string;
        platform: string;
        revenue: number;
        roi: number;
    }[];
}

// 广告报价计算
export interface AdQuote {
    platform: string;
    follower_count: number;
    avg_engagement_rate: number;
    suggested_price_range: {
        min: number;
        max: number;
    };
    factors: {
        name: string;
        impact: 'positive' | 'negative' | 'neutral';
        description: string;
    }[];
}

// 竞品对比分析
export interface CompetitorComparison {
    competitor: {
        name: string;
        followers: number;
        avg_likes: number;
        avg_comments: number;
        posting_frequency: number;
    };
    user: {
        followers: number;
        avg_likes: number;
        avg_comments: number;
        posting_frequency: number;
    };
    gaps: {
        area: string;
        difference: number;
        advice: string;
    }[];
    opportunities: string[];
}

// 行业基准数据
export interface IndustryBenchmark {
    industry: string;
    avg_followers: number;
    avg_engagement_rate: number;
    avg_posting_frequency: number;
    top_performers: {
        name: string;
        followers: number;
        engagement_rate: number;
    }[];
    user_percentile: number;
}

// 蓝海话题发现
export interface BlueOceanTopic {
    topic: string;
    search_volume: number;
    competition_level: 'low' | 'medium' | 'high';
    trend: 'rising' | 'stable' | 'declining';
    suggested_content_angles: string[];
    estimated_potential: number;
}

// 每日热点
export interface DailyHotTopic {
    id: string;
    topic: string;
    platform: string;
    heat_score: number;
    related_hashtags: string[];
    content_suggestions: string[];
    urgency: 'high' | 'medium' | 'low';
    expires_at: string;
}
