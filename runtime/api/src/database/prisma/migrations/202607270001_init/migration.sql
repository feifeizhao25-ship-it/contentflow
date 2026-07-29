-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_url" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "plan_expires_at" TIMESTAMP(3),
    "limits" JSONB NOT NULL DEFAULT '{"max_accounts": 2, "max_members": 1, "max_publishes_monthly": 30, "max_ai_calls_monthly": 20, "max_storage_gb": 1}',
    "usage_stats" JSONB NOT NULL DEFAULT '{"accounts_count": 0, "members_count": 1, "publishes_this_month": 0, "ai_calls_this_month": 0, "storage_used_mb": 0}',
    "settings" JSONB NOT NULL DEFAULT '{"timezone": "Asia/Shanghai", "language": "zh-CN", "notification_email": true}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT,
    "name" TEXT,
    "avatar_url" TEXT,
    "role" TEXT NOT NULL DEFAULT 'member',
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMP(3),
    "login_count" INTEGER NOT NULL DEFAULT 0,
    "oauth_providers" JSONB NOT NULL DEFAULT '{}',
    "preferences" JSONB NOT NULL DEFAULT '{"theme": "light", "default_platforms": [], "ai_style": "professional"}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "device_info" JSONB,
    "ip_address" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformAccount" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "created_by" TEXT,
    "platform" TEXT NOT NULL,
    "account_type" TEXT,
    "platform_account_id" TEXT,
    "account_name" TEXT,
    "account_nickname" TEXT,
    "avatar_url" TEXT,
    "profile_url" TEXT,
    "follower_count" INTEGER NOT NULL DEFAULT 0,
    "following_count" INTEGER NOT NULL DEFAULT 0,
    "content_count" INTEGER NOT NULL DEFAULT 0,
    "auth_type" TEXT NOT NULL,
    "auth_data_encrypted" TEXT,
    "auth_expires_at" TIMESTAMP(3),
    "auth_refresh_token_encrypted" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "health_score" INTEGER NOT NULL DEFAULT 100,
    "last_sync_at" TIMESTAMP(3),
    "last_publish_at" TIMESTAMP(3),
    "error_message" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{"auto_sync": true, "sync_interval_hours": 6, "publish_limit_daily": 10}',
    "group_name" TEXT,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountStatsHistory" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "follower_count" INTEGER,
    "following_count" INTEGER,
    "content_count" INTEGER,
    "follower_gained" INTEGER NOT NULL DEFAULT 0,
    "stat_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountStatsHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Content" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "created_by" TEXT,
    "content_type" TEXT NOT NULL,
    "title" TEXT,
    "summary" TEXT,
    "body" TEXT,
    "body_html" TEXT,
    "cover_url" TEXT,
    "media_urls" JSONB NOT NULL DEFAULT '[]',
    "category" TEXT,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "keywords" JSONB NOT NULL DEFAULT '[]',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "source_url" TEXT,
    "ai_params" JSONB,
    "ai_model" TEXT,
    "quality_score" INTEGER,
    "viral_score" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_comment" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformContent" (
    "id" TEXT NOT NULL,
    "content_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "body_html" TEXT,
    "hashtags" JSONB NOT NULL DEFAULT '[]',
    "mentions" JSONB NOT NULL DEFAULT '[]',
    "location" JSONB,
    "cover_url" TEXT,
    "media_urls" JSONB NOT NULL DEFAULT '[]',
    "extra_data" JSONB NOT NULL DEFAULT '{}',
    "char_count" INTEGER,
    "word_count" INTEGER,
    "duration_seconds" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishTask" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "content_id" TEXT NOT NULL,
    "platform_content_id" TEXT,
    "platform_account_id" TEXT,
    "created_by" TEXT,
    "publish_type" TEXT NOT NULL DEFAULT 'immediate',
    "scheduled_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "platform_post_id" TEXT,
    "platform_post_url" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "next_retry_at" TIMESTAMP(3),
    "error_code" TEXT,
    "error_message" TEXT,
    "error_details" JSONB,
    "queued_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishTemplate" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "created_by" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "platforms" JSONB NOT NULL,
    "schedule_config" JSONB,
    "content_rules" JSONB,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentStats" (
    "id" TEXT NOT NULL,
    "publish_task_id" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "followers_gained" INTEGER NOT NULL DEFAULT 0,
    "engagement_rate" DECIMAL(65,30),
    "extra_metrics" JSONB NOT NULL DEFAULT '{}',
    "stat_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyReport" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "report_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "platform" TEXT,
    "publish_count" INTEGER NOT NULL DEFAULT 0,
    "publish_success_count" INTEGER NOT NULL DEFAULT 0,
    "publish_fail_count" INTEGER NOT NULL DEFAULT 0,
    "total_views" INTEGER NOT NULL DEFAULT 0,
    "total_likes" INTEGER NOT NULL DEFAULT 0,
    "total_comments" INTEGER NOT NULL DEFAULT 0,
    "total_shares" INTEGER NOT NULL DEFAULT 0,
    "total_followers_gained" INTEGER NOT NULL DEFAULT 0,
    "views_change_rate" DECIMAL(65,30),
    "engagement_change_rate" DECIMAL(65,30),
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "created_by" TEXT,
    "material_type" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "file_url" TEXT NOT NULL,
    "file_size" INTEGER,
    "file_format" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "duration_seconds" INTEGER,
    "folder_id" TEXT,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "ai_tags" JSONB NOT NULL DEFAULT '[]',
    "ai_description" TEXT,
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialFolder" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIGeneration" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content_id" TEXT,
    "generation_type" TEXT NOT NULL,
    "input_params" JSONB NOT NULL,
    "model_provider" TEXT,
    "model_name" TEXT,
    "output_content" TEXT,
    "output_urls" JSONB,
    "tokens_input" INTEGER,
    "tokens_output" INTEGER,
    "cost_amount" DECIMAL(65,30),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViralContent" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "platform_content_id" TEXT,
    "content_url" TEXT,
    "title" TEXT,
    "summary" TEXT,
    "content_type" TEXT,
    "author_name" TEXT,
    "author_id" TEXT,
    "author_follower_count" INTEGER,
    "views" INTEGER,
    "likes" INTEGER,
    "comments" INTEGER,
    "shares" INTEGER,
    "analysis" JSONB,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "category" TEXT,
    "published_at" TIMESTAMP(3),
    "crawled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ViralContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotTopic" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "topic_name" TEXT NOT NULL,
    "topic_url" TEXT,
    "heat_score" INTEGER,
    "rank_position" INTEGER,
    "category" TEXT,
    "is_rising" BOOLEAN NOT NULL DEFAULT false,
    "topic_time" TIMESTAMP(3),
    "crawled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HotTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrowthGoal" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_value" BIGINT NOT NULL,
    "period_type" TEXT NOT NULL DEFAULT 'monthly',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "current_value" BIGINT NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrowthGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonaTemplate" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "is_system_template" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tone_of_voice" TEXT NOT NULL,
    "typical_topics" TEXT[],
    "writing_examples" TEXT[],
    "template_config" JSONB NOT NULL,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonaTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentAnnotation" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content_id" TEXT,
    "source_url" TEXT,
    "source_platform" TEXT,
    "annotation_type" TEXT NOT NULL,
    "annotation_data" JSONB NOT NULL,
    "ai_analysis_result" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentAnnotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountHealth" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "check_date" TIMESTAMP(3) NOT NULL,
    "health_score" INTEGER NOT NULL DEFAULT 100,
    "status" TEXT NOT NULL DEFAULT 'healthy',
    "issues" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "metrics_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountHealth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserNotification" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "notification_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ABTest" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content_id" TEXT,
    "test_name" TEXT NOT NULL,
    "variants" JSONB NOT NULL,
    "winner_variant" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ABTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorMonitor" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "competitor_name" TEXT NOT NULL,
    "competitor_platform" TEXT NOT NULL,
    "account_url" TEXT,
    "last_checked_at" TIMESTAMP(3),
    "last_post_date" TIMESTAMP(3),
    "recent_posts" JSONB NOT NULL,
    "engagement_stats" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitorMonitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledTaskQueue" (
    "id" TEXT NOT NULL,
    "task_type" TEXT NOT NULL,
    "task_payload" JSONB NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "executed_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledTaskQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPrediction" (
    "id" TEXT NOT NULL,
    "content_id" TEXT,
    "user_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "predicted_score" INTEGER,
    "factors" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "actual_performance" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGamification" (
    "user_id" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "experience_points" INTEGER NOT NULL DEFAULT 0,
    "total_contents_created" INTEGER NOT NULL DEFAULT 0,
    "total_published" INTEGER NOT NULL DEFAULT 0,
    "streak_days" INTEGER NOT NULL DEFAULT 0,
    "last_active_date" TIMESTAMP(3),
    "achievements" JSONB NOT NULL DEFAULT '[]',
    "badges" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGamification_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "UserPoints" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "total_earned" INTEGER NOT NULL DEFAULT 0,
    "total_spent" INTEGER NOT NULL DEFAULT 0,
    "streak_days" INTEGER NOT NULL DEFAULT 0,
    "last_checkin_date" TIMESTAMP(3),
    "longest_streak" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "experience_points" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointsLog" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "points_change" INTEGER NOT NULL,
    "balance_before" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "log_type" TEXT NOT NULL,
    "description" TEXT,
    "related_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointsLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reward" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "category" TEXT NOT NULL DEFAULT 'coupon',
    "points_required" INTEGER NOT NULL,
    "stock" INTEGER,
    "stock_unlimited" BOOLEAN NOT NULL DEFAULT false,
    "usage_limit_per_user" INTEGER NOT NULL DEFAULT 1,
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "reward_details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RedemptionRecord" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reward_id" TEXT NOT NULL,
    "points_spent" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "redeem_code" TEXT,
    "code_used_at" TIMESTAMP(3),
    "used_at" TIMESTAMP(3),
    "used_details" JSONB,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RedemptionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "condition_type" TEXT NOT NULL,
    "condition_value" JSONB NOT NULL,
    "points_reward" INTEGER NOT NULL DEFAULT 0,
    "badge_icon" TEXT,
    "target_value" INTEGER NOT NULL DEFAULT 1,
    "difficulty" TEXT NOT NULL DEFAULT 'bronze',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "achievement_id" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "target_value" INTEGER NOT NULL DEFAULT 1,
    "is_unlocked" BOOLEAN NOT NULL DEFAULT false,
    "unlocked_at" TIMESTAMP(3),
    "points_claimed" BOOLEAN NOT NULL DEFAULT false,
    "claimed_at" TIMESTAMP(3),
    "points_claimed_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'daily',
    "target_count" INTEGER NOT NULL DEFAULT 1,
    "points_reward" INTEGER NOT NULL DEFAULT 0,
    "is_daily" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_quests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "quest_id" TEXT NOT NULL,
    "current_progress" INTEGER NOT NULL DEFAULT 0,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "points_claimed" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_quests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gamification_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "next_level_xp" INTEGER NOT NULL DEFAULT 100,
    "current_streak" INTEGER NOT NULL DEFAULT 0,
    "longest_streak" INTEGER NOT NULL DEFAULT 0,
    "last_activity_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gamification_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personas" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_meters" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "ai_tokens" INTEGER NOT NULL DEFAULT 0,
    "image_count" INTEGER NOT NULL DEFAULT 0,
    "video_count" INTEGER NOT NULL DEFAULT 0,
    "publish_count" INTEGER NOT NULL DEFAULT 0,
    "storage_mb" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_meters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_ledger" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "tokens_used" INTEGER NOT NULL DEFAULT 0,
    "cost_est_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ref_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewLog" (
    "id" TEXT NOT NULL,
    "content_id" TEXT NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "changes" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamTask" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content_id" TEXT,
    "assignee_id" TEXT,
    "created_by" TEXT,
    "due_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "details" JSONB NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "billing_cycle" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "cancelled_at" TIMESTAMP(3),
    "payment_method" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentOrder" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "subscription_id" TEXT,
    "order_no" TEXT NOT NULL,
    "order_type" TEXT NOT NULL,
    "product_name" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "payment_method" TEXT,
    "payment_channel_order_no" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paid_at" TIMESTAMP(3),
    "invoice_requested" BOOLEAN NOT NULL DEFAULT false,
    "invoice_info" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageRecord" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "usage_type" TEXT NOT NULL,
    "usage_count" INTEGER NOT NULL DEFAULT 1,
    "details" JSONB,
    "usage_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "created_by" TEXT,
    "name" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "scopes" JSONB NOT NULL DEFAULT '["read"]',
    "rate_limit" INTEGER NOT NULL DEFAULT 1000,
    "ip_whitelist" JSONB,
    "last_used_at" TIMESTAMP(3),
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_slug_idx" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_plan_idx" ON "Tenant"("plan");

-- CreateIndex
CREATE INDEX "User_tenant_id_idx" ON "User"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenant_id_email_key" ON "User"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_token_hash_key" ON "UserSession"("token_hash");

-- CreateIndex
CREATE INDEX "UserSession_user_id_idx" ON "UserSession"("user_id");

-- CreateIndex
CREATE INDEX "UserSession_token_hash_idx" ON "UserSession"("token_hash");

-- CreateIndex
CREATE INDEX "PlatformAccount_tenant_id_idx" ON "PlatformAccount"("tenant_id");

-- CreateIndex
CREATE INDEX "PlatformAccount_platform_idx" ON "PlatformAccount"("platform");

-- CreateIndex
CREATE INDEX "PlatformAccount_status_idx" ON "PlatformAccount"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformAccount_tenant_id_platform_platform_account_id_key" ON "PlatformAccount"("tenant_id", "platform", "platform_account_id");

-- CreateIndex
CREATE INDEX "AccountStatsHistory_account_id_idx" ON "AccountStatsHistory"("account_id");

-- CreateIndex
CREATE INDEX "AccountStatsHistory_stat_date_idx" ON "AccountStatsHistory"("stat_date");

-- CreateIndex
CREATE UNIQUE INDEX "AccountStatsHistory_account_id_stat_date_key" ON "AccountStatsHistory"("account_id", "stat_date");

-- CreateIndex
CREATE INDEX "Content_tenant_id_idx" ON "Content"("tenant_id");

-- CreateIndex
CREATE INDEX "Content_status_idx" ON "Content"("status");

-- CreateIndex
CREATE INDEX "Content_content_type_idx" ON "Content"("content_type");

-- CreateIndex
CREATE INDEX "Content_created_at_idx" ON "Content"("created_at");

-- CreateIndex
CREATE INDEX "PlatformContent_content_id_idx" ON "PlatformContent"("content_id");

-- CreateIndex
CREATE INDEX "PlatformContent_platform_idx" ON "PlatformContent"("platform");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformContent_content_id_platform_key" ON "PlatformContent"("content_id", "platform");

-- CreateIndex
CREATE INDEX "PublishTask_tenant_id_idx" ON "PublishTask"("tenant_id");

-- CreateIndex
CREATE INDEX "PublishTask_status_idx" ON "PublishTask"("status");

-- CreateIndex
CREATE INDEX "PublishTask_scheduled_at_idx" ON "PublishTask"("scheduled_at");

-- CreateIndex
CREATE INDEX "PublishTask_content_id_idx" ON "PublishTask"("content_id");

-- CreateIndex
CREATE INDEX "ContentStats_publish_task_id_idx" ON "ContentStats"("publish_task_id");

-- CreateIndex
CREATE INDEX "ContentStats_stat_time_idx" ON "ContentStats"("stat_time");

-- CreateIndex
CREATE INDEX "DailyReport_tenant_id_idx" ON "DailyReport"("tenant_id");

-- CreateIndex
CREATE INDEX "DailyReport_report_date_idx" ON "DailyReport"("report_date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReport_tenant_id_report_date_platform_key" ON "DailyReport"("tenant_id", "report_date", "platform");

-- CreateIndex
CREATE INDEX "Material_tenant_id_idx" ON "Material"("tenant_id");

-- CreateIndex
CREATE INDEX "Material_material_type_idx" ON "Material"("material_type");

-- CreateIndex
CREATE INDEX "AIGeneration_tenant_id_idx" ON "AIGeneration"("tenant_id");

-- CreateIndex
CREATE INDEX "AIGeneration_generation_type_idx" ON "AIGeneration"("generation_type");

-- CreateIndex
CREATE INDEX "AIGeneration_created_at_idx" ON "AIGeneration"("created_at");

-- CreateIndex
CREATE INDEX "ViralContent_platform_idx" ON "ViralContent"("platform");

-- CreateIndex
CREATE INDEX "ViralContent_category_idx" ON "ViralContent"("category");

-- CreateIndex
CREATE INDEX "ViralContent_published_at_idx" ON "ViralContent"("published_at");

-- CreateIndex
CREATE UNIQUE INDEX "ViralContent_platform_platform_content_id_key" ON "ViralContent"("platform", "platform_content_id");

-- CreateIndex
CREATE INDEX "HotTopic_platform_idx" ON "HotTopic"("platform");

-- CreateIndex
CREATE INDEX "HotTopic_crawled_at_idx" ON "HotTopic"("crawled_at");

-- CreateIndex
CREATE UNIQUE INDEX "HotTopic_platform_topic_name_crawled_at_key" ON "HotTopic"("platform", "topic_name", "crawled_at");

-- CreateIndex
CREATE INDEX "GrowthGoal_user_id_idx" ON "GrowthGoal"("user_id");

-- CreateIndex
CREATE INDEX "PersonaTemplate_user_id_idx" ON "PersonaTemplate"("user_id");

-- CreateIndex
CREATE INDEX "ContentAnnotation_user_id_idx" ON "ContentAnnotation"("user_id");

-- CreateIndex
CREATE INDEX "AccountHealth_account_id_idx" ON "AccountHealth"("account_id");

-- CreateIndex
CREATE INDEX "UserNotification_user_id_idx" ON "UserNotification"("user_id");

-- CreateIndex
CREATE INDEX "UserNotification_is_read_idx" ON "UserNotification"("is_read");

-- CreateIndex
CREATE INDEX "ABTest_user_id_idx" ON "ABTest"("user_id");

-- CreateIndex
CREATE INDEX "CompetitorMonitor_user_id_idx" ON "CompetitorMonitor"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitorMonitor_user_id_competitor_platform_account_url_key" ON "CompetitorMonitor"("user_id", "competitor_platform", "account_url");

-- CreateIndex
CREATE INDEX "ScheduledTaskQueue_scheduled_at_status_idx" ON "ScheduledTaskQueue"("scheduled_at", "status");

-- CreateIndex
CREATE INDEX "ContentPrediction_user_id_idx" ON "ContentPrediction"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "UserPoints_user_id_key" ON "UserPoints"("user_id");

-- CreateIndex
CREATE INDEX "PointsLog_user_id_idx" ON "PointsLog"("user_id");

-- CreateIndex
CREATE INDEX "PointsLog_log_type_idx" ON "PointsLog"("log_type");

-- CreateIndex
CREATE INDEX "PointsLog_created_at_idx" ON "PointsLog"("created_at");

-- CreateIndex
CREATE INDEX "Reward_category_idx" ON "Reward"("category");

-- CreateIndex
CREATE INDEX "Reward_is_active_idx" ON "Reward"("is_active");

-- CreateIndex
CREATE INDEX "RedemptionRecord_user_id_idx" ON "RedemptionRecord"("user_id");

-- CreateIndex
CREATE INDEX "RedemptionRecord_reward_id_idx" ON "RedemptionRecord"("reward_id");

-- CreateIndex
CREATE INDEX "RedemptionRecord_status_idx" ON "RedemptionRecord"("status");

-- CreateIndex
CREATE INDEX "RedemptionRecord_redeem_code_idx" ON "RedemptionRecord"("redeem_code");

-- CreateIndex
CREATE INDEX "Achievement_category_idx" ON "Achievement"("category");

-- CreateIndex
CREATE INDEX "Achievement_condition_type_idx" ON "Achievement"("condition_type");

-- CreateIndex
CREATE INDEX "UserAchievement_user_id_idx" ON "UserAchievement"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_user_id_achievement_id_key" ON "UserAchievement"("user_id", "achievement_id");

-- CreateIndex
CREATE INDEX "quests_category_is_active_idx" ON "quests"("category", "is_active");

-- CreateIndex
CREATE INDEX "user_quests_user_id_created_at_idx" ON "user_quests"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_quests_user_id_quest_id_key" ON "user_quests"("user_id", "quest_id");

-- CreateIndex
CREATE UNIQUE INDEX "gamification_profiles_user_id_key" ON "gamification_profiles"("user_id");

-- CreateIndex
CREATE INDEX "personas_tenant_id_idx" ON "personas"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "usage_meters_tenant_id_period_key" ON "usage_meters"("tenant_id", "period");

-- CreateIndex
CREATE INDEX "cost_ledger_tenant_id_created_at_idx" ON "cost_ledger"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "ReviewLog_content_id_idx" ON "ReviewLog"("content_id");

-- CreateIndex
CREATE INDEX "TeamTask_tenant_id_idx" ON "TeamTask"("tenant_id");

-- CreateIndex
CREATE INDEX "TeamTask_assignee_id_idx" ON "TeamTask"("assignee_id");

-- CreateIndex
CREATE INDEX "ActivityLog_tenant_id_idx" ON "ActivityLog"("tenant_id");

-- CreateIndex
CREATE INDEX "ActivityLog_user_id_idx" ON "ActivityLog"("user_id");

-- CreateIndex
CREATE INDEX "ActivityLog_created_at_idx" ON "ActivityLog"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_tenant_id_key" ON "Subscription"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_order_no_key" ON "PaymentOrder"("order_no");

-- CreateIndex
CREATE INDEX "PaymentOrder_tenant_id_idx" ON "PaymentOrder"("tenant_id");

-- CreateIndex
CREATE INDEX "PaymentOrder_status_idx" ON "PaymentOrder"("status");

-- CreateIndex
CREATE INDEX "UsageRecord_tenant_id_idx" ON "UsageRecord"("tenant_id");

-- CreateIndex
CREATE INDEX "UsageRecord_usage_date_idx" ON "UsageRecord"("usage_date");

-- CreateIndex
CREATE INDEX "UsageRecord_usage_type_idx" ON "UsageRecord"("usage_type");

-- CreateIndex
CREATE INDEX "ApiKey_tenant_id_idx" ON "ApiKey"("tenant_id");

-- CreateIndex
CREATE INDEX "ApiKey_key_hash_idx" ON "ApiKey"("key_hash");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformAccount" ADD CONSTRAINT "PlatformAccount_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountStatsHistory" ADD CONSTRAINT "AccountStatsHistory_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "PlatformAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformContent" ADD CONSTRAINT "PlatformContent_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishTask" ADD CONSTRAINT "PublishTask_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishTask" ADD CONSTRAINT "PublishTask_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishTask" ADD CONSTRAINT "PublishTask_platform_content_id_fkey" FOREIGN KEY ("platform_content_id") REFERENCES "PlatformContent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishTask" ADD CONSTRAINT "PublishTask_platform_account_id_fkey" FOREIGN KEY ("platform_account_id") REFERENCES "PlatformAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentStats" ADD CONSTRAINT "ContentStats_publish_task_id_fkey" FOREIGN KEY ("publish_task_id") REFERENCES "PublishTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIGeneration" ADD CONSTRAINT "AIGeneration_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "Content"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAnnotation" ADD CONSTRAINT "ContentAnnotation_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPrediction" ADD CONSTRAINT "ContentPrediction_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsLog" ADD CONSTRAINT "PointsLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "UserPoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedemptionRecord" ADD CONSTRAINT "RedemptionRecord_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "UserPoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedemptionRecord" ADD CONSTRAINT "RedemptionRecord_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "Reward"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_quests" ADD CONSTRAINT "user_quests_quest_id_fkey" FOREIGN KEY ("quest_id") REFERENCES "quests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewLog" ADD CONSTRAINT "ReviewLog_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

